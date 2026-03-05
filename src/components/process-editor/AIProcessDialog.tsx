import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Plus, Replace } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Node, Edge } from '@xyflow/react';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; onGenerate: (nodes: Node[], edges: Edge[], add?: boolean) => void; }

export const AIProcessDialog: React.FC<Props> = ({ open, onOpenChange, onGenerate }) => {
  const [description, setDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (addToCanvas: boolean) => {
    if (!description.trim()) { toast.error('Descreva o processo'); return; }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-process', { body: { description } });
      if (error) throw error;
      if (data?.nodes && data?.edges) { onGenerate(data.nodes, data.edges, addToCanvas); toast.success(addToCanvas ? 'Adicionado!' : 'Gerado!'); onOpenChange(false); setDescription(''); }
      else throw new Error('Resposta inválida');
    } catch { toast.error('Erro ao gerar. Tente novamente.'); } finally { setIsGenerating(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-w-lg"><DialogHeader><DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Gerar Processo com IA</DialogTitle><DialogDescription>Descreva o processo e a IA gera o fluxo</DialogDescription></DialogHeader>
      <div className="space-y-4 pt-4">
        <div className="space-y-2"><Label>Descrição</Label><Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Processo de vendas B2B com prospecção, qualificação, demonstração..." rows={6} className="resize-none" /><p className="text-xs text-muted-foreground">Seja específico: etapas, responsáveis, decisões</p></div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="outline" onClick={() => handleGenerate(true)} disabled={isGenerating || !description.trim()}>{isGenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}Adicionar</Button>
          <Button onClick={() => handleGenerate(false)} disabled={isGenerating || !description.trim()}>{isGenerating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Gerando...</> : <><Replace className="h-4 w-4 mr-2" />Substituir</>}</Button>
        </div>
      </div>
    </DialogContent></Dialog>
  );
};
