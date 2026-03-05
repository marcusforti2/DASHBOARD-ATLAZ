import React, { useMemo } from 'react';
import { Node } from '@xyflow/react';
import { Clock, AlertTriangle, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ProcessNodeData } from './types';

const toMin = (t: number, u: string) => u === 'horas' ? t * 60 : u === 'dias' ? t * 480 : t;
const fmt = (m: number) => m < 60 ? `${m}min` : m < 480 ? `${Math.floor(m/60)}h${m%60 > 0 ? ` ${m%60}min` : ''}` : `${Math.floor(m/480)}d${Math.floor((m%480)/60) > 0 ? ` ${Math.floor((m%480)/60)}h` : ''}`;

export const ProcessTimeCalculator: React.FC<{ nodes: Node[] }> = ({ nodes }) => {
  const { totalMinutes, withTime, withoutTime } = useMemo(() => {
    let total = 0; const wt: { label: string; min: number }[] = [], wo: string[] = [];
    nodes.forEach(n => { const d = n.data as unknown as ProcessNodeData; if (d.tempoEstimado && d.tempoUnidade) { const m = toMin(d.tempoEstimado, d.tempoUnidade); total += m; wt.push({ label: d.label, min: m }); } else if (d.type !== 'inicio' && d.type !== 'fim') wo.push(d.label || ''); });
    return { totalMinutes: total, withTime: wt, withoutTime: wo };
  }, [nodes]);

  if (nodes.length === 0) return null;
  return (
    <TooltipProvider><div className="flex items-center gap-3">
      {withTime.length > 0 && <Tooltip><TooltipTrigger asChild><Badge variant="secondary" className="flex items-center gap-1.5 cursor-help"><Clock className="h-3.5 w-3.5" /><span className="font-medium">{fmt(totalMinutes)}</span></Badge></TooltipTrigger><TooltipContent side="bottom" className="max-w-xs"><p className="font-medium text-sm mb-1">Tempo Total</p>{withTime.map((s, i) => <div key={i} className="flex justify-between text-xs"><span className="text-muted-foreground truncate max-w-[150px]">{s.label}</span><span className="font-medium ml-2">{fmt(s.min)}</span></div>)}</TooltipContent></Tooltip>}
      {withoutTime.length > 0 && <Tooltip><TooltipTrigger asChild><Badge variant="outline" className="flex items-center gap-1.5 cursor-help text-amber-600 border-amber-300"><AlertTriangle className="h-3.5 w-3.5" /><span>{withoutTime.length}</span></Badge></TooltipTrigger><TooltipContent side="bottom"><p className="font-medium text-sm mb-1">Sem tempo estimado</p>{withoutTime.slice(0, 5).map((s, i) => <div key={i} className="text-xs text-muted-foreground">• {s}</div>)}</TooltipContent></Tooltip>}
      <Badge variant="outline" className="flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /><span>{nodes.length} etapas</span></Badge>
    </div></TooltipProvider>
  );
};
