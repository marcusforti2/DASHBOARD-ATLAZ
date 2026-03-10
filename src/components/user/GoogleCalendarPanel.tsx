import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon, Plus, RefreshCw, Link2, Loader2, Clock, MapPin,
  Users, ExternalLink, ChevronLeft, ChevronRight, List, LayoutGrid, Columns,
  Search, Video, Phone, Bell, UserPlus, X, User as UserIcon
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import {
  format, parseISO, addHours, addDays, startOfWeek, endOfWeek, startOfDay,
  endOfDay, isSameDay, eachDayOfInterval, isToday,
  getHours, getMinutes, differenceInMinutes, subWeeks, addWeeks
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

interface ConnectedCloser {
  memberId: string;
  memberName: string;
  memberRole: string;
  userId: string | null;
  connected: boolean;
  calendarEmail: string | null;
}

interface GoogleCalendarPanelProps {
  teamMemberId?: string;
  memberRole?: string;
}

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 06:00 - 23:00
const HOUR_HEIGHT = 56; // px per hour — compact but readable

const REMINDER_OPTIONS = [
  { label: "24h antes", value: "24h", minutes: 1440 },
  { label: "12h antes", value: "12h", minutes: 720 },
  { label: "1h antes", value: "1h", minutes: 60 },
  { label: "30min antes", value: "30min", minutes: 30 },
  { label: "5min antes", value: "5min", minutes: 5 },
  { label: "Na hora", value: "0min", minutes: 0 },
];

// Google Calendar-like event colors
const EVENT_COLORS = [
  "hsl(217, 91%, 60%)",  // blue (primary)
  "hsl(160, 84%, 39%)",  // green
  "hsl(280, 65%, 60%)",  // purple
  "hsl(38, 92%, 50%)",   // amber
  "hsl(340, 82%, 52%)",  // pink
  "hsl(190, 90%, 40%)",  // teal
];

function getEventColor(eventId: string): string {
  let hash = 0;
  for (let i = 0; i < eventId.length; i++) {
    hash = ((hash << 5) - hash) + eventId.charCodeAt(i);
    hash |= 0;
  }
  return EVENT_COLORS[Math.abs(hash) % EVENT_COLORS.length];
}

export function GoogleCalendarPanel({ teamMemberId, memberRole }: GoogleCalendarPanelProps) {
  const [connectedClosers, setConnectedClosers] = useState<ConnectedCloser[]>([]);
  const [selectedCloserId, setSelectedCloserId] = useState<string | null>(null);
  const [loadingClosers, setLoadingClosers] = useState(true);

  const [connected, setConnected] = useState<boolean | null>(null);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [searchQuery, setSearchQuery] = useState("");
  const [hoveredEvent, setHoveredEvent] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);

  const memberRoles = (memberRole || "").split(",").map(r => r.trim());
  const isCloser = memberRoles.includes("closer");
  const isSdr = memberRoles.includes("sdr") && !isCloser;

  const dateRange = useMemo(() => {
    if (viewMode === "day") return { start: startOfDay(currentDate), end: endOfDay(currentDate) };
    if (viewMode === "week") return { start: startOfWeek(currentDate, { weekStartsOn: 0 }), end: endOfWeek(currentDate, { weekStartsOn: 0 }) };
    return { start: startOfDay(currentDate), end: endOfDay(addDays(currentDate, 13)) };
  }, [viewMode, currentDate]);

  // Scroll to first event or current hour on load
  useEffect(() => {
    if (scrollRef.current && !loading && events.length > 0) {
      // Find earliest event hour
      const earliest = events.reduce((min, ev) => {
        const s = ev.start.dateTime || ev.start.date;
        if (!s) return min;
        const h = parseISO(s).getHours();
        return h < min ? h : min;
      }, 24);
      const targetHour = earliest < 24 ? Math.max(earliest - 1, HOURS[0]) : new Date().getHours() - 1;
      const scrollTo = (targetHour - HOURS[0]) * HOUR_HEIGHT;
      scrollRef.current.scrollTop = Math.max(0, scrollTo);
    }
  }, [viewMode, loading, events]);

  // Fetch connected closers
  useEffect(() => {
    const fetchClosers = async () => {
      setLoadingClosers(true);
      try {
        const { data, error } = await supabase.functions.invoke("google-calendar-events", {
          body: { action: "list_connected_closers" },
        });
        if (error) throw error;
        const closers: ConnectedCloser[] = data?.closers || [];
        setConnectedClosers(closers);
        const connectedOnes = closers.filter(c => c.connected);
        if (isCloser) {
          const own = connectedOnes.find(c => c.memberId === teamMemberId);
          setSelectedCloserId(own?.memberId || connectedOnes[0]?.memberId || null);
        } else {
          setSelectedCloserId(connectedOnes[0]?.memberId || null);
        }
      } catch (e) {
        console.error("Error fetching closers:", e);
      } finally {
        setLoadingClosers(false);
      }
    };
    fetchClosers();
  }, [teamMemberId, isCloser]);

  const selectedCloser = connectedClosers.find(c => c.memberId === selectedCloserId);

  const fetchEvents = useCallback(async () => {
    if (!selectedCloser?.userId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: {
          action: "list",
          targetUserId: selectedCloser.userId,
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
      setCalendarEmail(selectedCloser.calendarEmail || null);
    } catch (e) {
      console.error("Error fetching events:", e);
    } finally {
      setLoading(false);
    }
  }, [dateRange, selectedCloser]);

  useEffect(() => {
    if (selectedCloser?.connected) {
      fetchEvents();
    } else {
      setEvents([]);
      setConnected(selectedCloser ? false : null);
    }
  }, [selectedCloser, fetchEvents]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "width=600,height=700");
        toast.info("Complete a autorização na janela do Google");
        const interval = setInterval(async () => {
          const { data: check } = await supabase.from("google_calendar_tokens").select("calendar_email").maybeSingle();
          if (check) {
            clearInterval(interval);
            setConnecting(false);
            toast.success("Google Calendar conectado!");
            const { data: refreshed } = await supabase.functions.invoke("google-calendar-events", {
              body: { action: "list_connected_closers" },
            });
            if (refreshed?.closers) {
              setConnectedClosers(refreshed.closers);
              const own = (refreshed.closers as ConnectedCloser[]).find(c => c.memberId === teamMemberId && c.connected);
              if (own) setSelectedCloserId(own.memberId);
            }
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
    if (!selectedCloser?.userId) { toast.error("Selecione uma agenda"); return; }
    setCreating(true);
    try {
      const startDateTime = `${newStartDate}T${newStartTime}:00`;
      const endDateTime = `${newStartDate}T${newEndTime}:00`;
      const attendees = newAttendees.split(",").map(e => e.trim()).filter(e => e.includes("@"));
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: {
          action: "create",
          targetUserId: selectedCloser.userId,
          summary: newTitle,
          description: newDescription,
          startDateTime, endDateTime, attendees, addMeet,
        },
      });
      if (error) throw error;

      const eventId = data?.event?.id || "";
      const eventStartAt = new Date(`${newStartDate}T${newStartTime}:00`);

      if (enableReminders && (leadPhone || selectedMembers.length > 0)) {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const reminders: any[] = [];
          for (const reminderValue of selectedReminders) {
            const opt = REMINDER_OPTIONS.find(r => r.value === reminderValue);
            if (!opt) continue;
            const remindAt = new Date(eventStartAt.getTime() - opt.minutes * 60000);
            if (leadPhone) {
              reminders.push({
                event_google_id: eventId, event_title: newTitle, event_description: newDescription,
                event_start_at: eventStartAt.toISOString(), lead_name: leadName, lead_phone: leadPhone,
                team_member_ids: selectedMembers, remind_at: remindAt.toISOString(),
                reminder_type: "lead", reminder_label: reminderValue, created_by: user.id,
              });
            }
            if (selectedMembers.length > 0) {
              reminders.push({
                event_google_id: eventId, event_title: newTitle, event_description: newDescription,
                event_start_at: eventStartAt.toISOString(), lead_name: leadName, lead_phone: leadPhone,
                team_member_ids: selectedMembers, remind_at: remindAt.toISOString(),
                reminder_type: "team", reminder_label: reminderValue, created_by: user.id,
              });
            }
          }
          if (reminders.length > 0) await supabase.from("event_reminders").insert(reminders);
        }
      }

      const meetLink = data?.event?.hangoutLink;
      if (meetLink) {
        toast.success(
          <div className="space-y-1">
            <p className="font-semibold">Evento criado na agenda de {selectedCloser.memberName}!</p>
            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary underline break-all">{meetLink}</a>
            {enableReminders && leadPhone && <p className="text-[10px] text-muted-foreground">📱 Lembretes WhatsApp agendados</p>}
          </div>,
          { duration: 8000 }
        );
      } else {
        toast.success(`Evento criado na agenda de ${selectedCloser.memberName}!`);
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

  const connectedClosersList = connectedClosers.filter(c => c.connected);

  // ── Loading closers ──
  if (loadingClosers) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  // ── Closer without connection ──
  if (isCloser && !connectedClosers.find(c => c.memberId === teamMemberId)?.connected) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-6">
        <div className="p-4 rounded-2xl bg-primary/10">
          <CalendarIcon className="text-primary" size={40} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-foreground">Conectar sua Agenda</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Conecte seu Google Calendar para visualizar e gerenciar seus compromissos
          </p>
        </div>
        <Button onClick={handleConnect} disabled={connecting} className="gap-2">
          {connecting ? <Loader2 size={16} className="animate-spin" /> : <Link2 size={16} />}
          {connecting ? "Conectando..." : "Conectar Google Calendar"}
        </Button>
      </div>
    );
  }

  // ── No connected closers ──
  if (connectedClosersList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 space-y-4">
        <div className="p-4 rounded-2xl bg-muted">
          <CalendarIcon className="text-muted-foreground" size={40} />
        </div>
        <div className="text-center space-y-2">
          <h3 className="text-lg font-bold text-foreground">Nenhuma agenda disponível</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Nenhum closer conectou sua agenda ainda.
          </p>
        </div>
      </div>
    );
  }

  const dateLabel = () => {
    if (viewMode === "day") return format(currentDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    if (viewMode === "week") {
      const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
      const we = endOfWeek(currentDate, { weekStartsOn: 0 });
      if (ws.getMonth() === we.getMonth()) {
        return `${format(ws, "dd", { locale: ptBR })} – ${format(we, "dd 'de' MMM yyyy", { locale: ptBR })}`;
      }
      return `${format(ws, "dd MMM", { locale: ptBR })} – ${format(we, "dd MMM yyyy", { locale: ptBR })}`;
    }
    return `${format(currentDate, "dd MMM", { locale: ptBR })} — ${format(addDays(currentDate, 13), "dd MMM yyyy", { locale: ptBR })}`;
  };

  // ── Positioned event block for grid views ──
  const EventBlock = ({ event, columnCount = 1, columnIndex = 0 }: { event: CalendarEvent; columnCount?: number; columnIndex?: number }) => {
    const start = getEventStart(event);
    const end = getEventEnd(event);
    const startMinutes = getHours(start) * 60 + getMinutes(start);
    const endMinutes = getHours(end) * 60 + getMinutes(end);
    const durationMinutes = Math.max(endMinutes - startMinutes, 15);
    const firstHour = HOURS[0];
    const topPx = ((startMinutes - firstHour * 60) / 60) * HOUR_HEIGHT;
    const heightPx = Math.max((durationMinutes / 60) * HOUR_HEIGHT, 20);
    const color = getEventColor(event.id);
    const meetLink = event.hangoutLink || event.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri;
    const isShort = durationMinutes <= 30;

    const widthPercent = 100 / columnCount;
    const leftPercent = widthPercent * columnIndex;

    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            className={cn(
              "absolute rounded-[4px] px-1.5 py-0.5 text-left overflow-hidden cursor-pointer transition-all border-l-[3px]",
              "hover:brightness-125 hover:shadow-md hover:z-30",
            )}
            style={{
              top: `${topPx}px`,
              height: `${heightPx - 2}px`,
              backgroundColor: color,
              borderLeftColor: `color-mix(in srgb, ${color} 70%, black)`,
              left: `${leftPercent}%`,
              width: `calc(${widthPercent}% - 2px)`,
              zIndex: hoveredEvent === event.id ? 30 : 10,
              opacity: 0.92,
            }}
            onMouseEnter={() => setHoveredEvent(event.id)}
            onMouseLeave={() => setHoveredEvent(null)}
          >
            {isShort ? (
              <span className="text-[10px] font-medium text-white truncate block leading-tight">
                {format(start, "HH:mm")} {event.summary}
              </span>
            ) : (
              <>
                <span className="text-[11px] font-semibold text-white truncate block leading-tight">
                  {event.summary}
                </span>
                <span className="text-[10px] text-white/80 block leading-tight">
                  {format(start, "HH:mm")} – {format(end, "HH:mm")}
                </span>
                {!isShort && event.location && (
                  <span className="text-[9px] text-white/70 block truncate leading-tight mt-0.5">
                    📍 {event.location}
                  </span>
                )}
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start" side="right">
          <div className="p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-3 h-3 rounded-sm shrink-0 mt-1" style={{ backgroundColor: color }} />
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm">{event.summary}</h4>
                <p className="text-xs text-muted-foreground">
                  {format(start, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(start, "HH:mm")} – {format(end, "HH:mm")} ({differenceInMinutes(end, start)}min)
                </p>
              </div>
            </div>

            {event.location && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MapPin size={12} className="shrink-0" />
                <span className="truncate">{event.location}</span>
              </div>
            )}

            {meetLink && (
              <a href={meetLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-primary hover:underline">
                <Video size={12} /> Entrar no Google Meet
              </a>
            )}

            {event.description && (
              <p className="text-xs text-muted-foreground border-t border-border pt-2 line-clamp-3">
                {event.description}
              </p>
            )}

            {event.attendees && event.attendees.length > 0 && (
              <div className="border-t border-border pt-2 space-y-1">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Users size={11} /> {event.attendees.length} participante(s)
                </div>
                <div className="space-y-0.5">
                  {event.attendees.slice(0, 5).map(a => (
                    <div key={a.email} className="flex items-center gap-2 text-[11px]">
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        a.responseStatus === "accepted" ? "bg-accent" :
                        a.responseStatus === "declined" ? "bg-destructive" :
                        a.responseStatus === "tentative" ? "bg-[hsl(38,92%,50%)]" : "bg-muted-foreground"
                      )} />
                      <span className="text-foreground truncate">{a.email}</span>
                    </div>
                  ))}
                  {event.attendees.length > 5 && (
                    <span className="text-[10px] text-muted-foreground">+{event.attendees.length - 5} mais</span>
                  )}
                </div>
              </div>
            )}

            {event.htmlLink && (
              <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-primary hover:underline pt-1">
                <ExternalLink size={11} /> Abrir no Google Calendar
              </a>
            )}
          </div>
        </PopoverContent>
      </Popover>
    );
  };

  // Calculate overlapping events for a day
  const getEventLayout = (dayEvents: CalendarEvent[]) => {
    const sorted = [...dayEvents].sort((a, b) => {
      const aStart = getEventStart(a).getTime();
      const bStart = getEventStart(b).getTime();
      if (aStart !== bStart) return aStart - bStart;
      return getEventEnd(b).getTime() - getEventEnd(a).getTime();
    });

    const layout: { event: CalendarEvent; columnIndex: number; columnCount: number }[] = [];
    const columns: CalendarEvent[][] = [];

    for (const ev of sorted) {
      const evStart = getEventStart(ev).getTime();
      let placed = false;
      for (let col = 0; col < columns.length; col++) {
        const lastInCol = columns[col][columns[col].length - 1];
        if (getEventEnd(lastInCol).getTime() <= evStart) {
          columns[col].push(ev);
          placed = true;
          layout.push({ event: ev, columnIndex: col, columnCount: 0 });
          break;
        }
      }
      if (!placed) {
        columns.push([ev]);
        layout.push({ event: ev, columnIndex: columns.length - 1, columnCount: 0 });
      }
    }

    // Set column count for each event
    for (const item of layout) {
      const evStart = getEventStart(item.event).getTime();
      const evEnd = getEventEnd(item.event).getTime();
      let maxCols = columns.length;
      // Find overlapping group size
      const overlapping = layout.filter(other => {
        const oStart = getEventStart(other.event).getTime();
        const oEnd = getEventEnd(other.event).getTime();
        return oStart < evEnd && oEnd > evStart;
      });
      maxCols = Math.max(...overlapping.map(o => o.columnIndex + 1));
      for (const o of overlapping) {
        o.columnCount = Math.max(o.columnCount, maxCols);
      }
    }

    return layout;
  };

  // ── Current time line ──
  const CurrentTimeLine = () => {
    const now = new Date();
    const minutes = now.getHours() * 60 + now.getMinutes();
    const firstHour = HOURS[0];
    const top = ((minutes - firstHour * 60) / 60) * HOUR_HEIGHT;
    if (top < 0 || top > HOURS.length * HOUR_HEIGHT) return null;

    return (
      <div className="absolute left-0 right-0 z-20 pointer-events-none" style={{ top: `${top}px` }}>
        <div className="flex items-center">
          <div className="w-2 h-2 rounded-full bg-destructive -ml-1" />
          <div className="flex-1 h-[2px] bg-destructive" />
        </div>
      </div>
    );
  };

  // ── WEEK VIEW (Google Calendar style) ──
  const renderWeekView = () => {
    const ws = startOfWeek(currentDate, { weekStartsOn: 0 });
    const days = eachDayOfInterval({ start: ws, end: addDays(ws, 6) });
    const gridHeight = HOURS.length * HOUR_HEIGHT;

    return (
      <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        {/* Header row — sticky */}
        <div className="flex border-b border-border shrink-0">
          <div className="w-12 shrink-0 border-r border-border" />
          {days.map(day => (
            <div key={day.toISOString()} className="flex-1 text-center py-2 border-r border-border last:border-r-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {format(day, "EEEEEE", { locale: ptBR })}
              </div>
              <div className={cn(
                "text-xl font-light mt-0.5 inline-flex items-center justify-center",
                isToday(day)
                  ? "bg-primary text-primary-foreground w-9 h-9 rounded-full"
                  : "text-foreground"
              )}>
                {format(day, "dd")}
              </div>
            </div>
          ))}
        </div>

        {/* Scrollable time grid */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
          <div className="flex relative" style={{ height: `${gridHeight}px` }}>
            {/* Hour labels column */}
            <div className="w-12 shrink-0 relative border-r border-border">
              {HOURS.map((hour, i) => (
                <div key={hour} className="absolute right-2 text-[10px] text-muted-foreground font-medium"
                  style={{ top: `${i * HOUR_HEIGHT - 6}px` }}>
                  {i > 0 ? `${hour.toString().padStart(2, "0")}:00` : ""}
                </div>
              ))}
            </div>

            {/* Day columns */}
            {days.map(day => {
              const dayEvents = filteredEvents.filter(e => isSameDay(getEventStart(e), day));
              const layout = getEventLayout(dayEvents);

              return (
                <div key={day.toISOString()} className="flex-1 relative border-r border-border last:border-r-0">
                  {/* Hour grid lines */}
                  {HOURS.map((hour, i) => (
                    <div key={hour}>
                      <div className="absolute left-0 right-0 border-t border-border/30"
                        style={{ top: `${i * HOUR_HEIGHT}px` }} />
                      <div className="absolute left-0 right-0 border-t border-border/15"
                        style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                    </div>
                  ))}

                  {/* Events — absolutely positioned */}
                  <div className="absolute inset-x-0.5 top-0 bottom-0">
                    {layout.map(({ event, columnIndex, columnCount }) => (
                      <EventBlock key={event.id} event={event} columnCount={columnCount} columnIndex={columnIndex} />
                    ))}
                  </div>

                  {/* Current time indicator */}
                  {isToday(day) && <CurrentTimeLine />}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // ── DAY VIEW ──
  const renderDayView = () => {
    const dayEvents = filteredEvents.filter(e => isSameDay(getEventStart(e), currentDate));
    const layout = getEventLayout(dayEvents);

    const gridHeight = HOURS.length * HOUR_HEIGHT;

    return (
      <div className="border border-border rounded-lg overflow-hidden bg-card flex flex-col" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-none">
          <div className="flex relative" style={{ height: `${gridHeight}px` }}>
            {/* Hour labels */}
            <div className="w-12 shrink-0 relative border-r border-border">
              {HOURS.map((hour, i) => (
                <div key={hour} className="absolute right-2 text-[10px] text-muted-foreground font-medium"
                  style={{ top: `${i * HOUR_HEIGHT - 6}px` }}>
                  {i > 0 ? `${hour.toString().padStart(2, "0")}:00` : ""}
                </div>
              ))}
            </div>

            {/* Day column */}
            <div className="flex-1 relative">
              {HOURS.map((hour, i) => (
                <div key={hour}>
                  <div className="absolute left-0 right-0 border-t border-border/30"
                    style={{ top: `${i * HOUR_HEIGHT}px` }} />
                  <div className="absolute left-0 right-0 border-t border-border/15"
                    style={{ top: `${i * HOUR_HEIGHT + HOUR_HEIGHT / 2}px` }} />
                </div>
              ))}

              <div className="absolute inset-x-1 top-0 bottom-0">
                {layout.map(({ event, columnIndex, columnCount }) => (
                  <EventBlock key={event.id} event={event} columnCount={columnCount} columnIndex={columnIndex} />
                ))}
              </div>

              {isToday(currentDate) && <CurrentTimeLine />}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ── LIST VIEW ──
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
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <CalendarIcon size={32} className="mb-3 opacity-40" />
          <p className="text-sm">Nenhum evento encontrado</p>
        </div>
      );
    }

    return (
      <div className="space-y-1" style={{ height: "calc(100vh - 220px)", minHeight: "500px", overflowY: "auto" }}>
        {Array.from(grouped.entries()).map(([dateKey, dayEvents]) => (
          <div key={dateKey} className="border-b border-border last:border-b-0">
            <div className="grid grid-cols-[80px_1fr] gap-0">
              <div className="py-3 px-2 text-center">
                <div className="text-[10px] uppercase text-muted-foreground font-medium">
                  {format(parseISO(dateKey), "EEE", { locale: ptBR })}
                </div>
                <div className={cn(
                  "text-2xl font-light inline-flex items-center justify-center",
                  isToday(parseISO(dateKey))
                    ? "bg-primary text-primary-foreground w-10 h-10 rounded-full"
                    : "text-foreground"
                )}>
                  {format(parseISO(dateKey), "dd")}
                </div>
              </div>
              <div className="py-2 space-y-0.5">
                {dayEvents.map(ev => {
                  const start = getEventStart(ev);
                  const end = getEventEnd(ev);
                  const color = getEventColor(ev.id);
                  const meetLink = ev.hangoutLink || ev.conferenceData?.entryPoints?.find(e => e.entryPointType === "video")?.uri;

                  return (
                    <div key={ev.id} className="flex items-start gap-3 py-2 px-3 rounded-md hover:bg-secondary/50 transition-colors group cursor-default">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0 mt-1" style={{ backgroundColor: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{ev.summary}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                          <span>{format(start, "HH:mm")} – {format(end, "HH:mm")}</span>
                          {ev.location && (
                            <span className="flex items-center gap-1 truncate">
                              <MapPin size={10} /> {ev.location}
                            </span>
                          )}
                          {meetLink && (
                            <a href={meetLink} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline">
                              <Video size={10} /> Meet
                            </a>
                          )}
                        </div>
                      </div>
                      {ev.htmlLink && (
                        <a href={ev.htmlLink} target="_blank" rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary p-1">
                          <ExternalLink size={12} />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── Top Header ── */}
      <div className="flex items-center justify-between gap-3 px-1 pb-3">
        <div className="flex items-center gap-3">
          {/* Calendar selector */}
          <Select value={selectedCloserId || ""} onValueChange={setSelectedCloserId}>
            <SelectTrigger className="h-9 w-[220px] text-sm border-border bg-card">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {connectedClosersList.map(c => (
                <SelectItem key={c.memberId} value={c.memberId}>
                  <div className="flex items-center gap-2">
                    <span>{c.memberName}</span>
                    {c.memberId === teamMemberId && (
                      <Badge variant="outline" className="text-[9px] h-4 px-1">Você</Badge>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          {isCloser && selectedCloser?.memberId === teamMemberId && (
            <DisconnectCalendarButton onDisconnected={() => {
              setConnected(false);
              setCalendarEmail(null);
              setEvents([]);
              supabase.functions.invoke("google-calendar-events", {
                body: { action: "list_connected_closers" },
              }).then(({ data }) => {
                if (data?.closers) setConnectedClosers(data.closers);
              });
            }} />
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchEvents} title="Atualizar">
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 rounded-full px-4">
                <Plus size={14} /> Novo
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh]">
              <DialogHeader>
                <DialogTitle>Novo evento — {selectedCloser?.memberName}</DialogTitle>
              </DialogHeader>
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
                    <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detalhes..." rows={2} />
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <UserPlus size={14} className="text-primary" />
                      <Label className="text-xs font-semibold">Notificar closers</Label>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 max-h-[100px] overflow-y-auto scrollbar-none">
                      {connectedClosersList.map(m => (
                        <label key={m.memberId} className={cn(
                          "flex items-center gap-2 p-1.5 rounded-md cursor-pointer transition-colors text-xs",
                          selectedMembers.includes(m.memberId) ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground"
                        )}>
                          <Checkbox
                            checked={selectedMembers.includes(m.memberId)}
                            onCheckedChange={(checked) => {
                              setSelectedMembers(prev =>
                                checked ? [...prev, m.memberId] : prev.filter(id => id !== m.memberId)
                              );
                            }}
                            className="h-3.5 w-3.5"
                          />
                          <span className="truncate">{m.memberName}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <Phone size={14} className="text-accent" />
                      <Label className="text-xs font-semibold">Lead (WhatsApp)</Label>
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
                    <Label className="text-xs">Convidados (e-mails)</Label>
                    <Input value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="joao@email.com, maria@email.com" />
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2">
                      <Video size={16} className="text-primary" />
                      <div>
                        <p className="text-xs font-medium text-foreground">Google Meet</p>
                        <p className="text-[10px] text-muted-foreground">Gerar link</p>
                      </div>
                    </div>
                    <Switch checked={addMeet} onCheckedChange={setAddMeet} />
                  </div>

                  <div className="rounded-lg border border-border p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bell size={14} className="text-[hsl(38,92%,50%)]" />
                        <div>
                          <p className="text-xs font-medium text-foreground">Lembretes WhatsApp</p>
                          <p className="text-[10px] text-muted-foreground">Anti-noshow com IA</p>
                        </div>
                      </div>
                      <Switch checked={enableReminders} onCheckedChange={setEnableReminders} />
                    </div>
                    {enableReminders && (
                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {REMINDER_OPTIONS.map(opt => (
                          <label key={opt.value} className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-full text-[10px] cursor-pointer transition-colors border",
                            selectedReminders.includes(opt.value)
                              ? "bg-primary/10 border-primary/30 text-primary"
                              : "border-border text-muted-foreground hover:border-primary/20"
                          )}>
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

      {/* ── Navigation bar ── */}
      <div className="flex items-center justify-between gap-2 px-1 pb-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 px-3 text-xs rounded-full" onClick={goToday}>
            Hoje
          </Button>
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(-1)}>
              <ChevronLeft size={16} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(1)}>
              <ChevronRight size={16} />
            </Button>
          </div>
          <h2 className="text-lg font-normal text-foreground capitalize">
            {dateLabel()}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar..."
              className="h-8 w-40 pl-8 text-xs bg-card border-border rounded-full focus:w-56 transition-all" />
          </div>

          {/* View toggle */}
          <div className="flex items-center bg-secondary rounded-lg p-0.5">
            {([
              { mode: "day" as ViewMode, icon: LayoutGrid, label: "Dia" },
              { mode: "week" as ViewMode, icon: Columns, label: "Semana" },
              { mode: "list" as ViewMode, icon: List, label: "Lista" },
            ]).map(v => (
              <Button key={v.mode} variant="ghost" size="sm"
                className={cn(
                  "h-7 px-2.5 text-xs gap-1.5 rounded-md",
                  viewMode === v.mode ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}
                onClick={() => setViewMode(v.mode)}
              >
                <v.icon size={12} />
                {v.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex items-center justify-center py-16 flex-1">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      ) : (
        <div className="flex-1">
          {viewMode === "day" && renderDayView()}
          {viewMode === "week" && renderWeekView()}
          {viewMode === "list" && renderListView()}
        </div>
      )}

      {/* ── Footer ── */}
      {!loading && (
        <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1 pt-2">
          <span>{filteredEvents.length} evento(s)</span>
          <span className="capitalize">{dateLabel()}</span>
        </div>
      )}
    </div>
  );
}

// ── Disconnect Calendar Button ──
function DisconnectCalendarButton({ onDisconnected }: { onDisconnected: () => void }) {
  const [loading, setLoading] = useState(false);
  const [confirm, setConfirm] = useState(false);

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("google_calendar_tokens")
        .delete()
        .eq("user_id", user.id);
      if (error) throw error;
      toast.success("Google Calendar desconectado!");
      onDisconnected();
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + (err?.message || ""));
    } finally {
      setLoading(false);
      setConfirm(false);
    }
  };

  if (!confirm) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1 text-xs px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={() => setConfirm(true)}
      >
        <X size={12} /> Desconectar
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-destructive">Tem certeza?</span>
      <Button variant="destructive" size="sm" className="h-6 text-[10px] px-2" onClick={handleDisconnect} disabled={loading}>
        {loading ? <Loader2 size={10} className="animate-spin" /> : "Sim"}
      </Button>
      <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => setConfirm(false)}>
        Não
      </Button>
    </div>
  );
}
