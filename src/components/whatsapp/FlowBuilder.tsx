import { useState, useEffect, useCallback } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Node,
  type Edge,
  type Connection,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Zap, Plus, Sparkles, Save, Trash2, Play, Copy,
  ToggleLeft, ToggleRight, Loader2, Bot,
  Maximize2, Minimize2, Smartphone, X,
} from "lucide-react";
import { nodeTypes, NODE_REGISTRY, type FlowNodeType, type FlowNodeData } from "./flow-nodes";
import NodeEditor from "./NodeEditor";
import PhonePreview from "./PhonePreview";

interface Automation {
  id: string;
  name: string;
  description: string;
  message_template: string;
  schedule_cron: string | null;
  target_audience: string;
  target_role: string | null;
  include_metrics: boolean;
  include_ai_tips: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
  flow_data?: any;
}

interface FlowBuilderProps {
  automations: Automation[];
  onReload: () => void;
}

interface StoredNode {
  id: string;
  type: FlowNodeType;
  position: { x: number; y: number };
  config: Record<string, any>;
}

interface StoredFlow {
  nodes: StoredNode[];
  edges: { id: string; source: string; target: string; sourceHandle?: string }[];
}

function cronToLabel(cron: string | null): string {
  if (!cron) return "Manual";
  const p: Record<string, string> = {
    "0 11 * * 1-5": "8h Seg-Sex", "0 15 * * 1-5": "12h Seg-Sex",
    "0 21 * * 1-5": "18h Seg-Sex", "0 12 * * 1": "Seg 9h", "0 20 * * 5": "Sex 17h",
  };
  return p[cron] || cron;
}

function audienceLabel(a: string): string {
  return { all: "Todos", sdrs: "SDRs", closers: "Closers", admins: "Admins", team: "Equipe" }[a] || a;
}

// Build default flow for automations without flow_data
function buildDefaultFlow(auto: Automation): StoredFlow {
  return {
    nodes: [
      { id: "trigger", type: "trigger", position: { x: 0, y: 80 }, config: { schedule_cron: auto.schedule_cron } },
      { id: "audience", type: "audience", position: { x: 250, y: 80 }, config: { target_audience: auto.target_audience, include_metrics: auto.include_metrics, include_ai_tips: auto.include_ai_tips } },
      { id: "message", type: "message", position: { x: 500, y: 80 }, config: { message_template: auto.message_template } },
      { id: "send", type: "send", position: { x: 750, y: 80 }, config: {} },
    ],
    edges: [
      { id: "e-trigger-audience", source: "trigger", target: "audience" },
      { id: "e-audience-message", source: "audience", target: "message" },
      { id: "e-message-send", source: "message", target: "send" },
    ],
  };
}

function getNodeSubtitle(type: FlowNodeType, config: Record<string, any>): string {
  switch (type) {
    case "trigger": return config.schedule_cron ? cronToLabel(config.schedule_cron) : "Disparo manual";
    case "audience": return audienceLabel(config.target_audience || "all");
    case "message": return (config.message_template || "").substring(0, 25) + "...";
    case "send": return "WhatsApp API";
    case "delay": return `${config.delay_value || 30} ${config.delay_unit || "min"}`;
    case "condition": return `${config.condition_field || "role"} ${config.condition_operator || "="} ${config.condition_value || "?"}`;
    case "ai_message": return config.ai_tone ? `Tom: ${config.ai_tone}` : "Prompt IA";
    case "ab_test": return `A: ${config.split_a || 50}% / B: ${100 - (config.split_a || 50)}%`;
    case "webhook": return config.webhook_url ? new URL(config.webhook_url).hostname : "URL não definida";
    case "ai_action": return config.ai_action_type || "Classificar";
    case "analytics": return config.event_name || "Evento";
    default: return "";
  }
}

const EDGE_COLORS: Record<string, string> = {
  trigger: "hsl(217, 91%, 60%)",
  audience: "hsl(280, 65%, 60%)",
  message: "hsl(160, 84%, 39%)",
  delay: "hsl(38, 92%, 50%)",
  condition: "hsl(25, 95%, 53%)",
  ai_message: "hsl(187, 72%, 50%)",
  ab_test: "hsl(330, 80%, 60%)",
  webhook: "hsl(239, 84%, 67%)",
  ai_action: "hsl(263, 70%, 50%)",
  analytics: "hsl(347, 77%, 50%)",
  send: "hsl(142, 71%, 45%)",
};

// Addable node types (not trigger/send which are always present)
const ADDABLE_NODES: { type: FlowNodeType; category: string }[] = [
  { type: "message", category: "core" },
  { type: "delay", category: "logic" },
  { type: "condition", category: "logic" },
  { type: "ai_message", category: "advanced" },
  { type: "ab_test", category: "logic" },
  { type: "webhook", category: "advanced" },
  { type: "ai_action", category: "advanced" },
  { type: "analytics", category: "advanced" },
];

export default function FlowBuilder({ automations, onReload }: FlowBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [flowData, setFlowData] = useState<StoredFlow | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedAutomation, setGeneratedAutomation] = useState<any>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [autoName, setAutoName] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const selected = automations.find(a => a.id === selectedId);

  // When selection changes, load flow data
  useEffect(() => {
    if (selected) {
      const fd: StoredFlow = selected.flow_data || buildDefaultFlow(selected);
      setFlowData(fd);
      setAutoName(selected.name);
      setEditingNodeId(null);
    }
  }, [selectedId]);

  // Sync React Flow nodes/edges from flowData
  useEffect(() => {
    if (!flowData || !selected) return;

    const rfNodes: Node[] = flowData.nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        label: n.type,
        subtitle: getNodeSubtitle(n.type, n.config),
        active: selected.active,
        selected: editingNodeId === n.id,
        nodeType: n.type,
        onEdit: () => setEditingNodeId(prev => prev === n.id ? null : n.id),
        config: n.config,
      } satisfies FlowNodeData,
      draggable: true,
    }));

    const rfEdges: Edge[] = flowData.edges.map(e => {
      const sourceNode = flowData.nodes.find(n => n.id === e.source);
      const color = EDGE_COLORS[sourceNode?.type || "trigger"] || "hsl(217, 91%, 60%)";
      return {
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        animated: selected.active,
        style: { stroke: color, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color },
      };
    });

    setNodes(rfNodes);
    setEdges(rfEdges);
  }, [flowData, editingNodeId, selected]);

  const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
    setFlowData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map(n => n.id === nodeId ? { ...n, config } : n),
      };
    });
  };

  const handleNodePositionChange = useCallback(() => {
    // Sync positions back to flowData after dragging
    setFlowData(prev => {
      if (!prev) return prev;
      const nodeMap = new Map<string, { x: number; y: number }>();
      // We need to get positions from the React Flow state
      return prev;
    });
  }, []);

  const onConnect = useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return;
    const newEdge = {
      id: `e-${connection.source}-${connection.target}-${Date.now()}`,
      source: connection.source,
      target: connection.target,
      sourceHandle: connection.sourceHandle || undefined,
    };
    setFlowData(prev => {
      if (!prev) return prev;
      return { ...prev, edges: [...prev.edges, newEdge] };
    });
  }, []);

  const handleAddNode = (type: FlowNodeType) => {
    if (!flowData) return;
    const id = `${type}_${Date.now()}`;
    const maxX = Math.max(...flowData.nodes.map(n => n.position.x), 0);
    const defaultConfig: Record<string, any> = {};
    if (type === "delay") { defaultConfig.delay_value = 30; defaultConfig.delay_unit = "min"; }
    if (type === "condition") { defaultConfig.condition_field = "role"; defaultConfig.condition_operator = "equals"; }
    if (type === "ai_message") { defaultConfig.ai_tone = "motivacional"; }
    if (type === "ab_test") { defaultConfig.split_a = 50; }
    if (type === "webhook") { defaultConfig.webhook_method = "POST"; }
    if (type === "ai_action") { defaultConfig.ai_action_type = "classify"; }
    if (type === "message") { defaultConfig.message_template = ""; }

    const newNode: StoredNode = {
      id,
      type,
      position: { x: maxX + 250, y: 80 + Math.random() * 100 },
      config: defaultConfig,
    };
    setFlowData(prev => prev ? { ...prev, nodes: [...prev.nodes, newNode] } : prev);
    setShowAddMenu(false);
    setEditingNodeId(id);
    toast.success(`Bloco "${NODE_REGISTRY[type].label}" adicionado!`);
  };

  const handleDeleteNode = (nodeId: string) => {
    setFlowData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.filter(n => n.id !== nodeId),
        edges: prev.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
      };
    });
    setEditingNodeId(null);
    toast.success("Bloco removido");
  };

  // Sync node positions from React Flow back to flowData on drag end
  const onNodeDragStop = useCallback((_: any, node: Node) => {
    setFlowData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        nodes: prev.nodes.map(n => n.id === node.id ? { ...n, position: node.position } : n),
      };
    });
  }, []);

  // ─── Save ───
  const handleSave = async () => {
    if (!selected || !flowData) return;
    if (!autoName.trim()) { toast.error("Nome do fluxo vazio"); return; }
    setSaving(true);

    // Extract top-level fields from node configs for backward compatibility
    const triggerNode = flowData.nodes.find(n => n.type === "trigger");
    const audienceNode = flowData.nodes.find(n => n.type === "audience");
    const messageNode = flowData.nodes.find(n => n.type === "message");

    const { error } = await supabase.from("whatsapp_automations").update({
      name: autoName.trim(),
      message_template: messageNode?.config.message_template || "",
      schedule_cron: triggerNode?.config.schedule_cron || null,
      target_audience: audienceNode?.config.target_audience || "all",
      include_metrics: audienceNode?.config.include_metrics ?? true,
      include_ai_tips: audienceNode?.config.include_ai_tips ?? true,
      flow_data: flowData as any,
    }).eq("id", selected.id);

    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Fluxo salvo! ✅"); await onReload(); setSelectedId(selected.id); }
    setSaving(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    await supabase.from("whatsapp_automations").update({ active: !active }).eq("id", id);
    toast.success(active ? "Desativada" : "Ativada");
    onReload();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta automação?")) return;
    await supabase.from("whatsapp_automations").delete().eq("id", id);
    toast.success("Excluída");
    if (selectedId === id) { setSelectedId(null); setFlowData(null); }
    onReload();
  };

  const handleDispatch = async () => {
    if (!selected) return;
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-whatsapp-report", {
        body: { automation_id: selected.id },
      });
      if (error) toast.error("Erro: " + error.message);
      else if (data?.error) toast.error("Erro: " + data.error);
      else {
        const sc = data?.results?.filter((r: any) => r.success).length || 0;
        toast.success(`Enviado para ${sc}/${data?.results?.length || 0} contatos!`);
      }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setDispatching(false);
  };

  const handleGenerate = async () => {
    if (aiPrompt.trim().length < 5) { toast.error("Descreva melhor"); return; }
    setGenerating(true); setGeneratedAutomation(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-automation", { body: { prompt: aiPrompt.trim() } });
      if (error) toast.error("Erro: " + error.message);
      else if (data?.automation) { setGeneratedAutomation(data.automation); toast.success("Fluxo gerado! 🎉"); }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setGenerating(false);
  };

  const handleSaveGenerated = async () => {
    if (!generatedAutomation) return;
    setSavingNew(true);
    const g = generatedAutomation;
    const defaultFlow = buildDefaultFlow({
      ...g,
      id: "", active: true, created_at: "", updated_at: "", description: g.description || "",
    } as Automation);

    const { data, error } = await supabase.from("whatsapp_automations").insert({
      name: g.name || "Nova Automação",
      description: g.description || "",
      message_template: g.message_template || "",
      schedule_cron: g.schedule_cron || null,
      target_audience: g.target_audience || "all",
      target_role: g.target_role || null,
      include_metrics: g.include_metrics ?? true,
      include_ai_tips: g.include_ai_tips ?? true,
      flow_data: defaultFlow as any,
    }).select("id").maybeSingle();

    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Fluxo salvo! 🎉");
      setGeneratedAutomation(null); setAiPrompt(""); setShowAiGenerator(false);
      await onReload();
      if (data?.id) setTimeout(() => setSelectedId(data.id), 100);
    }
    setSavingNew(false);
  };

  const handleCreateBlank = async () => {
    const blankAuto = {
      id: "", name: "Novo fluxo", description: "",
      message_template: "Olá {{nome}}! 📊\n\n{{progresso_meta}}\n\n{{dicas_ia}}",
      schedule_cron: null, target_audience: "all", target_role: null,
      include_metrics: true, include_ai_tips: true, active: true,
      created_at: "", updated_at: "",
    } as Automation;
    const defaultFlow = buildDefaultFlow(blankAuto);

    const { data, error } = await supabase.from("whatsapp_automations").insert({
      name: "Novo fluxo",
      description: "",
      message_template: blankAuto.message_template,
      schedule_cron: null,
      target_audience: "all",
      include_metrics: true,
      include_ai_tips: true,
      active: true,
      flow_data: defaultFlow as any,
    }).select("id").maybeSingle();
    if (error) { toast.error("Erro: " + error.message); return; }
    toast.success("Fluxo criado! ✨");
    setShowAiGenerator(false);
    await onReload();
    if (data?.id) setTimeout(() => setSelectedId(data.id), 100);
  };

  const handleDuplicate = async (a: Automation) => {
    const { data, error } = await supabase.from("whatsapp_automations").insert({
      name: a.name + " (cópia)",
      description: a.description,
      message_template: a.message_template,
      schedule_cron: a.schedule_cron,
      target_audience: a.target_audience,
      target_role: a.target_role,
      include_metrics: a.include_metrics,
      include_ai_tips: a.include_ai_tips,
      active: false,
      flow_data: a.flow_data || null,
    }).select("id").maybeSingle();
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Duplicado! ✨");
      await onReload();
      if (data?.id) setTimeout(() => setSelectedId(data.id), 100);
    }
  };

  // Get current message template for phone preview
  const currentMessageTemplate = flowData?.nodes.find(n => n.type === "message")?.config.message_template || "";

  // Get editing node info
  const editingStoredNode = flowData?.nodes.find(n => n.id === editingNodeId);

  const containerClass = fullscreen
    ? "fixed inset-0 z-[60] bg-background flex flex-col"
    : "rounded-2xl border border-border bg-card overflow-hidden";

  return (
    <div className={containerClass}>
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Zap size={16} className="text-accent" />
          <span className="text-xs font-bold text-card-foreground uppercase tracking-wider">Flow Builder</span>
          <span className="px-2 py-0.5 text-[9px] rounded-full bg-accent text-accent-foreground font-semibold">
            {automations.length} fluxos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleCreateBlank}
            className="px-4 py-2 text-[11px] rounded-xl font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1.5 border border-border">
            <Plus size={12} /> Novo fluxo
          </button>
          <button onClick={() => { setShowAiGenerator(true); setSelectedId(null); setFlowData(null); setEditingNodeId(null); }}
            className="px-4 py-2 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm">
            <Sparkles size={12} /> Criar com IA
          </button>
          <button onClick={() => setFullscreen(!fullscreen)}
            className="p-2 rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border transition-colors"
            title={fullscreen ? "Sair tela cheia" : "Tela cheia"}>
            {fullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: fullscreen ? 0 : 520 }}>
        {/* Flow List Sidebar */}
        <div className="w-56 border-r border-border bg-secondary/10 flex-shrink-0 overflow-auto">
          <div className="p-2 space-y-1">
            {automations.map(a => (
              <div key={a.id} className="group relative">
                <button
                  onClick={() => { setSelectedId(a.id); setShowAiGenerator(false); }}
                  className={`w-full text-left p-3 rounded-xl transition-all ${
                    selectedId === a.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary border border-transparent"
                  }`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.active ? "bg-accent" : "bg-muted-foreground/30"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-bold text-card-foreground truncate">{a.name}</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {a.schedule_cron ? cronToLabel(a.schedule_cron) : "Manual"} · {audienceLabel(a.target_audience)}
                      </p>
                    </div>
                  </div>
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(a); }}
                  title="Duplicar"
                  className="absolute top-2 right-2 p-1.5 rounded-lg bg-secondary/80 border border-border text-muted-foreground hover:text-primary hover:bg-primary/10 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <Copy size={10} />
                </button>
              </div>
            ))}
            {automations.length === 0 && (
              <div className="p-8 text-center">
                <Zap size={20} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-[10px] text-muted-foreground">Nenhum fluxo</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showAiGenerator ? (
            <AiGeneratorPanel
              aiPrompt={aiPrompt} setAiPrompt={setAiPrompt}
              generating={generating} generatedAutomation={generatedAutomation} savingNew={savingNew}
              onGenerate={handleGenerate} onSaveGenerated={handleSaveGenerated}
              onDiscard={() => setGeneratedAutomation(null)}
              onClose={() => { setShowAiGenerator(false); setGeneratedAutomation(null); setAiPrompt(""); }}
            />
          ) : selected && flowData ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Action Bar */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-card flex-shrink-0">
                <div className="flex items-center gap-3">
                  <input
                    value={autoName}
                    onChange={e => setAutoName(e.target.value)}
                    className="text-sm font-bold text-card-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5 max-w-[200px]"
                  />
                  <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold ${selected.active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {selected.active ? "Ativa" : "Inativa"}
                  </span>
                  <span className="text-[9px] text-muted-foreground">{flowData.nodes.length} blocos</span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Add Node Button */}
                  <div className="relative">
                    <button onClick={() => setShowAddMenu(!showAddMenu)}
                      className="px-3 py-2 text-[10px] rounded-xl font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5 border border-border">
                      <Plus size={12} /> Bloco
                    </button>
                    {showAddMenu && (
                      <div className="absolute top-full mt-1 right-0 w-56 rounded-xl border border-border bg-card shadow-xl z-50 p-2 space-y-1 animate-in fade-in-0 slide-in-from-top-2 duration-150">
                        <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-1">Adicionar bloco</p>
                        {ADDABLE_NODES.map(({ type }) => {
                          const reg = NODE_REGISTRY[type];
                          const RegIcon = reg.icon;
                          return (
                            <button key={type} onClick={() => handleAddNode(type)}
                              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-secondary transition-colors text-left">
                              <div className={`w-6 h-6 rounded-lg ${reg.bg} flex items-center justify-center`}>
                                <RegIcon size={12} className={reg.color} />
                              </div>
                              <div>
                                <p className="text-[11px] font-semibold text-card-foreground">{reg.label}</p>
                                <p className="text-[8px] text-muted-foreground">{reg.description}</p>
                              </div>
                            </button>
                          );
                        })}
                        <button onClick={() => setShowAddMenu(false)} className="w-full text-center text-[9px] text-muted-foreground py-1 hover:text-foreground">Fechar</button>
                      </div>
                    )}
                  </div>
                  <button onClick={() => setShowPhone(!showPhone)}
                    className={`px-3 py-2 text-[10px] rounded-xl font-medium flex items-center gap-1.5 transition-colors border ${
                      showPhone ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-secondary-foreground hover:bg-secondary/80"
                    }`}>
                    <Smartphone size={12} /> Preview
                  </button>
                  <button onClick={handleDispatch} disabled={dispatching}
                    className="px-4 py-2 text-[10px] rounded-xl font-bold bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                    {dispatching ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                    Disparar
                  </button>
                  <button onClick={() => handleToggle(selected.id, selected.active)}
                    className="px-3 py-2 text-[10px] rounded-xl font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5">
                    {selected.active ? <ToggleRight size={14} className="text-accent" /> : <ToggleLeft size={14} />}
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 text-[10px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Salvar
                  </button>
                  <button onClick={() => handleDelete(selected.id)}
                    className="px-3 py-2 text-[10px] rounded-xl text-destructive hover:bg-destructive/10">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>

              {/* Canvas + Panels */}
              <div className="flex-1 flex overflow-hidden">
                <div className="flex-1 relative">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onConnect={onConnect}
                    onNodeDragStop={onNodeDragStop}
                    nodeTypes={nodeTypes}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    fitViewOptions={{ padding: 0.3 }}
                    minZoom={0.2}
                    maxZoom={2.5}
                    proOptions={{ hideAttribution: true }}
                    className="bg-background"
                  >
                    <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(222, 30%, 18%)" />
                    <Controls
                      showInteractive={false}
                      className="!bg-card !border-border !rounded-xl !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-secondary"
                    />
                    <MiniMap
                      nodeColor={() => "hsl(217, 91%, 60%)"}
                      maskColor="hsl(222, 47%, 6%, 0.8)"
                      className="!bg-card !border-border !rounded-xl"
                      pannable zoomable
                    />
                  </ReactFlow>

                  {!editingNodeId && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-[10px] text-muted-foreground shadow-lg">
                      Clique em um nó para editar · Arraste para conectar · <strong>+ Bloco</strong> para adicionar
                    </div>
                  )}
                </div>

                {/* Node Editor Panel */}
                {editingNodeId && editingStoredNode && (
                  <div className="w-80 border-l border-border bg-card/95 backdrop-blur-sm flex-shrink-0 overflow-hidden animate-in slide-in-from-right-5 duration-200">
                    <NodeEditor
                      type={editingStoredNode.type}
                      nodeId={editingStoredNode.id}
                      config={editingStoredNode.config}
                      onChange={(newConfig) => updateNodeConfig(editingStoredNode.id, newConfig)}
                      onClose={() => setEditingNodeId(null)}
                      onDelete={editingStoredNode.type !== "trigger" && editingStoredNode.type !== "send"
                        ? () => handleDeleteNode(editingStoredNode.id)
                        : undefined}
                    />
                  </div>
                )}

                {/* Phone Preview */}
                {showPhone && (
                  <div className="w-[320px] border-l border-border bg-card/95 backdrop-blur-sm flex-shrink-0 overflow-auto py-6 animate-in slide-in-from-right-5 duration-200">
                    <PhonePreview messageTemplate={currentMessageTemplate} automationName={autoName} />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-3xl bg-secondary/50 flex items-center justify-center mx-auto">
                  <Zap size={28} className="text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">Selecione um fluxo ou crie um novo</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AI Generator Panel (Step-by-step Wizard) ───
function AiGeneratorPanel({ aiPrompt, setAiPrompt, generating, generatedAutomation, savingNew, onGenerate, onSaveGenerated, onDiscard, onClose }: {
  aiPrompt: string; setAiPrompt: (v: string) => void; generating: boolean; generatedAutomation: any; savingNew: boolean;
  onGenerate: () => void; onSaveGenerated: () => void; onDiscard: () => void; onClose: () => void;
}) {
  const [mode, setMode] = useState<"choose" | "ai_full" | "manual">("choose");
  const [step, setStep] = useState(1);
  const [manualMsg, setManualMsg] = useState("");
  const [manualName, setManualName] = useState("");
  const [audience, setAudience] = useState("all");
  const [schedule, setSchedule] = useState<string | null>(null);
  const [tone, setTone] = useState("profissional");
  const [rewriting, setRewriting] = useState(false);
  const [rewrittenMsg, setRewrittenMsg] = useState("");
  const [savingManual, setSavingManual] = useState(false);

  const AUDIENCE_OPTIONS = [
    { value: "all", label: "Todos", emoji: "👥" },
    { value: "sdrs", label: "SDRs", emoji: "🎯" },
    { value: "closers", label: "Closers", emoji: "🤝" },
    { value: "admins", label: "Admins", emoji: "🛡️" },
    { value: "team", label: "Equipe", emoji: "👷" },
  ];

  const SCHEDULE_PRESETS = [
    { label: "Manual", cron: null, emoji: "✋" },
    { label: "8h Seg-Sex", cron: "0 11 * * 1-5", emoji: "🌅" },
    { label: "12h Seg-Sex", cron: "0 15 * * 1-5", emoji: "☀️" },
    { label: "18h Seg-Sex", cron: "0 21 * * 1-5", emoji: "🌆" },
    { label: "Segunda 9h", cron: "0 12 * * 1", emoji: "📅" },
    { label: "Sexta 17h", cron: "0 20 * * 5", emoji: "🎉" },
  ];

  const TONES = [
    { value: "motivacional", label: "Motivacional", emoji: "🔥" },
    { value: "profissional", label: "Profissional", emoji: "💼" },
    { value: "casual", label: "Casual", emoji: "😊" },
    { value: "urgente", label: "Urgente", emoji: "⚡" },
    { value: "coaching", label: "Coaching", emoji: "🧠" },
  ];

  const suggestions = [
    "Resumo diário de performance às 18h para toda equipe com dicas da IA",
    "Lembrete de metas toda segunda às 9h para SDRs",
    "Relatório semanal de ranking para closers na sexta às 17h",
    "Motivação matinal diária às 8h com mensagem personalizada da IA",
  ];

  const handleRewrite = async () => {
    if (manualMsg.trim().length < 3) { toast.error("Escreva uma mensagem primeiro"); return; }
    setRewriting(true);
    try {
      const { data, error } = await supabase.functions.invoke("rewrite-message", {
        body: { message: manualMsg.trim(), tone, target_audience: audience },
      });
      if (error) toast.error("Erro: " + error.message);
      else if (data?.rewritten) { setRewrittenMsg(data.rewritten); toast.success("Mensagem reescrita! ✨"); }
      else if (data?.error) toast.error(data.error);
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setRewriting(false);
  };

  const handleSaveManual = async () => {
    const finalMsg = rewrittenMsg || manualMsg;
    if (!finalMsg.trim()) { toast.error("Escreva uma mensagem"); return; }
    setSavingManual(true);
    const defaultFlow = buildDefaultFlow({
      id: "", name: manualName || "Nova Automação", description: "",
      message_template: finalMsg,
      schedule_cron: schedule, target_audience: audience, target_role: null,
      include_metrics: true, include_ai_tips: true, active: true,
      created_at: "", updated_at: "",
    } as Automation);

    const { data, error } = await supabase.from("whatsapp_automations").insert({
      name: manualName || "Nova Automação",
      description: "",
      message_template: finalMsg,
      schedule_cron: schedule,
      target_audience: audience,
      include_metrics: true,
      include_ai_tips: true,
      flow_data: defaultFlow as any,
    }).select("id").maybeSingle();

    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Automação criada! 🎉");
      onClose();
      // Trigger reload via parent
      onSaveGenerated();
    }
    setSavingManual(false);
  };

  // ─── Choose Mode ───
  if (mode === "choose") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md w-full space-y-6 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Zap size={22} className="text-primary" />
              </div>
              <div>
                <h3 className="text-base font-bold text-card-foreground">Nova Automação</h3>
                <p className="text-[11px] text-muted-foreground">Como deseja criar?</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3">
            <button onClick={() => setMode("manual")}
              className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-accent/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <MessageCircle size={22} className="text-accent" />
                </div>
                <div>
                  <p className="text-sm font-bold text-card-foreground">Escrever Mensagem</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Escreva sua mensagem e a IA reescreve pra você. Escolha público e horário.
                  </p>
                </div>
              </div>
            </button>

            <button onClick={() => setMode("ai_full")}
              className="p-5 rounded-2xl border-2 border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-all text-left group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Sparkles size={22} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-card-foreground">Criar com IA</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Descreva o que quer e a IA monta o fluxo completo automaticamente.
                  </p>
                </div>
              </div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── AI Full Mode ───
  if (mode === "ai_full") {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-lg w-full space-y-5 animate-fade-in">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => setMode("choose")} className="p-2 rounded-xl hover:bg-secondary transition-colors">
                <X size={14} className="text-muted-foreground rotate-0" />
              </button>
              <div className="w-10 h-10 rounded-2xl bg-primary/15 flex items-center justify-center">
                <Sparkles size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-card-foreground">Criar Fluxo com IA</h3>
                <p className="text-[10px] text-muted-foreground">Descreva o que quer e a IA monta tudo</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => setAiPrompt(s)}
                className="px-3 py-1.5 text-[10px] rounded-full border border-border bg-secondary text-secondary-foreground hover:border-primary/40 hover:bg-primary/5 transition-all">
                {s.substring(0, 45)}...
              </button>
            ))}
          </div>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
            placeholder="Ex: Quero um relatório diário de performance enviado às 18h para toda equipe com métricas e dicas de coaching..."
            rows={4}
            className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none resize-none" />
          <div className="flex gap-2">
            <button onClick={() => setMode("choose")} className="px-4 py-2.5 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">Voltar</button>
            <button onClick={onGenerate} disabled={generating || aiPrompt.trim().length < 5}
              className="px-6 py-2.5 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2">
              {generating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
              {generating ? "Gerando..." : "Gerar Fluxo"}
            </button>
          </div>
          {generatedAutomation && (
            <div className="border-t border-border pt-5 mt-2 space-y-4 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
              <div className="flex items-center gap-2">
                <Bot size={16} className="text-accent" />
                <h4 className="text-xs font-bold text-card-foreground">Fluxo gerado — revise antes de salvar</h4>
              </div>
              <div className="p-4 rounded-2xl bg-secondary/50 border border-border space-y-2.5">
                <p className="text-[11px]"><strong className="text-card-foreground">Nome:</strong> <span className="text-muted-foreground">{generatedAutomation.name}</span></p>
                <p className="text-[11px]"><strong className="text-card-foreground">Gatilho:</strong> <span className="text-muted-foreground">{cronToLabel(generatedAutomation.schedule_cron)}</span></p>
                <p className="text-[11px]"><strong className="text-card-foreground">Público:</strong> <span className="text-muted-foreground">{audienceLabel(generatedAutomation.target_audience)}</span></p>
                <div className="text-[10px] font-mono bg-background p-3 rounded-xl border border-border whitespace-pre-wrap max-h-40 overflow-auto text-card-foreground">
                  {generatedAutomation.message_template}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={onDiscard} className="px-4 py-2.5 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">Descartar</button>
                <button onClick={onSaveGenerated} disabled={savingNew}
                  className="px-5 py-2.5 text-[11px] rounded-xl font-bold bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2">
                  {savingNew ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar Fluxo
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Manual Mode (Step-by-step) ───
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => step > 1 ? setStep(step - 1) : setMode("choose")}
              className="p-2 rounded-xl hover:bg-secondary transition-colors">
              <X size={14} className="text-muted-foreground rotate-45" />
            </button>
            <div>
              <h3 className="text-sm font-bold text-card-foreground">Criar Automação</h3>
              <p className="text-[10px] text-muted-foreground">Passo {step} de 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl hover:bg-secondary transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex gap-2">
          {[1, 2, 3].map(s => (
            <div key={s} className={`h-1.5 flex-1 rounded-full transition-all ${s <= step ? "bg-primary" : "bg-border"}`} />
          ))}
        </div>

        {/* Step 1: Message + AI Rewrite */}
        {step === 1 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome da automação</label>
              <input
                value={manualName}
                onChange={e => setManualName(e.target.value)}
                placeholder="Ex: Relatório Diário SDR"
                className="mt-1 w-full rounded-xl border border-border bg-secondary px-4 py-2.5 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none"
              />
            </div>

            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Escreva sua mensagem</label>
              <textarea
                value={manualMsg}
                onChange={e => { setManualMsg(e.target.value); setRewrittenMsg(""); }}
                placeholder="Escreva aqui a mensagem que quer enviar para a equipe. Pode ser rascunho, a IA vai polir pra você..."
                rows={5}
                className="mt-1 w-full rounded-xl border border-border bg-secondary px-4 py-3 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
              />
            </div>

            {/* Tone selector */}
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tom da mensagem</label>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {TONES.map(t => (
                  <button key={t.value} onClick={() => { setTone(t.value); setRewrittenMsg(""); }}
                    className={`px-3 py-2 text-[11px] rounded-xl border transition-all flex items-center gap-1.5 ${
                      tone === t.value
                        ? "border-primary bg-primary/15 text-primary font-bold"
                        : "border-border bg-secondary text-secondary-foreground hover:border-primary/40"
                    }`}>
                    <span>{t.emoji}</span> {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Rewrite Button */}
            <button onClick={handleRewrite} disabled={rewriting || manualMsg.trim().length < 3}
              className="w-full px-4 py-3 text-[12px] rounded-xl font-bold bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg">
              {rewriting ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              {rewriting ? "Reescrevendo com IA..." : "✨ Reescrever com IA"}
            </button>

            {/* Rewritten result */}
            {rewrittenMsg && (
              <div className="space-y-2 animate-in fade-in-0 slide-in-from-bottom-2 duration-300">
                <div className="flex items-center gap-2">
                  <Bot size={14} className="text-accent" />
                  <span className="text-[10px] font-bold text-accent uppercase tracking-wider">Mensagem reescrita pela IA</span>
                </div>
                <div className="p-4 rounded-xl bg-accent/5 border border-accent/20 whitespace-pre-wrap text-[11px] text-card-foreground max-h-48 overflow-auto">
                  {rewrittenMsg}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setManualMsg(rewrittenMsg); setRewrittenMsg(""); toast.success("Mensagem aplicada!"); }}
                    className="px-3 py-1.5 text-[10px] rounded-lg bg-accent/15 text-accent hover:bg-accent/25 font-semibold transition-colors">
                    ✅ Usar esta versão
                  </button>
                  <button onClick={() => setRewrittenMsg("")}
                    className="px-3 py-1.5 text-[10px] rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors">
                    Manter original
                  </button>
                  <button onClick={handleRewrite} disabled={rewriting}
                    className="px-3 py-1.5 text-[10px] rounded-lg bg-secondary text-muted-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1">
                    <Sparkles size={10} /> Tentar novamente
                  </button>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={() => setStep(2)} disabled={!manualMsg.trim()}
                className="px-6 py-2.5 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Audience */}
        {step === 2 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Para quem enviar?</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {AUDIENCE_OPTIONS.map(opt => (
                  <button key={opt.value} onClick={() => setAudience(opt.value)}
                    className={`p-3.5 rounded-xl border-2 transition-all text-left ${
                      audience === opt.value
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary hover:border-primary/40"
                    }`}>
                    <span className="text-lg">{opt.emoji}</span>
                    <p className={`text-[12px] font-bold mt-1 ${audience === opt.value ? "text-primary" : "text-card-foreground"}`}>
                      {opt.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)}
                className="px-4 py-2.5 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">
                ← Voltar
              </button>
              <button onClick={() => setStep(3)}
                className="px-6 py-2.5 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                Próximo →
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Schedule + Review */}
        {step === 3 && (
          <div className="space-y-4 animate-slide-up">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Quando disparar?</label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SCHEDULE_PRESETS.map(p => (
                  <button key={p.label} onClick={() => setSchedule(p.cron)}
                    className={`p-3 rounded-xl border-2 transition-all text-left ${
                      schedule === p.cron
                        ? "border-primary bg-primary/10"
                        : "border-border bg-secondary hover:border-primary/40"
                    }`}>
                    <span className="text-sm">{p.emoji}</span>
                    <p className={`text-[11px] font-bold mt-0.5 ${schedule === p.cron ? "text-primary" : "text-card-foreground"}`}>
                      {p.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Review */}
            <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Resumo</p>
              <p className="text-[11px] text-card-foreground"><strong>Nome:</strong> {manualName || "Nova Automação"}</p>
              <p className="text-[11px] text-card-foreground"><strong>Público:</strong> {AUDIENCE_OPTIONS.find(a => a.value === audience)?.label}</p>
              <p className="text-[11px] text-card-foreground"><strong>Horário:</strong> {SCHEDULE_PRESETS.find(s => s.cron === schedule)?.label || "Manual"}</p>
              <div className="text-[10px] font-mono bg-background p-3 rounded-lg border border-border whitespace-pre-wrap max-h-24 overflow-auto text-card-foreground">
                {(rewrittenMsg || manualMsg).substring(0, 200)}...
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(2)}
                className="px-4 py-2.5 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">
                ← Voltar
              </button>
              <button onClick={handleSaveManual} disabled={savingManual}
                className="px-6 py-2.5 text-[11px] rounded-xl font-bold bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 flex items-center gap-2 shadow-lg">
                {savingManual ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Criar Automação 🚀
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
