import { useState, useMemo } from 'react';
import { Loader2, Search, Bot, User, AlertTriangle } from 'lucide-react';
import { WaConversation, WaInstance } from '@/hooks/use-wa-hub';
import { WaContactTagBadges } from './WaContactTagBadges';
import { getAvatarColor, formatSmartTime } from '@/lib/wa-utils';
import {
  LEAD_STAGE_LABELS,
  CONVERSATION_MODE_LABELS,
  PRIORITY_LEVEL_LABELS,
  LEAD_STAGES,
  PRIORITY_LEVELS,
} from '@/domains/conversations/types';
import type { ConversationMode, LeadStage, PriorityLevel } from '@/domains/conversations/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { WaTag } from '@/hooks/use-wa-tags';
interface Props {
  conversations: WaConversation[];
  instances: WaInstance[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  instanceFilter: string | null;
  onInstanceFilter: (id: string | null) => void;
  title?: string;
  tags?: WaTag[];
  getTagsForContact?: (contactId: string) => { tag_id: string }[];
  onAddTag?: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag?: (contactId: string, tagId: string) => Promise<void>;
}

const MODE_FILTERS: { value: ConversationMode | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'ia_ativa', label: '🤖 IA' },
  { value: 'humano_assumiu', label: '👤 Humano' },
  { value: 'compartilhado', label: '🤝 Compart.' },
  { value: 'pausado', label: '⏸ Pausado' },
];

const STAGE_FILTERS: { value: LeadStage | null; label: string }[] = [
  { value: null, label: 'Todos' },
  ...LEAD_STAGES.map(s => ({ value: s, label: LEAD_STAGE_LABELS[s] })),
];

const PRIORITY_FILTERS: { value: PriorityLevel | null; label: string }[] = [
  { value: null, label: 'Todos' },
  { value: 'atento', label: '⚠ Atento' },
  { value: 'urgente', label: '🔴 Urgente' },
];

export function WaConversationList({
  conversations, instances, loading, selectedId,
  onSelect, instanceFilter, onInstanceFilter, title = 'Conversas',
  tags, getTagsForContact, onAddTag, onRemoveTag,
}: Props) {
  const [search, setSearch] = useState('');
  const [modeFilter, setModeFilter] = useState<ConversationMode | null>(null);
  const [stageFilter, setStageFilter] = useState<LeadStage | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<PriorityLevel | null>(null);

  const filtered = useMemo(() => {
    let list = conversations;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.contact.name.toLowerCase().includes(q) ||
        c.contact.phone.includes(q) ||
        c.last_message?.toLowerCase().includes(q)
      );
    }
    if (modeFilter) {
      list = list.filter(c => c.conversation_mode === modeFilter);
    }
    if (stageFilter) {
      list = list.filter(c => c.lead_stage === stageFilter);
    }
    if (priorityFilter) {
      list = list.filter(c => c.priority_level === priorityFilter);
    }
    return list;
  }, [conversations, search, modeFilter, stageFilter, priorityFilter]);

  return (
    <div className="w-80 border-r border-border flex flex-col bg-card shrink-0">
      <div className="px-4 py-3 border-b border-border space-y-2">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar nome, telefone..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg bg-secondary text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {/* Instance filter */}
        <div className="flex gap-1 flex-wrap">
          <button onClick={() => onInstanceFilter(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              !instanceFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}>Todas</button>
          {instances.map(inst => (
            <button key={inst.id} onClick={() => onInstanceFilter(inst.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                instanceFilter === inst.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>{inst.instance_name.replace(/^wpp_/i, '')}</button>
          ))}
        </div>
        {/* Mode filter */}
        <div className="flex gap-1 flex-wrap">
          {MODE_FILTERS.map(mf => (
            <button key={mf.value ?? 'all'} onClick={() => setModeFilter(mf.value)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                modeFilter === mf.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>{mf.label}</button>
          ))}
        </div>
        {/* Lead stage filter */}
        <div className="flex gap-1 flex-wrap">
          {STAGE_FILTERS.slice(0, 6).map(sf => (
            <button key={sf.value ?? 'all-stage'} onClick={() => setStageFilter(sf.value)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                stageFilter === sf.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>{sf.label}</button>
          ))}
        </div>
        {/* Priority filter */}
        <div className="flex gap-1 flex-wrap">
          {PRIORITY_FILTERS.map(pf => (
            <button key={pf.value ?? 'all-prio'} onClick={() => setPriorityFilter(pf.value)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                priorityFilter === pf.value ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}>{pf.label}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="text-sm text-muted-foreground">{search || modeFilter || stageFilter || priorityFilter ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => {
            const hoursSince = conv.last_message_at
              ? Math.floor((Date.now() - new Date(conv.last_message_at).getTime()) / 3600000)
              : 0;

            return (
              <button key={conv.id} onClick={() => onSelect(conv.id)}
                className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 ${
                  selectedId === conv.id ? 'bg-accent' : 'hover:bg-muted/50'
                }`}
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                    style={{ backgroundColor: `hsl(${getAvatarColor(conv.contact.name)})` }}>
                    {conv.contact.name.charAt(0).toUpperCase()}
                  </div>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-foreground truncate">
                      {conv.contact.name === conv.contact.phone
                        ? conv.contact.phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, '($1) $2-$3')
                        : conv.contact.name}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      {hoursSince >= 4 && (
                        <span className={`text-[8px] px-1 py-0.5 rounded ${hoursSince >= 24 ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600'}`}>
                          {hoursSince >= 24 ? `${Math.floor(hoursSince / 24)}d` : `${hoursSince}h`}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">{formatSmartTime(conv.last_message_at)}</span>
                    </div>
                  </div>
                  <p className={`text-xs truncate ${conv.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {conv.last_message}
                  </p>
                  {/* Semantic badges */}
                  <div className="flex items-center gap-1 mt-1 flex-wrap">
                    <ConversationModeBadge mode={conv.conversation_mode} />
                    <LeadStageBadge stage={conv.lead_stage} />
                    <PriorityBadge priority={conv.priority_level} />
                  </div>
                  {tags && getTagsForContact && (
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <WaContactTagBadges contactId={conv.contact.id} assignedTagIds={getTagsForContact(conv.contact.id).map(t => t.tag_id)}
                        allTags={tags} onAdd={onAddTag || (async () => {})} onRemove={onRemoveTag || (async () => {})} compact />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ── Semantic Badges ── */

function ConversationModeBadge({ mode }: { mode?: string | null }) {
  if (!mode) return null;
  const label = CONVERSATION_MODE_LABELS[mode as keyof typeof CONVERSATION_MODE_LABELS];
  if (!label) return null;
  const styles: Record<string, string> = {
    ia_ativa: 'bg-primary/15 text-primary',
    humano_assumiu: 'bg-amber-500/15 text-amber-600',
    compartilhado: 'bg-violet-500/15 text-violet-600',
    pausado: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full font-medium ${styles[mode] || 'bg-muted text-muted-foreground'}`}>
      {mode === 'ia_ativa' || mode === 'compartilhado' ? <Bot className="w-2 h-2" /> : <User className="w-2 h-2" />}
      {label}
    </span>
  );
}

function LeadStageBadge({ stage }: { stage?: string | null }) {
  if (!stage || stage === 'novo') return null;
  const label = LEAD_STAGE_LABELS[stage as keyof typeof LEAD_STAGE_LABELS];
  if (!label) return null;
  const styles: Record<string, string> = {
    em_contato: 'bg-sky-500/15 text-sky-600',
    qualificado: 'bg-emerald-500/15 text-emerald-600',
    agendado: 'bg-violet-500/15 text-violet-600',
    reuniao: 'bg-indigo-500/15 text-indigo-600',
    proposta: 'bg-amber-500/15 text-amber-600',
    ganho: 'bg-emerald-600/15 text-emerald-700',
    perdido: 'bg-destructive/15 text-destructive',
    pausado: 'bg-muted text-muted-foreground',
  };
  return (
    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${styles[stage] || 'bg-muted text-muted-foreground'}`}>
      {label}
    </span>
  );
}

function PriorityBadge({ priority }: { priority?: string | null }) {
  if (!priority || priority === 'normal') return null;
  const isUrgent = priority === 'urgente';
  return (
    <span className={`inline-flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded-full font-medium ${
      isUrgent ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600'
    }`}>
      {isUrgent && <AlertTriangle className="w-2 h-2" />}
      {PRIORITY_LEVEL_LABELS[priority as keyof typeof PRIORITY_LEVEL_LABELS] || priority}
    </span>
  );
}
