import { useState, useMemo } from 'react';
import { Loader2, Search } from 'lucide-react';
import { WaConversation, WaInstance } from '@/hooks/use-wa-hub';
import { WaContactTagBadges } from './WaContactTagBadges';
import { getAvatarColor, formatSmartTime } from '@/lib/wa-utils';
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

export function WaConversationList({
  conversations, instances, loading, selectedId,
  onSelect, instanceFilter, onInstanceFilter, title = 'Conversas',
  tags, getTagsForContact, onAddTag, onRemoveTag,
}: Props) {
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    if (!search.trim()) return conversations;
    const q = search.toLowerCase();
    return conversations.filter(c =>
      c.contact.name.toLowerCase().includes(q) ||
      c.contact.phone.includes(q) ||
      c.last_message?.toLowerCase().includes(q)
    );
  }, [conversations, search]);

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
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="text-sm text-muted-foreground">{search ? 'Nenhum resultado' : 'Nenhuma conversa ainda'}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {filtered.map(conv => {
            // Time since last message for urgency indicator
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
