import { Handle, Position, NodeProps } from '@xyflow/react';
import { Mail } from 'lucide-react';

export default function EmailNode({ data }: NodeProps) {
  return (
    <div className="px-4 py-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 text-white shadow-lg min-w-[180px]">
      <Handle type="target" position={Position.Top} className="!bg-white !w-3 !h-3 !border-2 !border-blue-600" />
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-white/20 flex items-center justify-center">
          <Mail className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs opacity-80">Enviar Email</p>
          <p className="font-semibold text-sm truncate">
            {(data.subject as string) || 'Configurar assunto...'}
          </p>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!bg-white !w-3 !h-3 !border-2 !border-blue-600" />
    </div>
  );
}
