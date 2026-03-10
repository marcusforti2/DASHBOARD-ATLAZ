import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Bot, BotOff, CheckCheck, Phone, Mail, Building2, DollarSign,
  Calendar, ExternalLink, Loader2, TrendingUp, AlertTriangle,
  User, MessageSquare, Clock, Briefcase
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WaConversation } from '@/hooks/use-wa-hub';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';

interface PipedriveData {
  person: {
    name: string;
    email: string | null;
    phone: string | null;
    org_name: string | null;
    owner_name: string | null;
  } | null;
  deals: {
    title: string;
    value: number | null;
    currency: string | null;
    status: string | null;
    stage_name: string | null;
    pipeline_name: string | null;
    pipedrive_id: number;
  }[];
  activities: {
    subject: string | null;
    type: string | null;
    due_date: string | null;
    done: boolean | null;
  }[];
  notes: {
    content: string | null;
    created_at: string;
  }[];
}

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

import { getAvatarColor } from '@/lib/wa-utils';

function getRiskBadge(risk: string) {
  switch (risk) {
    case 'high': return { label: 'Alto Risco', className: 'bg-destructive/15 text-destructive border-destructive/30' };
    case 'medium': return { label: 'Médio', className: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' };
    default: return { label: 'Baixo Risco', className: 'bg-primary/15 text-primary border-primary/30' };
  }
}

export function LeadDetailModal({ open, onOpenChange, conversation, tags, assignedTagIds, onAddTag, onRemoveTag }: Props) {
  const [pipedriveData, setPipedriveData] = useState<PipedriveData | null>(null);
  const [leadScore, setLeadScore] = useState<LeadScore | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [togglingAi, setTogglingAi] = useState(false);
  const [doubleChecking, setDoubleChecking] = useState(false);
  const [msgStats, setMsgStats] = useState({ contact: 0, agent: 0, first: '', last: '' });

  const contactId = conversation.contact.id;
  const contactPhone = conversation.contact.phone;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      // Fetch in parallel: Pipedrive person, lead score, messages stats, conversation status
      const [personResult, scoreResult, msgsResult, convResult] = await Promise.all([
        supabase.from('pipedrive_persons').select('*').eq('wa_contact_id', contactId).maybeSingle(),
        supabase.from('wa_lead_scores').select('*').eq('contact_id', contactId).maybeSingle(),
        supabase.from('wa_messages').select('sender, created_at').eq('conversation_id', conversation.id).order('created_at', { ascending: true }),
        supabase.from('wa_conversations').select('lead_status').eq('id', conversation.id).single(),
      ]);

      // Determine AI status from lead_status
      const blockedStatuses = ['agendado', 'urgente'];
      setAiEnabled(!blockedStatuses.includes(convResult.data?.lead_status || ''));

      // Message stats
      const msgs = msgsResult.data || [];
      setMsgStats({
        contact: msgs.filter(m => m.sender === 'contact').length,
        agent: msgs.filter(m => m.sender === 'agent').length,
        first: msgs[0]?.created_at || '',
        last: msgs[msgs.length - 1]?.created_at || '',
      });

      // Score
      setLeadScore(scoreResult.data as LeadScore | null);

      // Pipedrive enrichment
      if (personResult.data) {
        const person = personResult.data;
        const pipedriveId = person.pipedrive_id;

        const [dealsResult, activitiesResult, notesResult] = await Promise.all([
          supabase.from('pipedrive_deals').select('title, value, currency, status, stage_name, pipeline_name, pipedrive_id').eq('person_id', pipedriveId).order('created_at', { ascending: false }).limit(5),
          supabase.from('pipedrive_activities').select('subject, type, due_date, done').eq('person_pipedrive_id', pipedriveId).order('due_date', { ascending: false }).limit(5),
          supabase.from('pipedrive_notes').select('content, created_at').eq('person_pipedrive_id', pipedriveId).order('created_at', { ascending: false }).limit(3),
        ]);

        setPipedriveData({
          person: {
            name: person.name,
            email: person.email,
            phone: person.phone,
            org_name: person.org_name,
            owner_name: person.owner_name,
          },
          deals: dealsResult.data || [],
          activities: activitiesResult.data || [],
          notes: notesResult.data || [],
        });
      } else {
        // Try finding by phone
        const cleanPhone = contactPhone.replace(/\D/g, '');
        const { data: personByPhone } = await supabase.from('pipedrive_persons').select('*').ilike('phone', `%${cleanPhone.slice(-8)}%`).maybeSingle();

        if (personByPhone) {
          const [dealsResult, activitiesResult, notesResult] = await Promise.all([
            supabase.from('pipedrive_deals').select('title, value, currency, status, stage_name, pipeline_name, pipedrive_id').eq('person_id', personByPhone.pipedrive_id).order('created_at', { ascending: false }).limit(5),
            supabase.from('pipedrive_activities').select('subject, type, due_date, done').eq('person_pipedrive_id', personByPhone.pipedrive_id).order('due_date', { ascending: false }).limit(5),
            supabase.from('pipedrive_notes').select('content, created_at').eq('person_pipedrive_id', personByPhone.pipedrive_id).order('created_at', { ascending: false }).limit(3),
          ]);

          setPipedriveData({
            person: {
              name: personByPhone.name,
              email: personByPhone.email,
              phone: personByPhone.phone,
              org_name: personByPhone.org_name,
              owner_name: personByPhone.owner_name,
            },
            deals: dealsResult.data || [],
            activities: activitiesResult.data || [],
            notes: notesResult.data || [],
          });
        } else {
          setPipedriveData(null);
        }
      }
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
      const newStatus = aiEnabled ? 'agendado' : 'em_contato';
      await supabase.from('wa_conversations').update({ lead_status: newStatus }).eq('id', conversation.id);
      setAiEnabled(!aiEnabled);
      toast.success(aiEnabled ? 'IA desligada para este lead' : 'IA religada para este lead');
    } catch {
      toast.error('Erro ao alterar status da IA');
    } finally {
      setTogglingAi(false);
    }
  };

  const handleDoubleCheck = async () => {
    setDoubleChecking(true);
    try {
      // Force AI to re-analyze the conversation
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

  const avatarColor = getAvatarColor(conversation.contact.name);
  const risk = leadScore ? getRiskBadge(leadScore.risk_level) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden max-h-[85vh]">
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
              {pipedriveData?.person?.email && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3 h-3" />
                  {pipedriveData.person.email}
                </p>
              )}
              {pipedriveData?.person?.org_name && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                  <Building2 className="w-3 h-3" />
                  {pipedriveData.person.org_name}
                </p>
              )}
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

        {/* Action Buttons */}
        <div className="px-5 py-3 flex items-center gap-3">
          {/* AI Toggle */}
          <div className="flex items-center gap-2 flex-1">
            <div className={`p-1.5 rounded-lg ${aiEnabled ? 'bg-primary/15 text-primary' : 'bg-destructive/15 text-destructive'}`}>
              {aiEnabled ? <Bot className="w-4 h-4" /> : <BotOff className="w-4 h-4" />}
            </div>
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">{aiEnabled ? 'IA Ativa' : 'IA Desligada'}</p>
              <p className="text-[9px] text-muted-foreground">{aiEnabled ? 'SDR IA respondendo' : 'Atendimento manual'}</p>
            </div>
            <Switch checked={aiEnabled} onCheckedChange={handleToggleAi} disabled={togglingAi} />
          </div>

          <Separator orientation="vertical" className="h-8" />

          {/* Double Check */}
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs gap-1.5 shrink-0"
            onClick={handleDoubleCheck}
            disabled={doubleChecking}
          >
            {doubleChecking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
            Double-check
          </Button>
        </div>

        <Separator />

        {/* Tags */}
        <div className="px-5 py-2.5">
          <WaContactTagBadges
            contactId={contactId}
            assignedTagIds={assignedTagIds}
            allTags={tags}
            onAdd={onAddTag}
            onRemove={onRemoveTag}
          />
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

              {/* Pipedrive Section */}
              {pipedriveData ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Briefcase className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Pipedrive</span>
                    {pipedriveData.person?.owner_name && (
                      <Badge variant="secondary" className="text-[9px] ml-auto">
                        <User className="w-2.5 h-2.5 mr-1" />
                        {pipedriveData.person.owner_name}
                      </Badge>
                    )}
                  </div>

                  {/* Deals */}
                  {pipedriveData.deals.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Negócios</p>
                      {pipedriveData.deals.map((deal, i) => (
                        <div key={i} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
                          <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{deal.title}</p>
                            <p className="text-[9px] text-muted-foreground">
                              {deal.pipeline_name} → {deal.stage_name}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs font-bold text-foreground">{formatCurrency(deal.value, deal.currency)}</p>
                            <Badge variant="outline" className={`text-[8px] ${deal.status === 'won' ? 'text-primary border-primary/30' : deal.status === 'lost' ? 'text-destructive border-destructive/30' : 'text-foreground border-border'}`}>
                              {deal.status === 'won' ? 'Ganho' : deal.status === 'lost' ? 'Perdido' : 'Aberto'}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Activities */}
                  {pipedriveData.activities.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Atividades recentes</p>
                      {pipedriveData.activities.slice(0, 3).map((act, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs">
                          <Calendar className="w-3 h-3 text-muted-foreground shrink-0" />
                          <span className="text-foreground flex-1 truncate">{act.subject || act.type}</span>
                          <span className="text-[9px] text-muted-foreground">{act.due_date ? formatDate(act.due_date) : ''}</span>
                          {act.done && <CheckCheck className="w-3 h-3 text-primary" />}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Notes from Pipedrive */}
                  {pipedriveData.notes.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Notas CRM</p>
                      {pipedriveData.notes.map((note, i) => (
                        <div key={i} className="rounded-lg bg-muted/40 px-3 py-2">
                          <p className="text-[10px] text-foreground line-clamp-3" dangerouslySetInnerHTML={{ __html: note.content || '' }} />
                          <p className="text-[8px] text-muted-foreground mt-1">{formatDate(note.created_at)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4 rounded-lg bg-muted/30">
                  <Briefcase className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">Lead não encontrado no Pipedrive</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">O contato será vinculado automaticamente na próxima interação da IA</p>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
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
