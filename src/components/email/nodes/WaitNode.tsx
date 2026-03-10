import { Handle, Position, NodeProps } from '@xyflow/react';
import { Clock } from 'lucide-react';

const UNIT_LABELS: Record<string, string> = {
  hours: 'hora(s)',
  days: 'dia(s)',
  weeks: 'semana(s)',
};

export default function WaitNode({ data }: NodeProps) {
  const duration = data.duration as number || 1;
  const unit = data.unit as string || 'days';
  const unitLabel = UNIT_LABELS[unit] || unit;

  return (
    <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-lg min-w-[150px]">
      <Handle type="target" position={Position.Top} className="!bg-white !w-3 !h-3 !border-2 !border-amber-600" />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs opacity-80">Aguardar</p>
          <p className="font-semibold text-sm">{duration} {unitLabel}</p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white !w-3 !h-3 !border-2 !border-amber-600" />
    </div>
  );
}
