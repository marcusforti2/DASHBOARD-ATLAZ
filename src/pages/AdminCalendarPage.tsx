import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Calendar as CalendarIcon, Plus, RefreshCw, Loader2, Clock, MapPin, Users,
  ExternalLink, CheckCircle2, XCircle, ChevronDown, ChevronUp, Trash2, Phone,
  MessageCircle, Sparkles
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

interface Attendee {
  name: string;
  email: string;
  phone: string;
  type: "closer" | "client";
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

  // Attendees with WhatsApp
  const [attendees, setAttendees] = useState<Attendee[]>([]);
  const [sendWhatsApp, setSendWhatsApp] = useState(true);
  const [sendingWhatsApp, setSendingWhatsApp] = useState(false);

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

  const addAttendee = () => {
    setAttendees(prev => [...prev, { name: "", email: "", phone: "", type: "client" }]);
  };

  const updateAttendee = (index: number, field: keyof Attendee, value: string) => {
    setAttendees(prev => prev.map((a, i) => i === index ? { ...a, [field]: value } : a));
  };

  const removeAttendee = (index: number) => {
    setAttendees(prev => prev.filter((_, i) => i !== index));
  };

  const handleCreateEvent = async () => {
    if (!newTitle || !newStartDate || !createForUserId) {
      toast.error("Preencha título e data");
      return;
    }
    setCreating(true);
    try {
      const emails = attendees.filter(a => a.email).map(a => a.email);

      // 1. Create Google Calendar event
      const { data, error } = await supabase.functions.invoke("google-calendar-events", {
        body: {
          action: "create",
          targetUserId: createForUserId,
          summary: newTitle,
          description: newDescription,
          startDateTime: `${newStartDate}T${newStartTime}:00`,
          endDateTime: `${newStartDate}T${newEndTime}:00`,
          attendees: emails,
        },
      });
      if (error) throw error;
      toast.success("Evento criado no Google Calendar!");

      // 2. Send WhatsApp confirmations
      const attendeesWithPhone = attendees.filter(a => a.phone && a.name);
      if (sendWhatsApp && attendeesWithPhone.length > 0) {
        setSendingWhatsApp(true);
        try {
          const { data: whatsData, error: whatsError } = await supabase.functions.invoke("event-whatsapp-confirm", {
            body: {
              attendees: attendeesWithPhone,
              event: {
                title: newTitle,
                date: newStartDate,
                startTime: newStartTime,
                endTime: newEndTime,
                description: newDescription,
                organizerName: createForName,
              },
            },
          });
          if (whatsError) throw whatsError;
          const results = whatsData?.results || [];
          const sent = results.filter((r: any) => r.success).length;
          const failed = results.filter((r: any) => !r.success).length;
          if (sent > 0) toast.success(`📱 ${sent} confirmação(ões) enviada(s) via WhatsApp`);
          if (failed > 0) toast.error(`${failed} envio(s) falharam`);
        } catch (e) {
          console.error("WhatsApp error:", e);
          toast.error("Erro ao enviar confirmações WhatsApp");
        } finally {
          setSendingWhatsApp(false);
        }
      }

      setDialogOpen(false);
      resetForm();
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
    setNewStartDate("");
    setNewStartTime("09:00");
    setNewEndTime("10:00");
    setAttendees([]);
    setSendWhatsApp(true);
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
                          <a href={event.htmlLink} target="_blank" rel="noopener noreferrer"
                            className="p-1 rounded text-muted-foreground hover:text-primary shrink-0">
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Criar evento para <span className="text-primary">{createForName}</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Event details */}
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
            </div>

            {/* Attendees section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <Users size={12} /> Convidados
                </Label>
                <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={addAttendee}>
                  <Plus size={10} /> Adicionar
                </Button>
              </div>

              {attendees.length === 0 && (
                <p className="text-[10px] text-muted-foreground text-center py-2">
                  Nenhum convidado adicionado
                </p>
              )}

              {attendees.map((att, idx) => (
                <Card key={idx} className="border-dashed">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant={att.type === "closer" ? "default" : "secondary"} className="text-[9px] h-5">
                          {att.type === "closer" ? "🏢 Closer" : "👤 Cliente"}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Select value={att.type} onValueChange={v => updateAttendee(idx, "type", v)}>
                          <SelectTrigger className="h-6 text-[10px] w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="closer" className="text-xs">Closer</SelectItem>
                            <SelectItem value="client" className="text-xs">Cliente</SelectItem>
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => removeAttendee(idx)}>
                          <Trash2 size={10} />
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <Input
                        placeholder="Nome"
                        value={att.name}
                        onChange={e => updateAttendee(idx, "name", e.target.value)}
                        className="h-8 text-xs"
                      />
                      <Input
                        placeholder="E-mail"
                        value={att.email}
                        onChange={e => updateAttendee(idx, "email", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone size={10} className="text-muted-foreground shrink-0" />
                      <Input
                        placeholder="WhatsApp (ex: 11999998888)"
                        value={att.phone}
                        onChange={e => updateAttendee(idx, "phone", e.target.value)}
                        className="h-8 text-xs"
                      />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* WhatsApp toggle */}
            {attendees.some(a => a.phone) && (
              <div className="flex items-center justify-between p-3 rounded-lg bg-accent/5 border border-accent/20">
                <div className="flex items-center gap-2">
                  <MessageCircle size={14} className="text-accent" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Enviar confirmação via WhatsApp</p>
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Sparkles size={8} /> Mensagem gerada por IA para cada convidado
                    </p>
                  </div>
                </div>
                <Switch checked={sendWhatsApp} onCheckedChange={setSendWhatsApp} />
              </div>
            )}

            <Button
              onClick={handleCreateEvent}
              disabled={creating || sendingWhatsApp}
              className="w-full gap-2"
            >
              {creating || sendingWhatsApp ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              {sendingWhatsApp
                ? "Enviando WhatsApp..."
                : creating
                ? "Criando evento..."
                : attendees.some(a => a.phone) && sendWhatsApp
                ? "Criar Evento + Enviar WhatsApp"
                : "Criar Evento"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
