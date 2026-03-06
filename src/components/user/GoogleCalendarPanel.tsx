import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon, Plus, RefreshCw, Link2, Loader2, Clock, MapPin,
  Users, ExternalLink, ChevronLeft, ChevronRight, List, LayoutGrid, Columns,
  Search, Filter, Video, Phone, Bell, UserPlus, X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import {
  format, parseISO, addHours, addDays, startOfWeek, endOfWeek, startOfDay,
  endOfDay, isSameDay, isWithinInterval, eachDayOfInterval, eachHourOfInterval,
  setHours, setMinutes, getHours, getMinutes, differenceInMinutes, subDays, subWeeks, addWeeks
} from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus?: string }[];
  htmlLink?: string;
  location?: string;
  hangoutLink?: string;
  conferenceData?: { entryPoints?: { entryPointType: string; uri: string }[] };
}

type ViewMode = "day" | "week" | "list";

interface TeamMember {
  id: string;
  name: string;
  member_role: string;
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7); // 7h - 21h

const REMINDER_OPTIONS = [
  { label: "24h antes", value: "24h", minutes: 1440 },
  { label: "12h antes", value: "12h", minutes: 720 },
  { label: "1h antes", value: "1h", minutes: 60 },
  { label: "30min antes", value: "30min", minutes: 30 },
  { label: "5min antes", value: "5min", minutes: 5 },
  { label: "Na hora", value: "0min", minutes: 0 },
];

export function GoogleCalendarPanel() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // New event form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newAttendees, setNewAttendees] = useState("");
  const [addMeet, setAddMeet] = useState(true);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [enableReminders, setEnableReminders] = useState(true);
  const [selectedReminders, setSelectedReminders] = useState<string[]>(["24h", "1h", "5min"]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    }
    if (viewMode === "week") {
      return {
        start: startOfWeek(currentDate, { weekStartsOn: 0 }),
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      };
    }
    // list: 14 days
    return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 13)) };
  }, [viewMode, currentDate]);

  const checkConnection = useCallback(async () => {
    const { data } = await supabase
      .from("google_calendar_tokens")
      .select("calendar_email")
      .maybeSingle();
    setConnected(!!data);
    setCalendarEmail(data?.calendar_email || null);
    return !!data;
  }, []);

  // Fetch team members for selector
  useEffect(() => {
    supabase.from("team_members").select("id, name, member_role").eq("active", true).order("name")
      .then(({ data }) => { if (data) setTeamMembers(data); });
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: {
          action: "list",
          timeMin: dateRange.start.toISOString(),
          timeMax: dateRange.end.toISOString(),
        },
      });
      if (error) throw error;
      if (data?.error === "not_connected") {
        setConnected(false);
        return;
      }
      setEvents(data?.events || []);
      setConnected(true);
    } catch (e) {
      console.error("Error fetching events:", e);
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    checkConnection().then(ok => {
      if (ok) fetchEvents();
      else setLoading(false);
    });
  }, [checkConnection, fetchEvents]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "width=600,height=700");
        toast.info("Complete a autorização na janela do Google");
        const interval = setInterval(async () => {
          const isConnected = await checkConnection();
          if (isConnected) {
            clearInterval(interval);
            setConnecting(false);
            toast.success("Google Calendar conectado!");
            fetchEvents();
          }
        }, 3000);
        setTimeout(() => { clearInterval(interval); setConnecting(false); }, 120000);
      }
    } catch {
      toast.error("Erro ao conectar com Google Calendar");
      setConnecting(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newTitle || !newStartDate) { toast.error("Preencha título e data"); return; }
    setCreating(true);
    try {
      const startDateTime = `${newStartDate}T${newStartTime}:00`;
      const endDateTime = `${newStartDate}T${newEndTime}:00`;
      const attendees = newAttendees.split(",").map(e => e.trim()).filter(e => e.includes("@"));
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: { action: "create", summary: newTitle, description: newDescription, startDateTime, endDateTime, attendees, addMeet },
      });
      if (error) throw error;

      const eventId = data?.event?.id || "";
      const eventStartAt = new Date(`${newStartDate}T${newStartTime}:00`);

      // Create WhatsApp reminders if enabled
      if (enableReminders && (leadPhone || selectedMembers.length > 0)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const reminders: any[] = [];
          
          for (const reminderValue of selectedReminders) {
            const opt = REMINDER_OPTIONS.find(r => r.value === reminderValue);
            if (!opt) continue;
            const remindAt = new Date(eventStartAt.getTime() - opt.minutes * 60000);

            // Lead reminder
            if (leadPhone) {
              reminders.push({
                event_google_id: eventId,
                event_title: newTitle,
                event_description: newDescription,
                event_start_at: eventStartAt.toISOString(),
                lead_name: leadName,
                lead_phone: leadPhone,
                team_member_ids: selectedMembers,
                remind_at: remindAt.toISOString(),
                reminder_type: "lead",
                reminder_label: reminderValue,
                created_by: user.id,
              });
            }

            // Team member reminder
            if (selectedMembers.length > 0) {
              reminders.push({
                event_google_id: eventId,
                event_title: newTitle,
                event_description: newDescription,
                event_start_at: eventStartAt.toISOString(),
                lead_name: leadName,
                lead_phone: leadPhone,
                team_member_ids: selectedMembers,
                remind_at: remindAt.toISOString(),
                reminder_type: "team",
                reminder_label: reminderValue,
                created_by: user.id,
              });
            }
          }

          if (reminders.length > 0) {
            await supabase.from("event_reminders").insert(reminders);
          }
        }
      }

      const meetLink = data?.event?.hangoutLink;
      if (meetLink) {
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">Evento criado com Google Meet!</p>
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">{meetLink}</a>
            {enableReminders && leadPhone && <p className="text-[10px] text-muted-foreground">📱 Lembretes WhatsApp agendados</p>}
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.success(enableReminders && leadPhone ? "Evento criado! Lembretes WhatsApp agendados 📱" : "Evento criado!");
      }
      setDialogOpen(false);
      setNewTitle(""); setNewDescription(""); setNewAttendees("");
      setLeadName(""); setLeadPhone(""); setSelectedMembers([]);
      fetchEvents();
    } catch {
      toast.error("Erro ao criar evento");
    } finally {
      setCreating(false);
    }
  };

  const navigate = (dir: -1 | 1) => {
    if (viewMode === "day") setCurrentDate(prev => addDays(prev, dir));
    else if (viewMode === "week") setCurrentDate(prev => dir === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1));
    else setCurrentDate(prev => addDays(prev, dir * 14));
  };

  const goToday = () => setCurrentDate(new Date());

  const filteredEvents = useMemo(() => {
    if (!searchQuery) return events;
    const q = searchQuery.toLowerCase();
    return events.filter(e =>
      e.summary?.toLowerCase().includes(q) ||
      e.location?.toLowerCase().includes(q) ||
      e.attendees?.some(a => a.email.toLowerCase().includes(q))
    );
  }, [events, searchQuery]);

  const getEventStart = (event: CalendarEvent) => {
    const s = event.start.dateTime || event.start.date;
    return s ? parseISO(s) : new Date();
  };
  const getEventEnd = (event: CalendarEvent) => {
    const e = event.end.dateTime || event.end.date;
    return e ? parseISO(e) : addHours(getEventStart(event), 1);
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "accepted": return "bg-accent/20 text-accent";
      case "declined": return "bg-destructive/20 text-destructive";
      case "tentative": return "bg-[hsl(38,92%,50%)]/20 text-[hsl(38,92%,50%)]";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Not connected state
  if (connected === false) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="p-4 rounded-2xl bg-primary/10">
          <CalendarIcon className="text-primary" size={40} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-foreground">Conectar Google Calendar</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Sincronize suas reuniões e crie eventos diretamente pela plataforma
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting} className="gap-2">
          {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          {connecting ? "Conectando..." : "Conectar Google Calendar"}
        </Button>
      </div>
    );
  }

  const dateLabel = () => {
    if (viewMode === "day") return format(currentDate, "EEEE, dd 'de' MMMM", { locale: ptBR });
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      return `${format(ws, "dd MMM", { locale: ptBR })} — ${format(we, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return `${format(currentDate, "dd MMM", { locale: ptBR })} — ${format(addDays(currentDate, 13), "dd MMM yyyy", { locale: ptBR })}`;
  };

  // ---- VIEWS ----

  const renderDayView = () => {
    const dayEvents = filteredEvents.filter(e => isSameDay(getEventStart(e), currentDate));
    return (
      <div className="relative border border-border rounded-xl overflow-hidden bg-card">
        <div className="overflow-y-auto max-h-[600px] scrollbar-none">
          {HOURS.map(hour => {
            const hourEvents = dayEvents.filter(e => {
              const h = getHours(getEventStart(e));
              return h === hour;
            });
            return (
              <div key={hour} className="flex border-b border-border/50 min-h-[60px]">
                <div className="w-14 shrink-0 py-2 pr-2 text-right text-[10px] font-medium text-muted-foreground border-r border-border/50">
                  {`${hour.toString().padStart(2, "0")}:00`}
                </div>
                <div className="flex-1 relative py-1 px-2 space-y-1">
                  {hourEvents.map(ev => (
                    <EventChip key={ev.id} event={ev} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: ws, end: addDays(ws, 6) });
    const today = new Date();

    return (
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {/* Day headers */}
        <div className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border">
          <div className="border-r border-border/50" />
          {days.map(day => (
            <div
              key={day.toISOString()}
              className={cn(
                "text-center py-2 border-r border-border/50 last:border-r-0",
                isSameDay(day, today) && "bg-primary/10"
              )}
            >
              <div className="text-[10px] uppercase text-muted-foreground font-medium">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div className={cn(
                "text-sm font-bold",
                isSameDay(day, today) ? "text-primary" : "text-foreground"
              )}>
                {format(day, "dd")}
              </div>
            </div>
          ))}
        </div>

        {/* Time grid */}
        <div className="overflow-y-auto max-h-[520px] scrollbar-none">
          {HOURS.map(hour => (
            <div key={hour} className="grid grid-cols-[56px_repeat(7,1fr)] border-b border-border/50 min-h-[52px]">
              <div className="py-1 pr-2 text-right text-[10px] font-medium text-muted-foreground border-r border-border/50">
                {`${hour.toString().padStart(2, "0")}:00`}
              </div>
              {days.map(day => {
                const cellEvents = filteredEvents.filter(e => {
                  const s = getEventStart(e);
                  return isSameDay(s, day) && getHours(s) === hour;
                });
                return (
                  <div key={day.toISOString()} className="border-r border-border/50 last:border-r-0 px-0.5 py-0.5">
                    {cellEvents.map(ev => (
                      <EventChipSmall key={ev.id} event={ev} />
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderListView = () => {
    const grouped = new Map<string, CalendarEvent[]>();
    filteredEvents
      .sort((a, b) => getEventStart(a).getTime() - getEventStart(b).getTime())
      .forEach(ev => {
        const key = format(getEventStart(ev), "yyyy-MM-dd");
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(ev);
      });

    if (grouped.size === 0) {
      return (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <CalendarIcon className="mx-auto text-muted-foreground mb-3" size={28} />
            <p className="text-sm text-muted-foreground">Nenhum evento encontrado</p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => (
          <div key={dateKey}>
            <div className="flex items-center gap-2 mb-2">
              <div className={cn(
                "flex items-center justify-center w-9 h-9 rounded-full text-sm font-bold",
                isSameDay(parseISO(dateKey), new Date())
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground"
              )}>
                {format(parseISO(dateKey), "dd")}
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground capitalize">
                  {format(parseISO(dateKey), "EEEE", { locale: ptBR })}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {format(parseISO(dateKey), "MMMM yyyy", { locale: ptBR })}
                </p>
              </div>
            </div>
            <div className="space-y-1.5 ml-11">
              {dayEvents.map(ev => (
                <EventChip key={ev.id} event={ev} />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const EventChip = ({ event }: { event: CalendarEvent }) => {
    const start = getEventStart(event);
    const end = getEventEnd(event);
    const duration = differenceInMinutes(end, start);
    const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri;

    return (
      <div className="group flex items-start gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors cursor-default">
        <div className="w-1 self-stretch rounded-full bg-primary shrink-0" />
        <div className="flex-1 min-w-0 space-y-0.5">
          <h4 className="text-sm font-semibold text-foreground truncate">{event.summary}</h4>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock size={10} />
              {format(start, "HH:mm")} — {format(end, "HH:mm")}
              <span className="text-muted-foreground/60">({duration}min)</span>
            </span>
            {event.location && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground truncate max-w-[180px]">
                <MapPin size={10} />
                {event.location}
              </span>
            )}
            {meetLink && (
              <a
                href={meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[11px] text-primary hover:underline"
              >
                <Video size={10} />
                Google Meet
              </a>
            )}
          </div>
          {event.attendees && event.attendees.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <Users size={10} className="text-muted-foreground" />
              {event.attendees.slice(0, 4).map(a => (
                <Badge key={a.email} variant="outline" className={cn("text-[9px] h-4 px-1.5", getStatusColor(a.responseStatus))}>
                  {a.email.split("@")[0]}
                </Badge>
              ))}
              {event.attendees.length > 4 && (
                <span className="text-[9px] text-muted-foreground">+{event.attendees.length - 4}</span>
              )}
            </div>
          )}
        </div>
        {event.htmlLink && (
          <a
            href={event.htmlLink}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
          >
            <ExternalLink size={12} />
          </a>
        )}
      </div>
    );
  };

  const EventChipSmall = ({ event }: { event: CalendarEvent }) => {
    const start = getEventStart(event);
    return (
      <a
        href={event.htmlLink}
        target="_blank"
        rel="noopener noreferrer"
        className="block text-[9px] leading-tight font-medium text-primary-foreground bg-primary/80 hover:bg-primary rounded px-1 py-0.5 truncate"
        title={`${event.summary} · ${format(start, "HH:mm")}`}
      >
        {format(start, "HH:mm")} {event.summary}
      </a>
    );
  };

  return (
    <div className="space-y-3">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <CalendarIcon size={18} className="text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground leading-none">Agenda</h3>
            {calendarEmail && <p className="text-[10px] text-muted-foreground">{calendarEmail}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={fetchEvents} className="h-7 w-7 p-0" title="Atualizar">
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-7 gap-1 text-xs px-2">
                <Plus size={12} /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh]">
              <DialogHeader><DialogTitle>Criar Evento</DialogTitle></DialogHeader>
              <ScrollArea className="max-h-[70vh] pr-3">
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Título *</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Reunião com cliente" />
                </div>
                <div>
                  <Label className="text-xs">Data *</Label>
                  <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} min={format(new Date(), "yyyy-MM-dd")} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-xs">Início</Label><Input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} /></div>
                  <div><Label className="text-xs">Fim</Label><Input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} /></div>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detalhes da reunião, contexto do lead..." rows={2} />
                </div>

                {/* Team member selector */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <UserPlus size={14} className="text-primary" />
                    <Label className="text-xs font-semibold">Para quem é o agendamento?</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5 max-h-[120px] overflow-y-auto scrollbar-none">
                    {teamMembers.map(m => (
                      <label key={m.id} className={cn(
                        "flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors text-xs",
                        selectedMembers.includes(m.id) ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                      )}>
                        <Checkbox
                          checked={selectedMembers.includes(m.id)}
                          onCheckedChange={(checked) => {
                            setSelectedMembers(prev =>
                              checked ? [...prev, m.id] : prev.filter(id => id !== m.id)
                            );
                          }}
                          className="h-3.5 w-3.5"
                        />
                        <span className="truncate">{m.name}</span>
                        <Badge variant="outline" className="text-[8px] h-3.5 px-1 ml-auto shrink-0">
                          {m.member_role === "closer" ? "C" : m.member_role === "sdr" ? "S" : "S+C"}
                        </Badge>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Lead info */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Phone size={14} className="text-accent" />
                    <Label className="text-xs font-semibold">Dados do Lead (WhatsApp)</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Nome</Label>
                      <Input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="João Silva" className="h-8 text-xs" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">WhatsApp</Label>
                      <Input value={leadPhone} onChange={e => setLeadPhone(e.target.value)} placeholder="5511999999999" className="h-8 text-xs" />
                    </div>
                  </div>
                </div>

                <div>
                  <Label className="text-xs">Convidados (e-mails separados por vírgula)</Label>
                  <Input value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="joao@email.com, maria@email.com" />
                </div>

                {/* Google Meet toggle */}
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div className="flex items-center gap-2">
                    <Video size={16} className="text-primary" />
                    <div>
                      <p className="text-xs font-medium text-foreground">Google Meet</p>
                      <p className="text-[10px] text-muted-foreground">Gerar link de videoconferência</p>
                    </div>
                  </div>
                  <Switch checked={addMeet} onCheckedChange={setAddMeet} />
                </div>

                {/* WhatsApp Reminders */}
                <div className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Bell size={14} className="text-[hsl(38,92%,50%)]" />
                      <div>
                        <p className="text-xs font-medium text-foreground">Lembretes WhatsApp</p>
                        <p className="text-[10px] text-muted-foreground">Anti-noshow com IA · horário comercial</p>
                      </div>
                    </div>
                    <Switch checked={enableReminders} onCheckedChange={setEnableReminders} />
                  </div>
                  {enableReminders && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {REMINDER_OPTIONS.map(opt => (
                        <label
                          key={opt.value}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] cursor-pointer transition-colors border",
                            selectedReminders.includes(opt.value)
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/20"
                          )}
                        >
                          <Checkbox
                            checked={selectedReminders.includes(opt.value)}
                            onCheckedChange={(checked) => {
                              setSelectedReminders(prev =>
                                checked ? [...prev, opt.value] : prev.filter(v => v !== opt.value)
                              );
                            }}
                            className="h-3 w-3"
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <Button onClick={handleCreateEvent} disabled={creating} className="w-full gap-2">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? "Criando..." : "Criar Evento"}
                </Button>
              </div>
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Navigation + View toggle */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={goToday}>Hoje</Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(-1)}>
            <ChevronLeft size={14} />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => navigate(1)}>
            <ChevronRight size={14} />
          </Button>
          <span className="text-xs font-semibold text-foreground ml-1 capitalize">{dateLabel()}</span>
        </div>
        <div className="flex items-center gap-0.5 bg-secondary rounded-lg p-0.5">
          {([
            { mode: "day" as ViewMode, icon: LayoutGrid, label: "Dia" },
            { mode: "week" as ViewMode, icon: Columns, label: "Semana" },
            { mode: "list" as ViewMode, icon: List, label: "Lista" },
          ]).map(v => (
            <Button
              key={v.mode}
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 px-2 text-[10px] gap-1 rounded-md",
                viewMode === v.mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setViewMode(v.mode)}
            >
              <v.icon size={11} />
              <span className="hidden sm:inline">{v.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Buscar evento, local ou convidado..."
          className="h-8 pl-8 text-xs bg-secondary border-border"
        />
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : (
        <>
          {viewMode === "day" && renderDayView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "list" && renderListView()}
        </>
      )}

      {/* Summary */}
      {!loading && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
          <span>{filteredEvents.length} evento(s)</span>
          <span>{dateLabel()}</span>
        </div>
      )}
    </div>
  );
}
