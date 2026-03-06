import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon, Plus, RefreshCw, Loader2, Clock, MapPin, Users,
  ExternalLink, CheckCircle2, XCircle, ChevronDown, ChevronUp
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { format, parseISO, addHours } from "date-fns";

interface MemberConnection {
  memberId: string;
  memberName: string;
  memberRole: string;
  userId: string | null;
  connected: boolean;
  calendarEmail: string | null;
  connectedAt: string | null;
}

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

export default function AdminCalendarPage() {
  const [connections, setConnections] = useState<MemberConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [memberEvents, setMemberEvents] = useState<Record<string, CalendarEvent[]>>({});
  const [loadingEvents, setLoadingEvents] = useState<string | null>(null);

  // Create event state
  const [createForUserId, setCreateForUserId] = useState<string | null>(null);
  const [createForName, setCreateForName] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("09:00");
  const [newEndTime, setNewEndTime] = useState("10:00");
  const [newAttendees, setNewAttendees] = useState("");

  const fetchConnections = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: { action: "list_connections" },
      });
      if (error) throw error;
      setConnections(data?.connections || []);
    } catch (e) {
      console.error("Error fetching connections:", e);
      toast.error("Erro ao carregar conexões");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchConnections(); }, [fetchConnections]);

  const fetchMemberEvents = async (userId: string, memberId: string) => {
    if (expandedMember === memberId) {
      setExpandedMember(null);
      return;
    }
    setExpandedMember(memberId);
    setLoadingEvents(memberId);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: { action: "list", targetUserId: userId },
      });
      if (error) throw error;
      setMemberEvents(prev => ({ ...prev, [memberId]: data?.events || [] }));
    } catch (e) {
      console.error("Error fetching events:", e);
      toast.error("Erro ao carregar eventos");
    } finally {
      setLoadingEvents(null);
    }
  };

  const handleCreateEvent = async () => {
    if (!newTitle || !newStartDate || !createForUserId) {
      toast.error("Preencha título e data");
      return;
    }
    setCreating(true);
    try {
      const attendees = newAttendees.split(",").map(e => e.trim()).filter(e => e.includes("@"));
      const { error } = await supabase.functions.invoke("google-calendar-events", {
        body: {
          action: "create",
          targetUserId: createForUserId,
          summary: newTitle,
          description: newDescription,
          startDateTime: `${newStartDate}T${newStartTime}:00`,
          endDateTime: `${newStartDate}T${newEndTime}:00`,
          attendees,
        },
      });
      if (error) throw error;
      toast.success(`Evento criado na agenda de ${createForName}!`);
      setDialogOpen(false);
      resetForm();
      // Refresh events for this member
      const conn = connections.find(c => c.userId === createForUserId);
      if (conn) fetchMemberEvents(createForUserId, conn.memberId);
    } catch (e) {
      console.error("Create event error:", e);
      toast.error("Erro ao criar evento");
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setNewTitle("");
    setNewDescription("");
    setNewAttendees("");
    setNewStartDate("");
    setNewStartTime("09:00");
    setNewEndTime("10:00");
  };

  const openCreateDialog = (userId: string, name: string) => {
    setCreateForUserId(userId);
    setCreateForName(name);
    resetForm();
    setDialogOpen(true);
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

  const connectedCount = connections.filter(c => c.connected).length;
  const today = format(new Date(), "yyyy-MM-dd");

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <CalendarIcon size={20} className="text-primary" />
            Agendas Google Calendar
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {connectedCount} de {connections.length} membros conectados
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchConnections} className="h-8 gap-1.5 text-xs">
          <RefreshCw size={12} /> Atualizar
        </Button>
      </div>

      {/* Status Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Card className="bg-accent/10 border-accent/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-accent">{connectedCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Conectados</p>
          </CardContent>
        </Card>
        <Card className="bg-destructive/10 border-destructive/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-destructive">{connections.length - connectedCount}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendentes</p>
          </CardContent>
        </Card>
        <Card className="bg-primary/10 border-primary/30">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-primary">{connections.length}</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
          </CardContent>
        </Card>
      </div>

      {/* Members list */}
      <div className="space-y-2">
        {connections.map(conn => (
          <Card key={conn.memberId} className="overflow-hidden">
            <CardContent className="p-0">
              {/* Member header */}
              <div className="flex items-center justify-between p-3">
                <div className="flex items-center gap-3 min-w-0">
                  {conn.connected ? (
                    <CheckCircle2 size={16} className="text-accent shrink-0" />
                  ) : (
                    <XCircle size={16} className="text-destructive shrink-0" />
                  )}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground truncate">{conn.memberName}</span>
                      <Badge variant="outline" className="text-[9px] h-4">
                        {conn.memberRole === "closer" ? "Closer" : conn.memberRole === "sdr" ? "SDR" : conn.memberRole}
                      </Badge>
                    </div>
                    {conn.connected ? (
                      <p className="text-[10px] text-muted-foreground">{conn.calendarEmail}</p>
                    ) : (
                      <p className="text-[10px] text-destructive/70">Ainda não conectou o Google Calendar</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {conn.connected && conn.userId && (
                    <>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-[10px] gap-1"
                        onClick={() => openCreateDialog(conn.userId!, conn.memberName)}
                      >
                        <Plus size={10} /> Evento
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => fetchMemberEvents(conn.userId!, conn.memberId)}
                      >
                        {loadingEvents === conn.memberId ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : expandedMember === conn.memberId ? (
                          <ChevronUp size={12} />
                        ) : (
                          <ChevronDown size={12} />
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded events */}
              {expandedMember === conn.memberId && conn.userId && (
                <div className="border-t border-border bg-secondary/30 p-3 space-y-2">
                  {loadingEvents === conn.memberId ? (
                    <div className="flex justify-center py-4">
                      <Loader2 size={16} className="animate-spin text-primary" />
                    </div>
                  ) : (memberEvents[conn.memberId] || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento nos próximos 7 dias</p>
                  ) : (
                    (memberEvents[conn.memberId] || []).map(event => (
                      <div key={event.id} className="flex items-start justify-between gap-2 p-2 rounded-lg bg-card border border-border">
                        <div className="min-w-0 space-y-0.5">
                          <h4 className="text-xs font-semibold text-foreground truncate">{event.summary}</h4>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                              <Clock size={8} />
                              {formatEventTime(event)}
                            </span>
                            {event.location && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <MapPin size={8} />
                                <span className="truncate max-w-[120px]">{event.location}</span>
                              </span>
                            )}
                            {event.attendees && (
                              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <Users size={8} />
                                {event.attendees.length}
                              </span>
                            )}
                          </div>
                        </div>
                        {event.htmlLink && (
                          <a
                            href={event.htmlLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-muted-foreground hover:text-primary shrink-0"
                          >
                            <ExternalLink size={10} />
                          </a>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Criar evento para <span className="text-primary">{createForName}</span>
            </DialogTitle>
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
              <Textarea value={newDescription} onChange={e => setNewDescription(e.target.value)} placeholder="Detalhes..." rows={2} />
            </div>
            <div>
              <Label className="text-xs">Convidados (e-mails separados por vírgula)</Label>
              <Input value={newAttendees} onChange={e => setNewAttendees(e.target.value)} placeholder="joao@email.com" />
            </div>
            <Button onClick={handleCreateEvent} disabled={creating} className="w-full gap-2">
              {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              {creating ? "Criando..." : "Criar Evento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
