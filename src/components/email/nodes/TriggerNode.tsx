import { Handle, Position, NodeProps } from '@xyflow/react';
import { Zap, Users, AlertTriangle, Trophy, CalendarDays, Route, Clock } from 'lucide-react';

const TRIGGER_ICONS: Record<string, any> = {
  new_member: Users,
  inactivity: AlertTriangle,
  date: CalendarDays,
  manual: Zap,
  schedule: Clock,
};

const TRIGGER_LABELS: Record<string, string> = {
  new_member: 'Novo Membro',
  inactivity: 'Inatividade',
  date: 'Data Específica',
  manual: 'Disparo Manual',
  schedule: 'Agendamento',
};

export default function TriggerNode({ data }: NodeProps) {
  const Icon = TRIGGER_ICONS[data.triggerType as string] || Zap;
  const label = TRIGGER_LABELS[data.triggerType as string] || 'Gatilho';

  const getSubLabel = () => {
    const config = data.config as any;
    if (!config) return null;
    switch (data.triggerType) {
      case 'inactivity':
        return config.days ? `${config.days} dias` : null;
      default:
        return null;
    }
  };

  const subLabel = getSubLabel();

  return (
    <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white shadow-lg min-w-[180px]">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs opacity-80">Gatilho</p>
          <p className="font-semibold text-sm truncate">{label}</p>
          {subLabel && <p className="text-xs opacity-90 mt-0.5 truncate">{subLabel}</p>}
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white !w-3 !h-3 !border-2 !border-emerald-600" />
    </div>
  );
}
