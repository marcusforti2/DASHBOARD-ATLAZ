import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar as CalendarIcon, Plus, RefreshCw, Link2, Loader2, Clock, MapPin, Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, parseISO, addHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: { email: string; responseStatus?: string }[];
  htmlLink?: string;
  location?: string;
}

export function GoogleCalendarPanel() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [calendarEmail, setCalendarEmail] = useState<string | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  // New event form
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newAttendees, setNewAttendees] = useState("");

  const checkConnection = useCallback(async () => {
    const { data } = await supabase
      .from("google_calendar_tokens")
      .select("calendar_email")
      .maybeSingle();
    
    setConnected(!!data);
    setCalendarEmail(data?.calendar_email || null);
    return !!data;
  }, []);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: { action: "list" },
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
  }, []);

  useEffect(() => {
    checkConnection().then(isConnected => {
      if (isConnected) fetchEvents();
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
        // Poll for connection
        const interval = setInterval(async () => {
          const isConnected = await checkConnection();
          if (isConnected) {
            clearInterval(interval);
            setConnecting(false);
            toast.success("Google Calendar conectado!");
            fetchEvents();
          }
        }, 3000);
        setTimeout(() => {
          clearInterval(interval);
          setConnecting(false);
        }, 120000);
      }
    } catch (e) {
      console.error("Connect error:", e);
      toast.error("Erro ao conectar com Google Calendar");
      setConnecting(false);
    }
  };

  const handleCreateEvent = async () => {
    if (!newTitle || !newStartDate) {
      toast.error("Preencha título e data");
      return;
    }
    setCreating(true);
    try {
      const startDateTime = `${newStartDate}T${newStartTime}:00`;
      const endDateTime = `${newStartDate}T${newEndTime}:00`;
      const attendees = newAttendees
        .split(",")
        .map(e => e.trim())
        .filter(e => e.includes("@"));

      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: {
          action: "create",
          summary: newTitle,
          description: newDescription,
          startDateTime,
          endDateTime,
          attendees,
        },
      });
      if (error) throw error;
      toast.success("Evento criado no Google Calendar!");
      setDialogOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewAttendees("");
      fetchEvents();
    } catch (e) {
      console.error("Create event error:", e);
      toast.error("Erro ao criar evento");
    } finally {
      setCreating(false);
    }
  };

  const formatEventTime = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    const end = event.end.dateTime || event.end.date;
    if (!start) return "";
    try {
      const startDate = parseISO(start);
      if (event.start.dateTime) {
        const endDate = end ? parseISO(end) : addHours(startDate, 1);
        return `${format(startDate, "dd/MM · HH:mm")} — ${format(endDate, "HH:mm")}`;
      }
      return format(startDate, "dd/MM/yyyy");
    } catch {
      return start;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case "accepted": return "text-accent";
      case "declined": return "text-destructive";
      case "tentative": return "text-[hsl(38,92%,50%)]";
      default: return "text-muted-foreground";
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  const today = format(new Date(), "yyyy-MM-dd");

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CalendarIcon size={20} className="text-primary" />
          <div>
            <h3 className="text-sm font-bold text-foreground">Google Calendar</h3>
            {calendarEmail && (
              <p className="text-[10px] text-muted-foreground">{calendarEmail}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={fetchEvents} className="h-8 gap-1.5 text-xs">
            <RefreshCw size={12} /> Atualizar
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5 text-xs">
                <Plus size={12} /> Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Evento</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Título *</Label>
                  <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Reunião com cliente" />
                </div>
                <div>
                  <Label className="text-xs">Data *</Label>
                  <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} min={today} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Início</Label>
                    <Input type="time" value={newStartTime} onChange={e => setNewStartTime(e.target.value)} />
                  </div>
                  <div>
                    <Label className="text-xs">Fim</Label>
                    <Input type="time" value={newEndTime} onChange={e => setNewEndTime(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">Descrição</Label>
                  <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detalhes da reunião..." rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Convidados (e-mails separados por vírgula)</Label>
                  <Input value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="joao@email.com, maria@email.com" />
                </div>
                <Button onClick={handleCreateEvent} disabled={creating} className="w-full gap-2">
                  {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                  {creating ? "Criando..." : "Criar Evento"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Events */}
      {events.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <CalendarIcon className="mx-auto text-muted-foreground mb-2" size={24} />
            <p className="text-sm text-muted-foreground">Nenhum evento nos próximos 7 dias</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {events.map(event => (
            <Card key={event.id} className="hover:bg-card/80 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0 space-y-1">
                    <h4 className="text-sm font-semibold text-foreground truncate">{event.summary}</h4>
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock size={10} />
                        {formatEventTime(event)}
                      </span>
                      {event.location && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <MapPin size={10} />
                          <span className="truncate max-w-[150px]">{event.location}</span>
                        </span>
                      )}
                    </div>
                    {event.attendees && event.attendees.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Users size={10} />
                        <span>{event.attendees.length} convidado(s)</span>
                        {event.attendees.slice(0, 3).map(a => (
                          <span key={a.email} className={`text-[10px] ${getStatusColor(a.responseStatus)}`}>
                            {a.email.split("@")[0]}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {event.htmlLink && (
                    <a
                      href={event.htmlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors shrink-0"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
