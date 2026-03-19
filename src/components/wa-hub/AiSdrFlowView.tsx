import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  Position,
  Handle,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Zap, Phone, MessageSquare, Target, Calendar, Users,
  Tag, Brain, Ban, CheckCircle2, AlertTriangle, ArrowRight,
  Shield, Send,
} from "lucide-react";

/* ─── custom node ─── */
const iconMap: Record<string, any> = {
  trigger: Zap, incoming: Phone, greeting: Send, qualify: MessageSquare,
  score: Target, scoreA: CheckCircle2, scoreB: AlertTriangle, scoreC: Ban,
  calendar: Calendar, handoffCloser: Users, handoffSdr: Users,
  tag: Tag, sentiment: Brain, end: Shield,
};

const colorMap: Record<string, string> = {
  trigger: "border-primary bg-primary/10 text-primary",
  incoming: "border-blue-500 bg-blue-500/10 text-blue-500",
  greeting: "border-sky-500 bg-sky-500/10 text-sky-500",
  qualify: "border-green-500 bg-green-500/10 text-green-500",
  score: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
  scoreA: "border-emerald-500 bg-emerald-500/10 text-emerald-500",
  scoreB: "border-orange-500 bg-orange-500/10 text-orange-500",
  scoreC: "border-red-400 bg-red-400/10 text-red-400",
  calendar: "border-orange-500 bg-orange-500/10 text-orange-500",
  handoffCloser: "border-emerald-600 bg-emerald-600/10 text-emerald-600",
  handoffSdr: "border-amber-500 bg-amber-500/10 text-amber-500",
  tag: "border-yellow-500 bg-yellow-500/10 text-yellow-500",
  sentiment: "border-purple-500 bg-purple-500/10 text-purple-500",
  end: "border-muted-foreground bg-muted text-muted-foreground",
};

function FlowNode({ data }: { data: any }) {
  const Icon = iconMap[data.nodeType] || Zap;
  const colors = colorMap[data.nodeType] || "border-border bg-secondary text-foreground";
  const isDecision = data.nodeType === "score";

  return (
    <div className={`relative rounded-xl border-2 ${colors} px-4 py-3 min-w-[160px] max-w-[200px] shadow-sm`}>
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-muted-foreground" />
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-xs font-bold leading-tight">{data.label}</p>
          {data.desc && <p className="text-[9px] opacity-70 mt-0.5 leading-snug">{data.desc}</p>}
        </div>
      </div>
      {isDecision && (
        <>
          <Handle type="source" position={Position.Right} id="a" className="!w-2 !h-2 !bg-emerald-500" style={{ top: "25%" }} />
          <Handle type="source" position={Position.Right} id="b" className="!w-2 !h-2 !bg-orange-500" style={{ top: "50%" }} />
          <Handle type="source" position={Position.Right} id="c" className="!w-2 !h-2 !bg-red-400" style={{ top: "75%" }} />
        </>
      )}
      {!isDecision && <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-muted-foreground" />}
    </div>
  );
}

const nodeTypes = { flowNode: FlowNode };

interface Props {
  config: {
    feature_auto_reply?: boolean;
    feature_auto_tag?: boolean;
    feature_qualification?: boolean;
    feature_handoff?: boolean;
    feature_sentiment?: boolean;
    
    qualification_questions?: string[];
    score_thresholds?: { a_min: number; b_min: number };
    master_prompt?: string;
    tone?: string;
    greeting?: string;
  };
  closerName?: string;
}

export function AiSdrFlowView({ config, closerName }: Props) {
  const { nodes, edges } = useMemo(() => {
    const n: Node[] = [];
    const e: Edge[] = [];
    let x = 0;
    const Y = 200;
    const GAP = 260;

    const edgeDefaults = {
      type: "smoothstep" as const,
      animated: true,
      style: { strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed as const },
    };

    // 1 — Trigger
    n.push({ id: "trigger", type: "flowNode", position: { x, y: Y }, data: { nodeType: "trigger", label: "Trigger", desc: "Mensagem recebida" } });

    // 2 — Incoming
    x += GAP;
    n.push({ id: "incoming", type: "flowNode", position: { x, y: Y }, data: { nodeType: "incoming", label: "Mensagem chega", desc: "Lead envia msg no WhatsApp" } });
    e.push({ id: "e-trigger-incoming", source: "trigger", target: "incoming", ...edgeDefaults });

    // 3 — Greeting
    if (config.feature_auto_reply !== false) {
      x += GAP;
      n.push({ id: "greeting", type: "flowNode", position: { x, y: Y }, data: { nodeType: "greeting", label: closerName ? `Responde como ${closerName}` : "Resposta automática", desc: config.greeting?.substring(0, 60) || "Saudação + contexto" } });
      e.push({ id: "e-incoming-greeting", source: "incoming", target: "greeting", ...edgeDefaults });
    }

    // 4 — Auto tag
    const prevNode = config.feature_auto_reply !== false ? "greeting" : "incoming";
    if (config.feature_auto_tag !== false) {
      x += GAP;
      n.push({ id: "tag", type: "flowNode", position: { x, y: Y - 100 }, data: { nodeType: "tag", label: "Auto-etiqueta", desc: "Classifica estágio do lead" } });
      e.push({ id: `e-${prevNode}-tag`, source: prevNode, target: "tag", ...edgeDefaults, style: { ...edgeDefaults.style, strokeDasharray: "5 5" } });
    }

    // 5 — Sentiment
    if (config.feature_sentiment) {
      n.push({ id: "sentiment", type: "flowNode", position: { x: config.feature_auto_tag !== false ? x : x + GAP, y: Y + 100 }, data: { nodeType: "sentiment", label: "Sentimento", desc: "Detecta frustração / urgência" } });
      e.push({ id: `e-${prevNode}-sentiment`, source: prevNode, target: "sentiment", ...edgeDefaults, style: { ...edgeDefaults.style, strokeDasharray: "5 5" } });
    }

    // 6 — Qualification
    if (config.feature_qualification !== false) {
      x += GAP;
      const questions = config.qualification_questions || [];
      n.push({ id: "qualify", type: "flowNode", position: { x, y: Y }, data: { nodeType: "qualify", label: "Qualificação", desc: `${questions.length} perguntas naturais` } });
      e.push({ id: `e-${prevNode}-qualify`, source: prevNode, target: "qualify", ...edgeDefaults });

      // 7 — Score
      x += GAP;
      const thresholds = config.score_thresholds || { a_min: 80, b_min: 50 };
      n.push({ id: "score", type: "flowNode", position: { x, y: Y }, data: { nodeType: "score", label: "Score A / B / C", desc: `A≥${thresholds.a_min} | B≥${thresholds.b_min} | C<${thresholds.b_min}` } });
      e.push({ id: "e-qualify-score", source: "qualify", target: "score", ...edgeDefaults });

      // 8a — Score A → Calendar / Closer
      x += GAP;
      n.push({ id: "scoreA", type: "flowNode", position: { x, y: Y - 140 }, data: { nodeType: "scoreA", label: "Score A — Quente 🔥", desc: "Lead altamente qualificado" } });
      e.push({ id: "e-score-a", source: "score", target: "scoreA", sourceHandle: "a", ...edgeDefaults, label: "A", style: { ...edgeDefaults.style, stroke: "hsl(var(--chart-2))" } });

      x += GAP;
      n.push({ id: "calendar", type: "flowNode", position: { x, y: Y - 140 }, data: { nodeType: "calendar", label: "Agenda reunião", desc: closerName ? `Agenda com ${closerName}` : "Consulta agenda do Closer" } });
      e.push({ id: "e-scoreA-cal", source: "scoreA", target: "calendar", ...edgeDefaults });

      // 8b — Score B → SDR humano
      const xScoreB = x - GAP;
      n.push({ id: "scoreB", type: "flowNode", position: { x: xScoreB, y: Y }, data: { nodeType: "scoreB", label: "Score B — Morno", desc: "Parcialmente qualificado" } });
      e.push({ id: "e-score-b", source: "score", target: "scoreB", sourceHandle: "b", ...edgeDefaults, label: "B", style: { ...edgeDefaults.style, stroke: "hsl(var(--chart-4))" } });

      n.push({ id: "handoffSdr", type: "flowNode", position: { x, y: Y }, data: { nodeType: "handoffSdr", label: "Handoff → SDR", desc: "Transfere para SDR humano" } });
      e.push({ id: "e-scoreB-sdr", source: "scoreB", target: "handoffSdr", ...edgeDefaults });

      // 8c — Score C → Encerra
      n.push({ id: "scoreC", type: "flowNode", position: { x: xScoreB, y: Y + 140 }, data: { nodeType: "scoreC", label: "Score C — Frio", desc: "Não qualificado" } });
      e.push({ id: "e-score-c", source: "score", target: "scoreC", sourceHandle: "c", ...edgeDefaults, label: "C", style: { ...edgeDefaults.style, stroke: "hsl(var(--destructive))" } });

      n.push({ id: "end", type: "flowNode", position: { x, y: Y + 140 }, data: { nodeType: "end", label: "Encerra educadamente", desc: "Envia conteúdo de valor" } });
      e.push({ id: "e-scoreC-end", source: "scoreC", target: "end", ...edgeDefaults });

    } else if (config.feature_handoff !== false) {
      // Simple handoff without qualification
      x += GAP;
      n.push({ id: "handoffSdr", type: "flowNode", position: { x, y: Y }, data: { nodeType: "handoffSdr", label: "Handoff", desc: "Transfere após X msgs" } });
      e.push({ id: `e-${prevNode}-handoff`, source: prevNode, target: "handoffSdr", ...edgeDefaults });
    }

    return { nodes: n, edges: e };
  }, [config, closerName]);

  return (
    <div className="w-full h-[420px] rounded-xl border border-border bg-background/50 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        panOnDrag
        zoomOnScroll
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} className="opacity-30" />
        <Controls showInteractive={false} className="!bg-card !border-border !shadow-sm [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-foreground" />
      </ReactFlow>
    </div>
  );
}
