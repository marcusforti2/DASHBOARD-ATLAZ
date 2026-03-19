import { useState, useMemo, useCallback } from 'react';
import { LayoutGrid, List, Plus, Trash2, GripVertical, Inbox, Bot, User, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { WaContactTagBadges } from './WaContactTagBadges';
import { LeadDetailModal } from './LeadDetailModal';
import { getAvatarColor, formatCrmDate } from '@/lib/wa-utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  LEAD_STAGES,
  LEAD_STAGE_LABELS,
  CONVERSATION_MODE_LABELS,
  CONVERSATION_MODES,
  PRIORITY_LEVELS,
  PRIORITY_LEVEL_LABELS,
} from '@/domains/conversations/types';
import type { LeadStage, ConversationMode, PriorityLevel } from '@/domains/conversations/types';
import type { WaTag } from '@/hooks/use-wa-tags';
import type { WaConversation, WaInstance } from '@/hooks/use-wa-hub';

interface Props {
  conversations: WaConversation[];
  tags: WaTag[];
  instances: WaInstance[];
  teamMembers: { id: string; name: string; member_role: string }[];
  getTagsForContact: (contactId: string) => { tag_id: string }[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, color: string, isStage: boolean) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
  onRefresh?: () => void;
}

const TAG_COLORS = ['#6b7280', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

const STAGE_COLORS: Record<LeadStage, string> = {
  novo: '#6b7280',
  em_contato: '#0ea5e9',
  qualificado: '#10b981',
  agendado: '#8b5cf6',
  reuniao: '#6366f1',
  proposta: '#f59e0b',
  ganho: '#059669',
  perdido: '#ef4444',
  pausado: '#9ca3af',
};

export function WaCrmView({ conversations, tags, instances, teamMembers, getTagsForContact, onAddTag, onRemoveTag, onCreateTag, onDeleteTag, onRefresh }: Props) {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [filterInstanceId, setFilterInstanceId] = useState<string>('all');
  const [filterInstanceId, setFilterInstanceId] = useState<string>('all');
  const [filterCloserId, setFilterCloserId] = useState<string>('all');
  const [filterSdrId, setFilterSdrId] = useState<string>('all');
  const [showManageTags, setShowManageTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [draggingConvId, setDraggingConvId] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [selectedConv, setSelectedConv] = useState<WaConversation | null>(null);

  const instanceMap = useMemo(() => new Map(instances.map((inst) => [inst.id, inst])), [instances]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.contact.name.toLowerCase().includes(q) || c.contact.phone.includes(q));
    }
    if (filterInstanceId !== 'all') {
      list = list.filter(c => c.instance_id === filterInstanceId);
    }
    if (filterCloserId !== 'all') {
      list = list.filter(c => instanceMap.get(c.instance_id)?.closer_id === filterCloserId);
    }
    if (filterSdrId !== 'all') {
      list = list.filter(c => (instanceMap.get(c.instance_id)?.sdr_id || null) === filterSdrId);
    }
    if (filterTag) {
      list = list.filter(c => {
        const ct = getTagsForContact(c.contact.id);
        return ct.some(t => t.tag_id === filterTag);
      });
    }
    return list;
    return list;
  }, [conversations, search, filterInstanceId, filterCloserId, filterSdrId, filterTag, getTagsForContact, instanceMap]);

  const getConvsForStage = useCallback(
    (stage: LeadStage) => filteredConversations.filter(c => c.lead_stage === stage),
    [filteredConversations]
  );

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await onCreateTag(newTagName.trim(), newTagColor, false);
    setNewTagName('');
  };

  const handleDragStart = (convId: string) => setDraggingConvId(convId);
  const handleDragOver = (e: React.DragEvent, stageId: string) => { e.preventDefault(); setDragOverStage(stageId); };
  const handleDragLeave = () => setDragOverStage(null);

  const handleDrop = async (targetStage: LeadStage) => {
    if (!draggingConvId) return;
    setDragOverStage(null);
    setDraggingConvId(null);

    const conv = conversations.find(c => c.id === draggingConvId);
    if (!conv || conv.lead_stage === targetStage) return;

    const previousStage = conv.lead_stage;
    const now = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('wa_conversations')
      .update({
        lead_stage: targetStage,
        last_stage_changed_at: now,
      } as any)
      .eq('id', conv.id);

    if (updateErr) {
      toast.error('Erro ao mover lead');
      console.error(updateErr);
      return;
    }

    await supabase.from('wa_conversation_state_events' as any).insert({
      conversation_id: conv.id,
      previous_lead_stage: previousStage,
      new_lead_stage: targetStage,
      previous_conversation_mode: conv.conversation_mode,
      new_conversation_mode: conv.conversation_mode,
      previous_priority_level: conv.priority_level,
      new_priority_level: conv.priority_level,
      actor_type: 'human',
      actor_user_id: null,
      actor_team_member_id: null,
      source: 'ui',
      reason: `Kanban: ${LEAD_STAGE_LABELS[previousStage]} → ${LEAD_STAGE_LABELS[targetStage]}`,
      metadata: {},
    } as any);

    toast.success(`Lead movido para ${LEAD_STAGE_LABELS[targetStage]}`);
    onRefresh?.();
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <Input placeholder="Buscar contato..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 text-sm w-56" />

          <div className="ml-auto flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowManageTags(true)}>
              <Plus className="w-3 h-3" /> Gerenciar Tags
            </Button>
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              <button onClick={() => setView('kanban')} className={`p-1.5 ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setView('table')} className={`p-1.5 ${view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}>
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <Select value={filterInstanceId} onValueChange={setFilterInstanceId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Instância" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {instances.map(inst => (
                <SelectItem key={inst.id} value={inst.id}>{inst.instance_name.replace(/^wpp_/i, '')}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterSdrId} onValueChange={setFilterSdrId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="SDR responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os SDRs</SelectItem>
              {teamMembers.filter(member => member.member_role.includes('sdr')).map(member => (
                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterCloserId} onValueChange={setFilterCloserId}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Closer responsável" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os closers</SelectItem>
              {teamMembers.filter(member => member.member_role.includes('closer')).map(member => (
                <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters row */}
        <ScrollArea className="w-full">
          <div className="flex items-center gap-1.5 pb-1">
            {/* Stage filters */}
            <span className="text-[9px] text-muted-foreground font-medium mr-1">Etapa:</span>
            <FilterChip active={!filterStage} onClick={() => setFilterStage(null)}>Todas</FilterChip>
            {LEAD_STAGES.map(s => (
              <FilterChip key={s} active={filterStage === s} onClick={() => setFilterStage(filterStage === s ? null : s)} color={STAGE_COLORS[s]}>
                {LEAD_STAGE_LABELS[s]}
              </FilterChip>
            ))}

            <span className="w-px h-4 bg-border mx-1" />

            {/* Mode filters */}
            <span className="text-[9px] text-muted-foreground font-medium mr-1">Modo:</span>
            <FilterChip active={!filterMode} onClick={() => setFilterMode(null)}>Todos</FilterChip>
            {CONVERSATION_MODES.map(m => (
              <FilterChip key={m} active={filterMode === m} onClick={() => setFilterMode(filterMode === m ? null : m)}>
                {CONVERSATION_MODE_LABELS[m]}
              </FilterChip>
            ))}

            <span className="w-px h-4 bg-border mx-1" />

            {/* Priority filters */}
            <span className="text-[9px] text-muted-foreground font-medium mr-1">Prioridade:</span>
            <FilterChip active={!filterPriority} onClick={() => setFilterPriority(null)}>Todas</FilterChip>
            {PRIORITY_LEVELS.filter(p => p !== 'normal').map(p => (
              <FilterChip key={p} active={filterPriority === p} onClick={() => setFilterPriority(filterPriority === p ? null : p)}>
                {PRIORITY_LEVEL_LABELS[p]}
              </FilterChip>
            ))}

            {/* Tag filter */}
            {tags.length > 0 && (
              <>
                <span className="w-px h-4 bg-border mx-1" />
                <span className="text-[9px] text-muted-foreground font-medium mr-1">Tag:</span>
                <FilterChip active={!filterTag} onClick={() => setFilterTag(null)}>Todas</FilterChip>
                {tags.map(tag => (
                  <FilterChip key={tag.id} active={filterTag === tag.id} onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)} color={tag.color}>
                    {tag.name}
                  </FilterChip>
                ))}
              </>
            )}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 360px)' }}>
          {LEAD_STAGES.map(stage => {
            const stageConvs = getConvsForStage(stage);
            const color = STAGE_COLORS[stage];
            return (
              <KanbanColumn
                key={stage} label={LEAD_STAGE_LABELS[stage]} color={color}
                count={stageConvs.length} stageId={stage} dragOverStage={dragOverStage}
                onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={() => handleDrop(stage)}
              >
                {stageConvs.length === 0 ? (
                  <EmptyColumn />
                ) : (
                  stageConvs.map(conv => (
                    <KanbanCard key={conv.id} conv={conv} stageColor={color} tags={tags} assignedTagIds={getTagsForContact(conv.contact.id).map(t => t.tag_id)} onAddTag={onAddTag} onRemoveTag={onRemoveTag} onDragStart={handleDragStart} onClick={() => setSelectedConv(conv)} instanceLabel={instanceMap.get(conv.instance_id)?.instance_name?.replace(/^wpp_/i, '') || 'Sem instância'} sdrLabel={teamMembers.find(member => member.id === instanceMap.get(conv.instance_id)?.sdr_id)?.name || 'Não vinculado'} closerLabel={teamMembers.find(member => member.id === instanceMap.get(conv.instance_id)?.closer_id)?.name || 'Não vinculado'} />
                  ))
                )}
              </KanbanColumn>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === 'table' && (
        <div className="rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Contato</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Telefone</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Instância</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Responsáveis</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Etapa</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Modo</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Tags</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Última Mensagem</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredConversations.map(conv => (
                <tr key={conv.id} className="border-t border-border hover:bg-muted/30 cursor-pointer" onClick={() => setSelectedConv(conv)}>
                  <td className="px-4 py-2.5 font-medium text-foreground">{conv.contact.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{conv.contact.phone}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{instanceMap.get(conv.instance_id)?.instance_name?.replace(/^wpp_/i, '') || 'Sem instância'}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-col gap-1 text-[11px]">
                      <span className="text-muted-foreground">SDR: {teamMembers.find(member => member.id === instanceMap.get(conv.instance_id)?.sdr_id)?.name || 'Não vinculado'}</span>
                      <span className="text-muted-foreground">Closer: {teamMembers.find(member => member.id === instanceMap.get(conv.instance_id)?.closer_id)?.name || 'Não vinculado'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-1">
                      <SemanticStageBadge stage={conv.lead_stage} />
                      <SemanticPriorityBadge priority={conv.priority_level} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <SemanticModeBadge mode={conv.conversation_mode} />
                  </td>
                  <td className="px-4 py-2.5">
                    <WaContactTagBadges contactId={conv.contact.id} assignedTagIds={getTagsForContact(conv.contact.id).map(t => t.tag_id)} allTags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[200px]">{conv.last_message}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatCrmDate(conv.last_message_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredConversations.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">Nenhum contato encontrado</div>
          )}
        </div>
      )}

      {/* Manage Tags Dialog */}
      <Dialog open={showManageTags} onOpenChange={setShowManageTags}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Gerenciar Tags</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Nova tag" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                <div className="flex gap-1">
                  {TAG_COLORS.map(c => (
                    <button key={c} onClick={() => setNewTagColor(c)} className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? 'border-foreground' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                  ))}
                </div>
              </div>
              <Button size="sm" className="h-8 text-xs" onClick={handleCreateTag}><Plus className="w-3 h-3" /></Button>
            </div>
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-foreground flex-1">{tag.name}</span>
                  <button onClick={() => onDeleteTag(tag.id)} className="text-muted-foreground hover:text-destructive p-1"><Trash2 className="w-3 h-3" /></button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedConv && (
        <LeadDetailModal open={!!selectedConv} onOpenChange={(open) => { if (!open) setSelectedConv(null); }}
          conversation={selectedConv} tags={tags} assignedTagIds={getTagsForContact(selectedConv.contact.id).map(t => t.tag_id)}
          onAddTag={onAddTag} onRemoveTag={onRemoveTag}
        />
      )}
    </div>
  );
}

/* ── Filter Chip ── */
function FilterChip({ active, onClick, color, children }: { active: boolean; onClick: () => void; color?: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`text-[10px] px-2.5 py-1 rounded-full font-medium transition-colors whitespace-nowrap ${
        active ? 'text-white' : 'text-muted-foreground hover:bg-accent'
      }`}
      style={active ? { backgroundColor: color || 'hsl(var(--primary))' } : {}}
    >
      {children}
    </button>
  );
}

/* ── Kanban Column ── */
function KanbanColumn({ label, color, count, stageId, dragOverStage, onDragOver, onDragLeave, onDrop, children }: {
  label: string; color: string; count: number; stageId: string; dragOverStage: string | null;
  onDragOver: (e: React.DragEvent, id: string) => void; onDragLeave: () => void; onDrop: () => void;
  children: React.ReactNode;
}) {
  const isOver = dragOverStage === stageId;
  return (
    <div
      className={`min-w-[260px] max-w-[290px] flex-shrink-0 rounded-xl p-2.5 transition-all ${isOver ? 'ring-2 ring-primary/40 scale-[1.01]' : ''}`}
      style={isOver ? { backgroundColor: `${color}12` } : {}}
      onDragOver={(e) => onDragOver(e, stageId)}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
        <span className="text-xs font-semibold text-foreground">{label}</span>
        <span className="text-[10px] text-muted-foreground ml-auto bg-muted px-1.5 py-0.5 rounded-full font-mono">{count}</span>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

/* ── Empty Column Placeholder ── */
function EmptyColumn() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center opacity-50">
      <Inbox className="w-6 h-6 text-muted-foreground mb-2" />
      <p className="text-[10px] text-muted-foreground">Arraste leads para cá</p>
    </div>
  );
}

/* ── Kanban Card ── */
function KanbanCard({ conv, stageColor, tags, assignedTagIds, onAddTag, onRemoveTag, onDragStart, onClick, instanceLabel, sdrLabel, closerLabel }: {
  conv: WaConversation; stageColor: string; tags: WaTag[]; assignedTagIds: string[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
  onDragStart: (convId: string) => void; onClick?: () => void;
  instanceLabel: string; sdrLabel: string; closerLabel: string;
}) {
  const avatarColor = getAvatarColor(conv.contact.name);

  const timeSince = useMemo(() => {
    if (!conv.last_message_at) return null;
    const diff = Date.now() - new Date(conv.last_message_at).getTime();
    const hours = Math.floor(diff / 3600000);
    if (hours < 1) return null;
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }, [conv.last_message_at]);

  return (
    <div
      draggable
      onDragStart={() => onDragStart(conv.id)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('[data-tag-badge]')) return;
        onClick?.();
      }}
      className="rounded-lg border border-border bg-card p-3 space-y-2 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer active:cursor-grabbing active:opacity-70 active:scale-[0.98]"
      style={{ borderLeftWidth: '3px', borderLeftColor: stageColor }}
    >
      <div className="flex items-center gap-2">
        <GripVertical className="w-3 h-3 text-muted-foreground/30 shrink-0 cursor-grab" />
        <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0" style={{ backgroundColor: `hsl(${avatarColor})` }}>
          {conv.contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{conv.contact.name}</p>
          <p className="text-[9px] text-muted-foreground">{conv.contact.phone}</p>
        </div>
        {timeSince && (
          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
            parseInt(timeSince) > 24 || timeSince.includes('d') ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600'
          }`}>
            ⏰ {timeSince}
          </span>
        )}
      </div>
      {conv.last_message && (
        <p className="text-[10px] text-muted-foreground truncate pl-5">{conv.last_message}</p>
      )}
      {/* Semantic badges */}
      <div className="flex items-center gap-1 pl-5 flex-wrap">
        <SemanticModeBadge mode={conv.conversation_mode} />
        <SemanticPriorityBadge priority={conv.priority_level} />
      </div>
      {/* Auxiliary tags */}
      <div className="pl-5">
        <WaContactTagBadges contactId={conv.contact.id} assignedTagIds={assignedTagIds} allTags={tags} onAdd={onAddTag} onRemove={onRemoveTag} />
      </div>
      <div className="ml-5 rounded-lg bg-muted/40 px-2 py-1.5 space-y-1">
        <p className="text-[10px] text-muted-foreground truncate">Instância: <span className="text-foreground">{instanceLabel}</span></p>
        <p className="text-[10px] text-muted-foreground truncate">SDR: <span className="text-foreground">{sdrLabel}</span></p>
        <p className="text-[10px] text-muted-foreground truncate">Closer: <span className="text-foreground">{closerLabel}</span></p>
      </div>
    </div>
  );
}

/* ── Semantic Badges (CRM) ── */

function SemanticModeBadge({ mode }: { mode?: string | null }) {
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

function SemanticStageBadge({ stage }: { stage?: string | null }) {
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

function SemanticPriorityBadge({ priority }: { priority?: string | null }) {
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
