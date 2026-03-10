import { useState, useEffect, useCallback } from 'react';
import { X, StickyNote, ArrowRightLeft, Clock, Tag, MessageSquare, Send, Loader2, AlertTriangle, TrendingUp, Bell, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WaConversation, WaMessage } from '@/hooks/use-wa-hub';
import type { WaTag } from '@/hooks/use-wa-tags';
import { WaContactTagBadges } from './WaContactTagBadges';

interface Note {
  id: string;
  content: string;
  author_id: string;
  author_name?: string;
  created_at: string;
}

interface TransferLog {
  id: string;
  from_member_name?: string;
  to_member_name?: string;
  from_role: string | null;
  to_role: string;
  note: string;
  created_at: string;
}

interface LeadScore {
  score: number;
  engagement_score: number;
  response_speed_score: number;
  sentiment_score: number;
  risk_level: string;
}

interface Reminder {
  id: string;
  remind_at: string;
  note: string;
  completed: boolean;
  created_by_name?: string;
}

interface TimelineEvent {
  id: string;
  type: 'note' | 'transfer' | 'tag' | 'message_start' | 'reminder';
  content: string;
  date: string;
  meta?: any;
}

interface Props {
  conversation: WaConversation;
  messages: WaMessage[];
  tags: WaTag[];
  assignedTagIds: string[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
  teamMembers: { id: string; name: string; member_role: string }[];
  onClose: () => void;
  onTransfer: (toMemberId: string, toRole: string, note: string) => Promise<void>;
}

import { getAvatarColor, formatDateWithTime } from '@/lib/wa-utils';

function getRiskColor(risk: string) {
  switch (risk) {
    case 'high': return 'text-destructive';
    case 'medium': return 'text-yellow-500';
    default: return 'text-primary';
  }
}

export function WaLeadProfilePanel({ conversation, messages, tags, assignedTagIds, onAddTag, onRemoveTag, teamMembers, onClose, onTransfer }: Props) {
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'timeline' | 'reminders'>('info');
  const [notes, setNotes] = useState<Note[]>([]);
  const [transfers, setTransfers] = useState<TransferLog[]>([]);
  const [score, setScore] = useState<LeadScore | null>(null);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTo, setTransferTo] = useState('');
  const [transferRole, setTransferRole] = useState('closer');
  const [transferNote, setTransferNote] = useState('');
  const [transferring, setTransferring] = useState(false);
  const [newReminderDate, setNewReminderDate] = useState('');
  const [newReminderNote, setNewReminderNote] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);

  const contactId = conversation.contact.id;
  const convId = conversation.id;

  const fetchData = useCallback(async () => {
    const [{ data: notesData }, { data: transfersData }, { data: scoreData }, { data: remindersData }] = await Promise.all([
      supabase.from('wa_notes').select('*').eq('contact_id', contactId).order('created_at', { ascending: false }),
      supabase.from('wa_transfer_logs').select('*').eq('conversation_id', convId).order('created_at', { ascending: false }),
      supabase.from('wa_lead_scores').select('*').eq('contact_id', contactId).maybeSingle(),
      supabase.from('wa_follow_up_reminders').select('*').eq('conversation_id', convId).order('remind_at', { ascending: true }),
    ]);

    // Enrich with team member names
    const enrichedNotes = (notesData ?? []).map((n: any) => ({
      ...n,
      author_name: teamMembers.find(m => m.id === n.author_id)?.name || 'Desconhecido',
    }));
    const enrichedTransfers = (transfersData ?? []).map((t: any) => ({
      ...t,
      from_member_name: teamMembers.find(m => m.id === t.from_member_id)?.name || '—',
      to_member_name: teamMembers.find(m => m.id === t.to_member_id)?.name || '—',
    }));
    const enrichedReminders = (remindersData ?? []).map((r: any) => ({
      ...r,
      created_by_name: teamMembers.find(m => m.id === r.created_by)?.name || '—',
    }));

    setNotes(enrichedNotes);
    setTransfers(enrichedTransfers);
    setScore(scoreData as LeadScore | null);
    setReminders(enrichedReminders);
  }, [contactId, convId, teamMembers]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSavingNote(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('team_member_id').eq('id', (await supabase.auth.getUser()).data.user?.id || '').single();
      if (!profile?.team_member_id) { toast.error('Perfil não vinculado'); return; }

      await supabase.from('wa_notes').insert({
        contact_id: contactId,
        conversation_id: convId,
        author_id: profile.team_member_id,
        content: newNote.trim(),
      } as any);
      setNewNote('');
      fetchData();
      toast.success('Nota adicionada');
    } catch { toast.error('Erro ao salvar nota'); }
    finally { setSavingNote(false); }
  };

  const handleTransfer = async () => {
    if (!transferTo) { toast.error('Selecione o destinatário'); return; }
    setTransferring(true);
    try {
      await onTransfer(transferTo, transferRole, transferNote);
      setShowTransfer(false);
      setTransferTo('');
      setTransferNote('');
      fetchData();
    } catch { toast.error('Erro na transferência'); }
    finally { setTransferring(false); }
  };

  const handleAddReminder = async () => {
    if (!newReminderDate) { toast.error('Selecione a data'); return; }
    setSavingReminder(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('team_member_id').eq('id', (await supabase.auth.getUser()).data.user?.id || '').single();
      if (!profile?.team_member_id) { toast.error('Perfil não vinculado'); return; }

      await supabase.from('wa_follow_up_reminders').insert({
        conversation_id: convId,
        contact_id: contactId,
        created_by: profile.team_member_id,
        remind_at: new Date(newReminderDate).toISOString(),
        note: newReminderNote,
      } as any);
      setNewReminderDate('');
      setNewReminderNote('');
      fetchData();
      toast.success('Lembrete criado');
    } catch { toast.error('Erro ao criar lembrete'); }
    finally { setSavingReminder(false); }
  };

  const handleCompleteReminder = async (id: string) => {
    await supabase.from('wa_follow_up_reminders').update({ completed: true, completed_at: new Date().toISOString() } as any).eq('id', id);
    fetchData();
    toast.success('Lembrete concluído');
  };

  // Build timeline
  const timeline: TimelineEvent[] = [
    ...notes.map(n => ({ id: n.id, type: 'note' as const, content: `📝 ${n.author_name}: ${n.content}`, date: n.created_at })),
    ...transfers.map(t => ({ id: t.id, type: 'transfer' as const, content: `🔄 ${t.from_member_name} → ${t.to_member_name} (${t.to_role})${t.note ? `: ${t.note}` : ''}`, date: t.created_at })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const firstMsgDate = messages.length > 0 ? messages[0].created_at : null;
  const lastMsgDate = messages.length > 0 ? messages[messages.length - 1].created_at : null;
  const totalMsgsContact = messages.filter(m => m.sender === 'contact').length;
  const totalMsgsAgent = messages.filter(m => m.sender === 'agent').length;

  const tabs = [
    { key: 'info', label: 'Perfil', icon: TrendingUp },
    { key: 'notes', label: 'Notas', icon: StickyNote },
    { key: 'timeline', label: 'Timeline', icon: Clock },
    { key: 'reminders', label: 'Lembretes', icon: Bell },
  ] as const;

  return (
    <div className="w-80 border-l border-border bg-card flex flex-col shrink-0">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center gap-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: `hsl(${getAvatarColor(conversation.contact.name)})` }}>
          {conversation.contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{conversation.contact.name}</p>
          <p className="text-[10px] text-muted-foreground">{conversation.contact.phone}</p>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Lead Score */}
      {score && (
        <div className="px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold text-foreground">Lead Score</span>
            <span className={`text-lg font-bold ${score.score >= 70 ? 'text-primary' : score.score >= 40 ? 'text-yellow-500' : 'text-destructive'}`}>
              {score.score}
            </span>
            <AlertTriangle className={`w-3.5 h-3.5 ml-auto ${getRiskColor(score.risk_level)}`} />
            <span className={`text-[10px] font-medium ${getRiskColor(score.risk_level)}`}>
              {score.risk_level === 'high' ? 'Alto risco' : score.risk_level === 'medium' ? 'Médio' : 'Baixo risco'}
            </span>
          </div>
          <div className="flex gap-1">
            {[
              { label: 'Engajamento', val: score.engagement_score },
              { label: 'Velocidade', val: score.response_speed_score },
              { label: 'Sentimento', val: score.sentiment_score },
            ].map(s => (
              <div key={s.label} className="flex-1 text-center">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${s.val}%` }} />
                </div>
                <span className="text-[8px] text-muted-foreground">{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tags */}
      <div className="px-4 py-2 border-b border-border">
        <WaContactTagBadges contactId={contactId} assignedTagIds={assignedTagIds} allTags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
      </div>

      {/* Transfer button */}
      <div className="px-4 py-2 border-b border-border">
        <button onClick={() => setShowTransfer(!showTransfer)} className="w-full text-xs flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 font-medium transition-colors">
          <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir conversa
        </button>
        {showTransfer && (
          <div className="mt-2 space-y-2 animate-fade-in">
            <select value={transferTo} onChange={e => setTransferTo(e.target.value)} className="w-full text-xs rounded-lg bg-secondary text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring">
              <option value="">Selecione...</option>
              {teamMembers.map(m => (
                <option key={m.id} value={m.id}>{m.name} ({m.member_role})</option>
              ))}
            </select>
            <div className="flex gap-1">
              {['sdr', 'closer'].map(r => (
                <button key={r} onClick={() => setTransferRole(r)} className={`flex-1 text-[10px] py-1 rounded-lg font-medium transition-colors ${transferRole === r ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  {r.toUpperCase()}
                </button>
              ))}
            </div>
            <input value={transferNote} onChange={e => setTransferNote(e.target.value)} placeholder="Motivo (opcional)" className="w-full text-xs rounded-lg bg-secondary text-foreground px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
            <button onClick={handleTransfer} disabled={transferring} className="w-full text-xs py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 font-medium flex items-center justify-center gap-1">
              {transferring ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />} Transferir
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`flex-1 text-[10px] py-2 flex items-center justify-center gap-1 font-medium transition-colors ${activeTab === t.key ? 'border-b-2 border-primary text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
            <t.icon className="w-3 h-3" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'info' && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <InfoCard label="Msgs recebidas" value={String(totalMsgsContact)} />
              <InfoCard label="Msgs enviadas" value={String(totalMsgsAgent)} />
              <InfoCard label="Primeira msg" value={firstMsgDate ? new Date(firstMsgDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'} />
              <InfoCard label="Última msg" value={lastMsgDate ? new Date(lastMsgDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : '—'} />
            </div>
            <InfoCard label="Status" value={conversation.status} />
            <InfoCard label="Atribuído a" value={
              conversation.assigned_to
                ? teamMembers.find(m => m.id === conversation.assigned_to)?.name || '—'
                : 'Não atribuído'
            } />
            <InfoCard label="Total de notas" value={String(notes.length)} />
            <InfoCard label="Transferências" value={String(transfers.length)} />
          </div>
        )}

        {activeTab === 'notes' && (
          <div className="space-y-3">
            <div className="flex gap-1.5">
              <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Adicionar nota..." className="flex-1 text-xs rounded-lg bg-secondary text-foreground px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
              <button onClick={handleAddNote} disabled={savingNote || !newNote.trim()} className="p-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50">
                {savingNote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhuma nota ainda</p>
            ) : (
              notes.map(note => (
                <div key={note.id} className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                  <p className="text-xs text-foreground whitespace-pre-wrap">{note.content}</p>
                  <p className="text-[9px] text-muted-foreground">{note.author_name} · {formatDateWithTime(note.created_at)}</p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-2">
            {timeline.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum evento</p>
            ) : (
              timeline.map(evt => (
                <div key={evt.id} className="flex gap-2">
                  <div className="w-1 rounded-full bg-border shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs text-foreground">{evt.content}</p>
                    <p className="text-[9px] text-muted-foreground">{formatDateWithTime(evt.date)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'reminders' && (
          <div className="space-y-3">
            <div className="space-y-1.5">
              <input type="datetime-local" value={newReminderDate} onChange={e => setNewReminderDate(e.target.value)} className="w-full text-xs rounded-lg bg-secondary text-foreground px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring" />
              <input value={newReminderNote} onChange={e => setNewReminderNote(e.target.value)} placeholder="Nota do lembrete..." className="w-full text-xs rounded-lg bg-secondary text-foreground px-3 py-1.5 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring" />
              <button onClick={handleAddReminder} disabled={savingReminder || !newReminderDate} className="w-full text-xs py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 font-medium flex items-center justify-center gap-1">
                {savingReminder ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bell className="w-3 h-3" />} Criar lembrete
              </button>
            </div>
            {reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum lembrete</p>
            ) : (
              reminders.map(r => (
                <div key={r.id} className={`rounded-lg p-2.5 space-y-1 ${r.completed ? 'bg-muted/30 opacity-60' : 'bg-muted/50'}`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium text-foreground">{new Date(r.remind_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
                    {!r.completed && (
                      <button onClick={() => handleCompleteReminder(r.id)} className="text-primary hover:text-primary/80">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {r.note && <p className="text-xs text-muted-foreground">{r.note}</p>}
                  <p className="text-[9px] text-muted-foreground">por {r.created_by_name}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/50 px-3 py-2">
      <p className="text-[9px] text-muted-foreground">{label}</p>
      <p className="text-xs font-semibold text-foreground">{value}</p>
    </div>
  );
}
