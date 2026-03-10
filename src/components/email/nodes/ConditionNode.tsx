import { Handle, Position, NodeProps } from '@xyflow/react';
import { GitBranch } from 'lucide-react';

const CONDITION_LABELS: Record<string, string> = {
  opened_email: 'Abriu email?',
  clicked_link: 'Clicou no link?',
  is_sdr: 'É SDR?',
  is_closer: 'É Closer?',
  inactive_days: 'Inativo há X dias?',
};

export default function ConditionNode({ data }: NodeProps) {
  const conditionType = data.conditionType as string || 'opened_email';
  const label = CONDITION_LABELS[conditionType] || conditionType;

  return (
    <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 text-white shadow-lg min-w-[160px]">
      <Handle type="target" position={Position.Top} className="!bg-white !w-3 !h-3 !border-2 !border-purple-600" />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
          <GitBranch className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs opacity-80">Condição</p>
          <p className="font-semibold text-sm">{label}</p>
        </div>
      </div>
      <div className="flex justify-between mt-2 text-xs">
        <span className="bg-white/20 px-2 py-0.5 rounded">Sim</span>
        <span className="bg-white/20 px-2 py-0.5 rounded">Não</span>
      </div>
      <Handle type="source" position={Position.Bottom} id="yes" style={{ left: '30%' }} className="!bg-green-400 !w-3 !h-3 !border-2 !border-purple-600" />
      <Handle type="source" position={Position.Bottom} id="no" style={{ left: '70%' }} className="!bg-red-400 !w-3 !h-3 !border-2 !border-purple-600" />
    </div>
  );
}
