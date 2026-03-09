import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import type { WaTag } from '@/hooks/use-wa-tags';

interface Props {
  contactId: string;
  assignedTagIds: string[];
  allTags: WaTag[];
  onAdd: (contactId: string, tagId: string) => Promise<void>;
  onRemove: (contactId: string, tagId: string) => Promise<void>;
  compact?: boolean;
}

export function WaContactTagBadges({ contactId, assignedTagIds, allTags, onAdd, onRemove, compact }: Props) {
  const [open, setOpen] = useState(false);
  const assigned = allTags.filter(t => assignedTagIds.includes(t.id));
  const available = allTags.filter(t => !assignedTagIds.includes(t.id));

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {assigned.map(tag => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-medium text-white"
          style={{ backgroundColor: tag.color }}
        >
          {tag.name}
          {!compact && (
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(contactId, tag.id); }}
              className="hover:bg-white/20 rounded-full p-px"
            >
              <X className="w-2 h-2" />
            </button>
          )}
        </span>
      ))}
      {!compact && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="w-4 h-4 rounded-full bg-muted hover:bg-accent flex items-center justify-center"
            >
              <Plus className="w-2.5 h-2.5 text-muted-foreground" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-40 p-1" align="start" onClick={(e) => e.stopPropagation()}>
            {available.length === 0 ? (
              <p className="text-[10px] text-muted-foreground p-2 text-center">Todas as tags aplicadas</p>
            ) : (
              available.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => { onAdd(contactId, tag.id); setOpen(false); }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs hover:bg-muted text-left"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  {tag.name}
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
