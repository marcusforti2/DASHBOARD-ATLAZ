import { Loader2 } from 'lucide-react';
import { WaConversation, WaInstance } from '@/hooks/use-wa-hub';
import { WaContactTagBadges } from './WaContactTagBadges';
import type { WaTag } from '@/hooks/use-wa-tags';

const AVATAR_COLORS = ['152 60% 36%', '210 90% 50%', '280 65% 50%', '30 90% 50%', '0 72% 51%', '180 60% 40%'];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

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
  onSelect, instanceFilter, onInstanceFilter, title = 'Todas as Conversas',
}: Props) {
  return (
    <div className="w-80 border-r border-border flex flex-col bg-card shrink-0">
      <div className="px-4 py-3 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        <div className="flex gap-1 mt-2 flex-wrap">
          <button
            onClick={() => onInstanceFilter(null)}
            className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
              !instanceFilter ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
            }`}
          >
            Todas
          </button>
          {instances.map(inst => (
            <button
              key={inst.id}
              onClick={() => onInstanceFilter(inst.id)}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-colors ${
                instanceFilter === inst.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
            >
              {inst.instance_name}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
        </div>
      ) : conversations.length === 0 ? (
        <div className="text-center py-12 px-4">
          <p className="text-sm text-muted-foreground">Nenhuma conversa ainda</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {conversations.map(conv => (
            <button
              key={conv.id}
              onClick={() => onSelect(conv.id)}
              className={`w-full flex items-start gap-3 px-4 py-3 text-left transition-colors border-b border-border/50 ${
                selectedId === conv.id ? 'bg-accent' : 'hover:bg-muted/50'
              }`}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                style={{ backgroundColor: `hsl(${getAvatarColor(conv.contact.name)})` }}
              >
                {conv.contact.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-foreground truncate">{conv.contact.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">{formatTime(conv.last_message_at)}</span>
                </div>
                <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{conv.lead_status}</span>
                  {conv.unread_count > 0 && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                      {conv.unread_count}
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
