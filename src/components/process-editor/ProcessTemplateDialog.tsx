import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Replace } from 'lucide-react';
import { processTemplates, getTemplatesByCategory } from './templates';
import { ProcessTemplate } from './types';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onSelect: (t: ProcessTemplate, add?: boolean) => void; }

export const ProcessTemplateDialog: React.FC<Props> = ({ open, onOpenChange, onSelect }) => {
  const byCategory = getTemplatesByCategory();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-2xl max-h-[80vh]"><DialogHeader><DialogTitle>Galeria de Templates</DialogTitle></DialogHeader>
      <ScrollArea className="h-[500px] pr-4"><div className="space-y-6">{Object.entries(byCategory).map(([cat, templates]) => (
        <div key={cat}><h3 className="font-semibold text-sm text-muted-foreground uppercase mb-3">{cat}</h3>
          <div className="grid grid-cols-2 gap-3">{templates.map(t => (
            <div key={t.id} className="border rounded-lg p-4 hover:border-primary transition-colors">
              <h4 className="font-medium mb-1">{t.name}</h4><p className="text-sm text-muted-foreground line-clamp-2">{t.description}</p>
              <div className="mt-2 text-xs text-muted-foreground mb-3">{t.nodes.length} etapas</div>
              <div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => { onSelect(t, true); onOpenChange(false); }}><Plus className="h-3 w-3 mr-1" />Adicionar</Button><Button size="sm" className="flex-1" onClick={() => { onSelect(t, false); onOpenChange(false); }}><Replace className="h-3 w-3 mr-1" />Usar</Button></div>
            </div>))}</div></div>))}</div></ScrollArea>
    </DialogContent></Dialog>
  );
};
