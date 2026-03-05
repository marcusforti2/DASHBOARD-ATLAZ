import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Loader2, Plus, Replace } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { Node, Edge } from '@xyflow/react';

interface SavedProcess { id: string; name: string; description: string | null; nodes: Node[]; edges: Edge[]; updated_at: string; }
interface ProcessLoadDialogProps { open: boolean; onOpenChange: (o: boolean) => void; onLoad: (p: SavedProcess, add?: boolean) => void; }

export const ProcessLoadDialog: React.FC<ProcessLoadDialogProps> = ({ open, onOpenChange, onLoad }) => {
  const { user } = useAuth();
  const [processes, setProcesses] = useState<SavedProcess[]>([]);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => { if (open && user) loadProcesses(); }, [open, user]);

  const loadProcesses = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from('process_flows').select('*').eq('user_id', user.id).order('updated_at', { ascending: false });
      if (error) throw error;
      setProcesses((data || []).map(p => ({ ...p, nodes: p.nodes as unknown as Node[], edges: p.edges as unknown as Edge[] })));
    } catch { toast.error('Erro ao carregar'); } finally { setLoading(false); }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Excluir este processo?')) return;
    setDeleting(id);
    try { await supabase.from('process_flows').delete().eq('id', id); setProcesses(p => p.filter(x => x.id !== id)); toast.success('Excluído'); } catch { toast.error('Erro'); } finally { setDeleting(null); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle>Carregar Processo</DialogTitle></DialogHeader>
      {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div> : processes.length === 0 ? <div className="text-center py-8 text-muted-foreground">Nenhum processo salvo</div> : (
        <ScrollArea className="h-[400px] pr-4"><div className="space-y-2">{processes.map(p => (
          <div key={p.id} className="border rounded-lg p-3 hover:border-primary transition-colors group">
            <div className="flex items-center justify-between mb-2"><div className="flex-1 min-w-0"><h4 className="font-medium truncate">{p.name}</h4>{p.description && <p className="text-sm text-muted-foreground truncate">{p.description}</p>}<div className="text-xs text-muted-foreground mt-1">{(p.nodes as Node[]).length} etapas • {new Date(p.updated_at).toLocaleDateString('pt-BR')}</div></div>
              <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 shrink-0" onClick={e => handleDelete(p.id, e)} disabled={deleting === p.id}>{deleting === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}</Button></div>
            <div className="flex gap-2"><Button variant="outline" size="sm" className="flex-1" onClick={() => { onLoad(p, true); onOpenChange(false); }}><Plus className="h-3 w-3 mr-1" />Adicionar</Button><Button size="sm" className="flex-1" onClick={() => { onLoad(p, false); onOpenChange(false); }}><Replace className="h-3 w-3 mr-1" />Substituir</Button></div>
          </div>))}</div></ScrollArea>)}
    </DialogContent></Dialog>
  );
};
