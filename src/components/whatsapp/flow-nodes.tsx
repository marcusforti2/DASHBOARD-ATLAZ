import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  Clock, Target, MessageSquare, Send, Timer, GitBranch,
  Sparkles, Shuffle, Webhook, Bot, BarChart3,
} from "lucide-react";

// ─── All supported node types ───
export type FlowNodeType =
  | "trigger" | "audience" | "message" | "send"
  | "delay" | "condition" | "ai_message" | "ab_test" | "webhook" | "ai_action" | "analytics";

export interface FlowNodeData {
  label: string;
  subtitle: string;
  active: boolean;
  selected?: boolean;
  nodeType: FlowNodeType;
  onEdit?: () => void;
  config?: Record<string, any>;
}

export const NODE_REGISTRY: Record<FlowNodeType, {
  icon: any;
  label: string;
  description: string;
  color: string;
  bg: string;
  border: string;
  glow: string;
  category: "core" | "logic" | "advanced";
}> = {
  trigger:    { icon: Clock,         label: "Gatilho",       description: "Quando o fluxo dispara",        color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/40",    glow: "shadow-blue-500/20",    category: "core" },
  audience:   { icon: Target,        label: "Público",       description: "Quem recebe a mensagem",        color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/40",  glow: "shadow-purple-500/20",  category: "core" },
  message:    { icon: MessageSquare, label: "Mensagem",      description: "Template de mensagem",           color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/40", glow: "shadow-emerald-500/20", category: "core" },
  send:       { icon: Send,          label: "Enviar",        description: "Entrega via WhatsApp",           color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/40",   glow: "shadow-green-500/20",   category: "core" },
  delay:      { icon: Timer,         label: "Espera",        description: "Aguardar X minutos/horas",      color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/40",   glow: "shadow-amber-500/20",   category: "logic" },
  condition:  { icon: GitBranch,     label: "Condição",      description: "IF/ELSE baseado em regras",     color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/40",  glow: "shadow-orange-500/20",  category: "logic" },
  ai_message: { icon: Sparkles,      label: "Msg IA",        description: "Mensagem gerada pela IA",       color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/40",    glow: "shadow-cyan-500/20",    category: "advanced" },
  ab_test:    { icon: Shuffle,       label: "Teste A/B",     description: "Split aleatório de caminhos",   color: "text-pink-400",    bg: "bg-pink-500/10",    border: "border-pink-500/40",    glow: "shadow-pink-500/20",    category: "logic" },
  webhook:    { icon: Webhook,       label: "Webhook",       description: "Chamar API externa",            color: "text-indigo-400",  bg: "bg-indigo-500/10",  border: "border-indigo-500/40",  glow: "shadow-indigo-500/20",  category: "advanced" },
  ai_action:  { icon: Bot,           label: "Ação IA",       description: "IA decide próxima ação",        color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/40",  glow: "shadow-violet-500/20",  category: "advanced" },
  analytics:  { icon: BarChart3,     label: "Analytics",     description: "Rastrear evento/conversão",     color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/40",    glow: "shadow-rose-500/20",    category: "advanced" },
};

// ─── Generic Flow Node Component ───
function FlowNodeComponent({ data }: NodeProps) {
  const d = data as unknown as FlowNodeData;
  const reg = NODE_REGISTRY[d.nodeType];
  if (!reg) return null;
  const Icon = reg.icon;

  // Condition nodes have 2 outputs (true/false)
  const isCondition = d.nodeType === "condition";
  const isAbTest = d.nodeType === "ab_test";
  const isFirst = d.nodeType === "trigger";
  const isLast = d.nodeType === "send";

  return (
    <div
      onClick={d.onEdit}
      className={`
        cursor-pointer rounded-2xl border-2 p-4 min-w-[160px] max-w-[180px]
        transition-all duration-200 backdrop-blur-sm
        ${reg.border} ${reg.bg}
        ${!d.active ? "opacity-40" : "hover:scale-[1.03]"}
        ${d.selected ? `ring-2 ring-offset-2 ring-offset-background ring-primary shadow-lg ${reg.glow}` : "shadow-md"}
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
        <div className={`w-10 h-10 rounded-xl ${reg.bg} border ${reg.border} flex items-center justify-center`}>
          <Icon size={18} className={reg.color} />
        </div>
        <span className="text-xs font-bold text-card-foreground">{reg.label}</span>
        <span className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{d.subtitle}</span>
      </div>

      {/* Standard output */}
      {!isLast && !isCondition && !isAbTest && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-primary !border-2 !border-background"
        />
      )}

      {/* Condition: true (top) / false (bottom) outputs */}
      {isCondition && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            style={{ top: "35%" }}
            className="!w-3 !h-3 !bg-green-500 !border-2 !border-background"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            style={{ top: "65%" }}
            className="!w-3 !h-3 !bg-red-500 !border-2 !border-background"
          />
          <div className="absolute right-[-8px] top-[28%] text-[7px] font-bold text-green-500">✓</div>
          <div className="absolute right-[-8px] top-[58%] text-[7px] font-bold text-red-500">✗</div>
        </>
      )}

      {/* A/B Test: A (top) / B (bottom) outputs */}
      {isAbTest && (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="a"
            style={{ top: "35%" }}
            className="!w-3 !h-3 !bg-pink-400 !border-2 !border-background"
          />
          <Handle
            type="source"
            position={Position.Right}
            id="b"
            style={{ top: "65%" }}
            className="!w-3 !h-3 !bg-pink-600 !border-2 !border-background"
          />
          <div className="absolute right-[-8px] top-[28%] text-[7px] font-bold text-pink-400">A</div>
          <div className="absolute right-[-8px] top-[58%] text-[7px] font-bold text-pink-600">B</div>
        </>
      )}
    </div>
  );
}

// Export individual node types for React Flow registration
export const TriggerNode = memo(FlowNodeComponent);
export const AudienceNode = memo(FlowNodeComponent);
export const MessageNode = memo(FlowNodeComponent);
export const SendNode = memo(FlowNodeComponent);
export const DelayNode = memo(FlowNodeComponent);
export const ConditionNode = memo(FlowNodeComponent);
export const AiMessageNode = memo(FlowNodeComponent);
export const AbTestNode = memo(FlowNodeComponent);
export const WebhookNode = memo(FlowNodeComponent);
export const AiActionNode = memo(FlowNodeComponent);
export const AnalyticsNode = memo(FlowNodeComponent);

export const nodeTypes = {
  trigger: TriggerNode,
  audience: AudienceNode,
  message: MessageNode,
  send: SendNode,
  delay: DelayNode,
  condition: ConditionNode,
  ai_message: AiMessageNode,
  ab_test: AbTestNode,
  webhook: WebhookNode,
  ai_action: AiActionNode,
  analytics: AnalyticsNode,
};
