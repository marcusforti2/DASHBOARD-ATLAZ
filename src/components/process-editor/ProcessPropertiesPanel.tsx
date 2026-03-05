import React, { memo, useRef, useEffect } from 'react';
import { Node } from '@xyflow/react';
import { X, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProcessNodeData, ProcessStatus, TempoUnidade, NodeColor } from './types';
import { nodeTypeConfigs } from './nodeConfig';
import { nodeColorMap } from './nodes/ProcessNode';

interface ProcessPropertiesPanelProps { node: Node; onUpdate: (id: string, data: Partial<ProcessNodeData>) => void; onClose: () => void; onDelete?: (id: string) => void; }

const colorOptions: { value: NodeColor; label: string }[] = [
  { value: 'default', label: 'Padrão' }, { value: 'red', label: 'Vermelho' }, { value: 'yellow', label: 'Amarelo' },
  { value: 'blue', label: 'Azul' }, { value: 'green', label: 'Verde' }, { value: 'purple', label: 'Roxo' }, { value: 'orange', label: 'Laranja' }
];

function ProcessPropertiesPanelComponent({ node, onUpdate, onClose, onDelete }: ProcessPropertiesPanelProps) {
  const nd = node.data as unknown as ProcessNodeData;
  const config = nodeTypeConfigs[nd.type];
  const ef = config?.editableFields || [];
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { const t = setTimeout(() => { ref.current?.focus(); ref.current?.select(); }, 100); return () => clearTimeout(t); }, [node.id]);
  const hc = (f: string, v: string | number) => onUpdate(node.id, { [f]: v });

  return (
    <div className="absolute top-4 right-4 w-80 max-h-[calc(100vh-120px)] bg-card border rounded-xl shadow-lg z-10 flex flex-col">
      <div className="flex items-center justify-between p-3 border-b">
        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full" style={{ backgroundColor: config?.color }} /><span className="font-medium text-sm">{config?.label}</span></div>
        <div className="flex items-center gap-1">
          {onDelete && <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => onDelete(node.id)}><Trash2 className="h-4 w-4" /></Button>}
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          <div className="space-y-1.5"><Label className="text-xs">Nome</Label><Input ref={ref} value={nd.label || ''} onChange={e => hc('label', e.target.value)} className="h-8 text-sm" /></div>
          {ef.includes('descricao') && <div className="space-y-1.5"><Label className="text-xs">Descrição</Label><Textarea value={nd.descricao || ''} onChange={e => hc('descricao', e.target.value)} className="text-sm min-h-[60px]" placeholder="Descreva esta etapa..." /></div>}
          {ef.includes('condicao') && <div className="space-y-1.5"><Label className="text-xs">Condição</Label><Input value={nd.condicao || ''} onChange={e => hc('condicao', e.target.value)} className="h-8 text-sm" /></div>}
          {ef.includes('responsavel') && <div className="space-y-1.5"><Label className="text-xs">Responsável</Label><Input value={nd.responsavel || ''} onChange={e => hc('responsavel', e.target.value)} className="h-8 text-sm" /></div>}
          {ef.includes('departamento') && <div className="space-y-1.5"><Label className="text-xs">Departamento</Label><Input value={nd.departamento || ''} onChange={e => hc('departamento', e.target.value)} className="h-8 text-sm" /></div>}
          {ef.includes('tempoEstimado') && <div className="grid grid-cols-2 gap-2"><div className="space-y-1.5"><Label className="text-xs">Tempo</Label><Input type="number" min={0} value={nd.tempoEstimado || ''} onChange={e => hc('tempoEstimado', parseInt(e.target.value) || 0)} className="h-8 text-sm" /></div><div className="space-y-1.5"><Label className="text-xs">Unidade</Label><Select value={nd.tempoUnidade || 'minutos'} onValueChange={v => hc('tempoUnidade', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="minutos">Minutos</SelectItem><SelectItem value="horas">Horas</SelectItem><SelectItem value="dias">Dias</SelectItem></SelectContent></Select></div></div>}
          {ef.includes('sla') && <div className="space-y-1.5"><Label className="text-xs">SLA (horas)</Label><Input type="number" min={0} value={nd.sla || ''} onChange={e => hc('sla', parseInt(e.target.value) || 0)} className="h-8 text-sm" /></div>}
          {ef.includes('status') && <div className="space-y-1.5"><Label className="text-xs">Status</Label><Select value={nd.status || 'ativo'} onValueChange={v => hc('status', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ativo">Ativo</SelectItem><SelectItem value="inativo">Inativo</SelectItem><SelectItem value="em_revisao">Em Revisão</SelectItem></SelectContent></Select></div>}
          {ef.includes('sistemaNome') && <div className="space-y-1.5"><Label className="text-xs">Sistema</Label><Input value={nd.sistemaNome || ''} onChange={e => hc('sistemaNome', e.target.value)} className="h-8 text-sm" /></div>}
          <div className="space-y-1.5"><Label className="text-xs flex items-center gap-1"><ExternalLink className="h-3 w-3" />Link</Label><Input value={nd.link || ''} onChange={e => hc('link', e.target.value)} className="h-8 text-sm" placeholder="https://..." type="url" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Cor</Label><Select value={nd.cor || 'default'} onValueChange={v => hc('cor', v)}><SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger><SelectContent>{colorOptions.map(o => <SelectItem key={o.value} value={o.value}><div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full border" style={{ backgroundColor: o.value === 'default' ? config?.bgColor : nodeColorMap[o.value]?.bg }} />{o.label}</div></SelectItem>)}</SelectContent></Select></div>
        </div>
      </ScrollArea>
    </div>
  );
}

export const ProcessPropertiesPanel = memo(ProcessPropertiesPanelComponent);
