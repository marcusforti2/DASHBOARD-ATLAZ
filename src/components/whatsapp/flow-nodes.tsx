import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock, Target, MessageSquare, Send, Users, UserCheck, ShieldCheck,
  Radio, ToggleLeft, ToggleRight, CheckCircle2,
} from "lucide-react";

// ─── Shared types ───
export interface FlowNodeData {
  label: string;
  subtitle: string;
  active: boolean;
  selected?: boolean;
  nodeType: "trigger" | "audience" | "message" | "send";
  onEdit?: () => void;
}

const NODE_STYLES: Record<string, { icon: any; color: string; bg: string; border: string; glow: string }> = {
  trigger:  { icon: Clock,         color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/40",  glow: "shadow-blue-500/20" },
  audience: { icon: Target,        color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/40", glow: "shadow-purple-500/20" },
  message:  { icon: MessageSquare, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40", glow: "shadow-emerald-500/20" },
  send:     { icon: Send,          color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/40",  glow: "shadow-green-500/20" },
};

const LABELS: Record<string, string> = {
  trigger: "Gatilho",
  audience: "Público",
  message: "Mensagem",
  send: "Enviar",
};

function FlowNodeComponent({ data }: NodeProps) {
  const d = data as unknown as FlowNodeData;
  const style = NODE_STYLES[d.nodeType];
  const Icon = style.icon;
  const isFirst = d.nodeType === "trigger";
  const isLast = d.nodeType === "send";

  return (
    <div
      onClick={d.onEdit}
      className={`
        cursor-pointer rounded-2xl border-2 p-4 min-w-[160px] max-w-[180px]
        transition-all duration-200 backdrop-blur-sm
        ${style.border} ${style.bg}
        ${!d.active ? "opacity-40" : "hover:scale-[1.03]"}
        ${d.selected ? `ring-2 ring-offset-2 ring-offset-background ring-primary shadow-lg ${style.glow}` : "shadow-md"}
      `}
    >
      {!isFirst && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-muted-foreground/50 !border-2 !border-background"
        />
      )}

      <div className="flex flex-col items-center gap-2 text-center">
        <div className={`w-10 h-10 rounded-xl ${style.bg} border ${style.border} flex items-center justify-center`}>
          <Icon size={18} className={style.color} />
        </div>
        <span className="text-xs font-bold text-card-foreground">{LABELS[d.nodeType]}</span>
        <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{d.subtitle}</span>
      </div>

      {!isLast && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background"
        />
      )}
    </div>
  );
}

export const TriggerNode = memo(FlowNodeComponent);
export const AudienceNode = memo(FlowNodeComponent);
export const MessageNode = memo(FlowNodeComponent);
export const SendNode = memo(FlowNodeComponent);

export const nodeTypes = {
  trigger: TriggerNode,
  audience: AudienceNode,
  message: MessageNode,
  send: SendNode,
};
