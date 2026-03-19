import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Bot, BotOff, CheckCheck, Phone, Mail, Building2, DollarSign,
  Calendar, ExternalLink, Loader2, TrendingUp, AlertTriangle,
  User, MessageSquare, Clock, Briefcase, History, Linkedin, Search, Save
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import type { WaConversation } from '@/hooks/use-wa-hub';
import type { ConversationMode, LeadStage, PriorityLevel, WaConversationStateEvent } from '@/domains/conversations/types';
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_LABELS,
  CONVERSATION_MODE_LABELS,
} from '@/domains/conversations/types';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';
import { getAvatarColor } from '@/lib/wa-utils';



interface LeadScore {
  score: number;
  engagement_score: number;
  response_speed_score: number;
  sentiment_score: number;
  risk_level: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: WaConversation;
  tags: WaTag[];
  assignedTagIds: string[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
}

function getRiskBadge(risk: string) {
  switch (risk) {
    case 'high': return { label: 'Alto Risco', className: 'bg-destructive/15 text-destructive border-destructive/30' };
    case 'medium': return { label: 'Médio', className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' };
    default: return { label: 'Baixo Risco', className: 'bg-primary/15 text-primary border-primary/30' };
  }
}

export function LeadDetailModal({ open, onOpenChange, conversation, tags, assignedTagIds, onAddTag, onRemoveTag }: Props) {
  const { profile } = useAuth();
  
  const [leadScore, setLeadScore] = useState<LeadScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [togglingAi, setTogglingAi] = useState(false);
  const [doubleChecking, setDoubleChecking] = useState(false);
  const [msgStats, setMsgStats] = useState({ contact: 0, agent: 0, first: '', last: '' });
  const [stateEvents, setStateEvents] = useState<WaConversationStateEvent[]>([]);
  const [linkedinContext, setLinkedinContext] = useState('');
  const [linkedinProfile, setLinkedinProfile] = useState<any>(null);
  const [savingContext, setSavingContext] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [convSnapshot, setConvSnapshot] = useState<{
    conversation_mode: ConversationMode;
    lead_stage: LeadStage;
    priority_level: PriorityLevel;
  }>({ conversation_mode: 'ia_ativa', lead_stage: 'novo', priority_level: 'normal' });

  const contactId = conversation.contact.id;
  const contactPhone = conversation.contact.phone;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [scoreResult, msgsResult, convResult, eventsResult] = await Promise.all([
        supabase.from('wa_lead_scores').select('*').eq('contact_id', contactId).maybeSingle(),
        supabase.from('wa_messages').select('sender, created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: true }),
        supabase.from('wa_conversations').select('conversation_mode, lead_stage, priority_level, linkedin_context, linkedin_profile').eq('id', conversation.id).single(),
        supabase.from('wa_conversation_state_events').select('*').eq('conversation_id', conversation.id).order('created_at', { ascending: false }).limit(20),
      ]);

      const convData = convResult.data;
      const snapshot = {
        conversation_mode: (convData?.conversation_mode as ConversationMode) || 'ia_ativa',
        lead_stage: (convData?.lead_stage as LeadStage) || 'novo',
        priority_level: (convData?.priority_level as PriorityLevel) || 'normal',
      };
      setConvSnapshot(snapshot);
      setLinkedinContext((convData as any)?.linkedin_context || '');
      setLinkedinProfile((convData as any)?.linkedin_profile && Object.keys((convData as any).linkedin_profile).length > 0 ? (convData as any).linkedin_profile : null);
      setAiEnabled(snapshot.conversation_mode === 'ia_ativa' || snapshot.conversation_mode === 'compartilhado');

      setStateEvents((eventsResult.data || []) as unknown as WaConversationStateEvent[]);

      const msgs = msgsResult.data || [];
      setMsgStats({
        contact: msgs.filter(m => m.sender === 'contact').length,
        agent: msgs.filter(m => m.sender === 'agent').length,
        first: msgs[0]?.created_at || '',
        last: msgs[msgs.length - 1]?.created_at || '',
      });

      setLeadScore(scoreResult.data as LeadScore | null);

    } catch (err) {
      console.error('Error fetching lead data:', err);
    } finally {
      setLoading(false);
    }
  }, [contactId, contactPhone, conversation.id]);

  useEffect(() => {
    if (open) fetchData();
  }, [open, fetchData]);

  const handleToggleAi = async () => {
    setTogglingAi(true);
    try {
      const now = new Date().toISOString();
      const newMode: ConversationMode = aiEnabled ? 'humano_assumiu' : 'ia_ativa';

      const updatePayload: Record<string, unknown> = {
        conversation_mode: newMode,
        last_mode_changed_at: now,
      };

      if (newMode === 'humano_assumiu') {
        updatePayload.human_takeover_at = now;
        updatePayload.handoff_reason = 'Manual toggle via LeadDetailModal';
      } else {
        updatePayload.human_takeover_at = null;
        updatePayload.handoff_reason = null;
      }

      await supabase.from('wa_conversations').update(updatePayload).eq('id', conversation.id);

      await supabase.from('wa_conversation_state_events').insert({
        conversation_id: conversation.id,
        previous_conversation_mode: convSnapshot.conversation_mode,
        new_conversation_mode: newMode,
        previous_lead_stage: convSnapshot.lead_stage,
        new_lead_stage: convSnapshot.lead_stage,
        previous_priority_level: convSnapshot.priority_level,
        new_priority_level: convSnapshot.priority_level,
        actor_type: 'human' as const,
        actor_team_member_id: profile?.team_member_id ?? null,
        source: 'ui' as const,
        reason: aiEnabled ? 'Humano assumiu via LeadDetailModal' : 'IA reativada via LeadDetailModal',
        metadata: {},
      });

      setConvSnapshot(prev => ({ ...prev, conversation_mode: newMode }));
      setAiEnabled(!aiEnabled);
      toast.success(aiEnabled ? 'IA desligada para este lead' : 'IA religada para este lead');
      fetchData(); // refresh timeline
    } catch {
      toast.error('Erro ao alterar status da IA');
    } finally {
      setTogglingAi(false);
    }
  };

  const handleChangeLeadStage = async (newStage: LeadStage) => {
    if (newStage === convSnapshot.lead_stage) return;
    try {
      const now = new Date().toISOString();
      await supabase.from('wa_conversations').update({
        lead_stage: newStage,
        last_stage_changed_at: now,
      }).eq('id', conversation.id);

      await supabase.from('wa_conversation_state_events').insert({
        conversation_id: conversation.id,
        previous_lead_stage: convSnapshot.lead_stage,
        new_lead_stage: newStage,
        previous_conversation_mode: convSnapshot.conversation_mode,
        new_conversation_mode: convSnapshot.conversation_mode, // unchanged
        previous_priority_level: convSnapshot.priority_level,
        new_priority_level: convSnapshot.priority_level, // unchanged
        actor_type: 'human' as const,
        actor_team_member_id: profile?.team_member_id ?? null,
        source: 'ui' as const,
        reason: `Estágio alterado manualmente: ${LEAD_STAGE_LABELS[convSnapshot.lead_stage]} → ${LEAD_STAGE_LABELS[newStage]}`,
        metadata: {},
      });

      setConvSnapshot(prev => ({ ...prev, lead_stage: newStage }));
      toast.success(`Estágio alterado para ${LEAD_STAGE_LABELS[newStage]}`);
      fetchData();
    } catch {
      toast.error('Erro ao alterar estágio');
    }
  };

  const handleChangePriority = async (newPriority: PriorityLevel) => {
    if (newPriority === convSnapshot.priority_level) return;
    try {
      await supabase.from('wa_conversations').update({
        priority_level: newPriority,
      }).eq('id', conversation.id);

      await supabase.from('wa_conversation_state_events').insert({
        conversation_id: conversation.id,
        previous_priority_level: convSnapshot.priority_level,
        new_priority_level: newPriority,
        previous_lead_stage: convSnapshot.lead_stage,
        new_lead_stage: convSnapshot.lead_stage, // unchanged
        previous_conversation_mode: convSnapshot.conversation_mode,
        new_conversation_mode: convSnapshot.conversation_mode, // unchanged
        actor_type: 'human' as const,
        actor_team_member_id: profile?.team_member_id ?? null,
        source: 'ui' as const,
        reason: `Prioridade alterada manualmente: ${PRIORITY_LEVEL_LABELS[convSnapshot.priority_level]} → ${PRIORITY_LEVEL_LABELS[newPriority]}`,
        metadata: {},
      });

      setConvSnapshot(prev => ({ ...prev, priority_level: newPriority }));
      toast.success(`Prioridade alterada para ${PRIORITY_LEVEL_LABELS[newPriority]}`);
      fetchData();
    } catch {
      toast.error('Erro ao alterar prioridade');
    }
  };

  const handleDoubleCheck = async () => {
    setDoubleChecking(true);
    try {
      const { error } = await supabase.functions.invoke('ai-sdr-agent', {
        body: {
          conversation_id: conversation.id,
          instance_id: conversation.instance_id,
          force: true,
          double_check: true,
        },
      });
      if (error) throw error;
      toast.success('Double-check realizado! A IA reanalisou a conversa.');
      fetchData();
    } catch (err) {
      console.error('Double check error:', err);
      toast.error('Erro no double-check');
    } finally {
      setDoubleChecking(false);
    }
  };

  const formatCurrency = (val: number | null, cur: string | null) => {
    if (!val) return '—';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cur || 'BRL' }).format(val);
  };

  const formatDate = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const formatDateTime = (d: string) => {
    if (!d) return '—';
    return new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const avatarColor = getAvatarColor(conversation.contact.name);
  const risk = leadScore ? getRiskBadge(leadScore.risk_level) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="relative px-5 pt-5 pb-4 bg-gradient-to-br from-card to-muted/30">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg shrink-0"
              style={{ backgroundColor: `hsl(${avatarColor})` }}
            >
              {conversation.contact.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-bold text-foreground truncate">{conversation.contact.name}</h2>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                <Phone className="w-3 h-3" />
                {conversation.contact.phone}
              </p>
            </div>
          </div>

          {/* Lead Score + Risk */}
          {leadScore && (
            <div className="mt-3 flex items-center gap-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                <span className={`text-xl font-bold ${leadScore.score >= 70 ? 'text-primary' : leadScore.score >= 40 ? 'text-yellow-500' : 'text-destructive'}`}>
                  {leadScore.score}
                </span>
                <span className="text-[10px] text-muted-foreground">pts</span>
              </div>
              {risk && (
                <Badge variant="outline" className={`text-[10px] ${risk.className}`}>
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {risk.label}
                </Badge>
              )}
              <div className="flex gap-2 ml-auto">
                {[
                  { label: 'Engaj.', val: leadScore.engagement_score },
                  { label: 'Veloc.', val: leadScore.response_speed_score },
                  { label: 'Sentim.', val: leadScore.sentiment_score },
                ].map(s => (
                  <div key={s.label} className="text-center w-14">
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70 transition-all" style={{ width: `${s.val}%` }} />
                    </div>
                    <span className="text-[8px] text-muted-foreground">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <Separator />

        {/* Semantic Controls: Lead Stage + Priority */}
        <div className="px-5 py-3 grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Estágio</label>
            <Select value={convSnapshot.lead_stage} onValueChange={(v) => handleChangeLeadStage(v as LeadStage)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LEAD_STAGES.map(s => (
                  <SelectItem key={s} value={s} className="text-xs">{LEAD_STAGE_LABELS[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">Prioridade</label>
            <Select value={convSnapshot.priority_level} onValueChange={(v) => handleChangePriority(v as PriorityLevel)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRIORITY_LEVELS.map(p => (
                  <SelectItem key={p} value={p} className="text-xs">{PRIORITY_LEVEL_LABELS[p]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator />

        {/* Action Buttons */}
        <div className="px-5 py-3 flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <div className={`p-1.5 rounded-lg ${aiEnabled ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>
              {aiEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">{aiEnabled ? 'IA Ativa' : 'IA Desligada'}</p>
              <p className="text-[9px] text-muted-foreground">
                {aiEnabled ? 'SDR IA respondendo' : 'Atendimento manual'}
                {convSnapshot.conversation_mode !== 'ia_ativa' && convSnapshot.conversation_mode !== 'humano_assumiu' && (
                  <> · {CONVERSATION_MODE_LABELS[convSnapshot.conversation_mode]}</>
                )}
              </p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={handleToggleAi} disabled={togglingAi} />
          </div>

          <Separator orientation="vertical" className="h-8" />

          <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5 shrink-0" onClick={handleDoubleCheck} disabled={doubleChecking}>
            {doubleChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Double-check
          </Button>
        </div>

        <Separator />

        {/* Tags */}
        <div className="px-5 py-2.5">
          <WaContactTagBadges contactId={contactId} assignedTagIds={assignedTagIds} allTags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
        </div>

        <Separator />

        {/* Content Area */}
        <div className="px-5 py-3 overflow-y-auto max-h-[40vh] space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* Quick Stats */}
              <div className="grid grid-cols-4 gap-2">
                <StatCard icon={MessageSquare} label="Recebidas" value={String(msgStats.contact)} />
                <StatCard icon={MessageSquare} label="Enviadas" value={String(msgStats.agent)} />
                <StatCard icon={Clock} label="Primeira" value={msgStats.first ? formatDate(msgStats.first) : '—'} />
                <StatCard icon={Clock} label="Última" value={msgStats.last ? formatDate(msgStats.last) : '—'} />
              </div>

              {/* State Events Timeline */}
              {stateEvents.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <History className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Histórico de mudanças</span>
                  </div>
                  <div className="space-y-1.5 max-h-[160px] overflow-y-auto">
                    {stateEvents.map(evt => (
                      <div key={evt.id} className="flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] text-foreground leading-tight">
                            {evt.reason || describeStateEvent(evt)}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[8px] text-muted-foreground">{formatDateTime(evt.created_at)}</span>
                            <Badge variant="secondary" className="text-[7px] px-1 py-0">
                              {evt.actor_type === 'human' ? '👤' : evt.actor_type === 'ai' ? '🤖' : '⚙️'} {evt.source}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function describeStateEvent(evt: WaConversationStateEvent): string {
  const parts: string[] = [];
  if (evt.previous_lead_stage !== evt.new_lead_stage) {
    parts.push(`Estágio: ${LEAD_STAGE_LABELS[evt.previous_lead_stage!] || '—'} → ${LEAD_STAGE_LABELS[evt.new_lead_stage!] || '—'}`);
  }
  if (evt.previous_conversation_mode !== evt.new_conversation_mode) {
    parts.push(`Modo: ${CONVERSATION_MODE_LABELS[evt.previous_conversation_mode!] || '—'} → ${CONVERSATION_MODE_LABELS[evt.new_conversation_mode!] || '—'}`);
  }
  if (evt.previous_priority_level !== evt.new_priority_level) {
    parts.push(`Prioridade: ${PRIORITY_LEVEL_LABELS[evt.previous_priority_level!] || '—'} → ${PRIORITY_LEVEL_LABELS[evt.new_priority_level!] || '—'}`);
  }
  return parts.join(' · ') || 'Atualização de estado';
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-lg bg-muted/40 px-2.5 py-2 text-center">
      <Icon className="w-3 h-3 text-muted-foreground mx-auto mb-0.5" />
      <p className="text-xs font-bold text-foreground">{value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}
