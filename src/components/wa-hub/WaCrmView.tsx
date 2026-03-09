import { useState, useMemo } from 'react';
import { LayoutGrid, List, Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';
import type { WaConversation } from '@/hooks/use-wa-hub';

interface Props {
  conversations: WaConversation[];
  tags: WaTag[];
  getTagsForContact: (contactId: string) => { tag_id: string }[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
  onCreateTag: (name: string, color: string, isStage: boolean) => Promise<void>;
  onDeleteTag: (id: string) => Promise<void>;
}

const TAG_COLORS = ['#6b7280', '#3b82f6', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4'];

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export function WaCrmView({ conversations, tags, getTagsForContact, onAddTag, onRemoveTag, onCreateTag, onDeleteTag }: Props) {
  const [view, setView] = useState<'kanban' | 'table'>('kanban');
  const [search, setSearch] = useState('');
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [showManageTags, setShowManageTags] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#3b82f6');
  const [newTagIsStage, setNewTagIsStage] = useState(true);

  const stageTags = useMemo(() => tags.filter(t => t.is_stage), [tags]);
  const nonStageTags = useMemo(() => tags.filter(t => !t.is_stage), [tags]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.contact.name.toLowerCase().includes(q) || c.contact.phone.includes(q));
    }
    if (filterTag) {
      list = list.filter(c => {
        const ct = getTagsForContact(c.contact.id);
        return ct.some(t => t.tag_id === filterTag);
      });
    }
    return list;
  }, [conversations, search, filterTag, getTagsForContact]);

  const getConvsForStage = (tagId: string) => {
    return filteredConversations.filter(c => {
      const ct = getTagsForContact(c.contact.id);
      return ct.some(t => t.tag_id === tagId);
    });
  };

  const untaggedConvs = filteredConversations.filter(c => {
    const ct = getTagsForContact(c.contact.id);
    return ct.length === 0 || !ct.some(t => stageTags.find(st => st.id === t.tag_id));
  });

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    await onCreateTag(newTagName.trim(), newTagColor, newTagIsStage);
    setNewTagName('');
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="Buscar contato..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="h-8 text-sm w-56"
        />
        <div className="flex items-center gap-1">
          <button
            onClick={() => setFilterTag(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              !filterTag ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Todas
          </button>
          {tags.map(tag => (
            <button
              key={tag.id}
              onClick={() => setFilterTag(filterTag === tag.id ? null : tag.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                filterTag === tag.id ? 'text-white' : 'text-muted-foreground hover:bg-accent'
              }`}
              style={filterTag === tag.id ? { backgroundColor: tag.color } : {}}
            >
              {tag.name}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowManageTags(true)}>
            <Plus className="w-3 h-3" /> Gerenciar Tags
          </Button>
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            <button
              onClick={() => setView('kanban')}
              className={`p-1.5 ${view === 'kanban' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setView('table')}
              className={`p-1.5 ${view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Kanban View */}
      {view === 'kanban' && (
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 'calc(100vh - 320px)' }}>
          {/* Untagged column */}
          <div className="min-w-[240px] max-w-[280px] flex-shrink-0">
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="w-2.5 h-2.5 rounded-full bg-muted-foreground/30" />
              <span className="text-xs font-semibold text-muted-foreground">Sem etapa</span>
              <span className="text-[10px] text-muted-foreground ml-auto">{untaggedConvs.length}</span>
            </div>
            <div className="space-y-2">
              {untaggedConvs.map(conv => (
                <KanbanCard
                  key={conv.id}
                  conv={conv}
                  tags={tags}
                  assignedTagIds={getTagsForContact(conv.contact.id).map(t => t.tag_id)}
                  onAddTag={onAddTag}
                  onRemoveTag={onRemoveTag}
                />
              ))}
            </div>
          </div>

          {stageTags.map(stageTag => {
            const stageConvs = getConvsForStage(stageTag.id);
            return (
              <div key={stageTag.id} className="min-w-[240px] max-w-[280px] flex-shrink-0">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: stageTag.color }} />
                  <span className="text-xs font-semibold text-foreground">{stageTag.name}</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{stageConvs.length}</span>
                </div>
                <div className="space-y-2">
                  {stageConvs.map(conv => (
                    <KanbanCard
                      key={conv.id}
                      conv={conv}
                      tags={tags}
                      assignedTagIds={getTagsForContact(conv.contact.id).map(t => t.tag_id)}
                      onAddTag={onAddTag}
                      onRemoveTag={onRemoveTag}
                    />
                  ))}
                </div>
              </div>
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
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Tags</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Última Mensagem</th>
                <th className="text-left text-xs font-medium text-muted-foreground px-4 py-2">Data</th>
              </tr>
            </thead>
            <tbody>
              {filteredConversations.map(conv => (
                <tr key={conv.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-medium text-foreground">{conv.contact.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground text-xs">{conv.contact.phone}</td>
                  <td className="px-4 py-2.5">
                    <WaContactTagBadges
                      contactId={conv.contact.id}
                      assignedTagIds={getTagsForContact(conv.contact.id).map(t => t.tag_id)}
                      allTags={tags}
                      onAdd={onAddTag}
                      onRemove={onRemoveTag}
                    />
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground truncate max-w-[200px]">{conv.last_message}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatTime(conv.last_message_at)}</td>
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
            {/* Create */}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground mb-1 block">Nome</label>
                <Input value={newTagName} onChange={e => setNewTagName(e.target.value)} placeholder="Nova tag" className="h-8 text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Cor</label>
                <div className="flex gap-1">
                  {TAG_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewTagColor(c)}
                      className={`w-5 h-5 rounded-full border-2 ${newTagColor === c ? 'border-foreground' : 'border-transparent'}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <input type="checkbox" checked={newTagIsStage} onChange={e => setNewTagIsStage(e.target.checked)} id="is-stage" className="rounded" />
                <label htmlFor="is-stage" className="text-[10px] text-muted-foreground">Etapa</label>
              </div>
              <Button size="sm" className="h-8 text-xs" onClick={handleCreateTag}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>

            {/* List */}
            <div className="space-y-1 max-h-[40vh] overflow-y-auto">
              {tags.map(tag => (
                <div key={tag.id} className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-muted">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm text-foreground flex-1">{tag.name}</span>
                  {tag.is_stage && <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">Etapa</span>}
                  <button onClick={() => onDeleteTag(tag.id)} className="text-muted-foreground hover:text-destructive p-1">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KanbanCard({
  conv, tags, assignedTagIds, onAddTag, onRemoveTag,
}: {
  conv: WaConversation;
  tags: WaTag[];
  assignedTagIds: string[];
  onAddTag: (contactId: string, tagId: string) => Promise<void>;
  onRemoveTag: (contactId: string, tagId: string) => Promise<void>;
}) {
  const AVATAR_COLORS = ['152 60% 36%', '210 90% 50%', '280 65% 50%', '30 90% 50%', '0 72% 51%', '180 60% 40%'];
  let hash = 0;
  for (let i = 0; i < conv.contact.name.length; i++) hash = conv.contact.name.charCodeAt(i) + ((hash << 5) - hash);
  const avatarColor = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-2 hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[10px] font-bold shrink-0"
          style={{ backgroundColor: `hsl(${avatarColor})` }}
        >
          {conv.contact.name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-foreground truncate">{conv.contact.name}</p>
          <p className="text-[9px] text-muted-foreground">{conv.contact.phone}</p>
        </div>
      </div>
      {conv.last_message && (
        <p className="text-[10px] text-muted-foreground truncate">{conv.last_message}</p>
      )}
      <WaContactTagBadges
        contactId={conv.contact.id}
        assignedTagIds={assignedTagIds}
        allTags={tags}
        onAdd={onAddTag}
        onRemove={onRemoveTag}
      />
    </div>
  );
}
