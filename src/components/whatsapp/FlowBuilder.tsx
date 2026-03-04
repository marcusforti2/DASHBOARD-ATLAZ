import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
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
  Maximize2, Minimize2, Smartphone, X, PanelRightClose, PanelRightOpen,
} from "lucide-react";
import { nodeTypes, type FlowNodeData } from "./flow-nodes";
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
}

interface FlowBuilderProps {
  automations: Automation[];
  onReload: () => void;
}

type EditNodeType = "trigger" | "audience" | "message" | "send";

function cronToLabel(cron: string | null): string {
  if (!cron) return "Manual";
  const presets: Record<string, string> = {
    "0 11 * * 1-5": "8h Seg-Sex", "0 15 * * 1-5": "12h Seg-Sex",
    "0 21 * * 1-5": "18h Seg-Sex", "0 12 * * 1": "Seg 9h", "0 20 * * 5": "Sex 17h",
  };
  return presets[cron] || cron;
}

function audienceLabel(a: string): string {
  return { all: "Todos", sdrs: "SDRs", closers: "Closers", admins: "Admins", team: "Equipe" }[a] || a;
}

const FLOW_STEPS: EditNodeType[] = ["trigger", "audience", "message", "send"];

function buildFlowElements(
  auto: Automation,
  editingNode: EditNodeType | null,
  onEdit: (type: EditNodeType) => void
) {
  const getSubtitle = (type: EditNodeType): string => {
    switch (type) {
      case "trigger": return auto.schedule_cron ? cronToLabel(auto.schedule_cron) : "Disparo manual";
      case "audience": return audienceLabel(auto.target_audience);
      case "message": return (auto.message_template || "").substring(0, 30) + "...";
      case "send": return "WhatsApp API";
    }
  };

  const nodes: Node[] = FLOW_STEPS.map((type, i) => ({
    id: type,
    type,
    position: { x: i * 250, y: 80 },
    data: {
      label: type,
      subtitle: getSubtitle(type),
      active: auto.active,
      selected: editingNode === type,
      nodeType: type,
      onEdit: () => onEdit(type),
    } satisfies FlowNodeData,
    draggable: true,
  }));

  const edges: Edge[] = [
    { id: "e-trigger-audience", source: "trigger", target: "audience", animated: auto.active, style: { stroke: "hsl(217, 91%, 60%)", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(217, 91%, 60%)" } },
    { id: "e-audience-message", source: "audience", target: "message", animated: auto.active, style: { stroke: "hsl(280, 65%, 60%)", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(280, 65%, 60%)" } },
    { id: "e-message-send", source: "message", target: "send", animated: auto.active, style: { stroke: "hsl(160, 84%, 39%)", strokeWidth: 2 }, markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(160, 84%, 39%)" } },
  ];

  return { nodes, edges };
}

export default function FlowBuilder({ automations, onReload }: FlowBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<EditNodeType | null>(null);
  const [editForm, setEditForm] = useState<Automation | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedAutomation, setGeneratedAutomation] = useState<any>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showPhone, setShowPhone] = useState(false);

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const selected = automations.find(a => a.id === selectedId);

  // Sync flow elements when selection or editing changes
  useEffect(() => {
    if (selected && editForm) {
      const { nodes: n, edges: e } = buildFlowElements(editForm, editingNode, (type) =>
        setEditingNode(prev => prev === type ? null : type)
      );
      setNodes(n);
      setEdges(e);
    }
  }, [selectedId, editForm, editingNode, selected]);

  useEffect(() => {
    if (selected) {
      setEditForm({ ...selected });
      setEditingNode(null);
    }
  }, [selectedId]);

  const handleNodeChange = (data: Partial<Automation>) => {
    setEditForm(prev => prev ? { ...prev, ...data } : prev);
  };

  const handleSave = async () => {
    if (!editForm || !selected) return;
    if (!editForm.name.trim()) { toast.error("Nome do fluxo vazio"); return; }
    setSaving(true);
    const { error } = await supabase.from("whatsapp_automations").update({
      name: editForm.name.trim(),
      description: editForm.description,
      message_template: editForm.message_template,
      schedule_cron: editForm.schedule_cron || null,
      target_audience: editForm.target_audience,
      target_role: editForm.target_role,
      include_metrics: editForm.include_metrics,
      include_ai_tips: editForm.include_ai_tips,
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
    if (selectedId === id) { setSelectedId(null); setEditForm(null); }
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
    const { data, error } = await supabase.from("whatsapp_automations").insert({
      name: generatedAutomation.name || "Nova Automação",
      description: generatedAutomation.description || "",
      message_template: generatedAutomation.message_template || "",
      schedule_cron: generatedAutomation.schedule_cron || null,
      target_audience: generatedAutomation.target_audience || "all",
      target_role: generatedAutomation.target_role || null,
      include_metrics: generatedAutomation.include_metrics ?? true,
      include_ai_tips: generatedAutomation.include_ai_tips ?? true,
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
    const { data, error } = await supabase.from("whatsapp_automations").insert({
      name: "Novo fluxo",
      description: "",
      message_template: "Olá {{nome}}! 📊\n\n{{progresso_meta}}\n\n{{dicas_ia}}",
      schedule_cron: null,
      target_audience: "all",
      include_metrics: true,
      include_ai_tips: true,
      active: true,
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
    }).select("id").maybeSingle();
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Duplicado! ✨");
      await onReload();
      if (data?.id) setTimeout(() => setSelectedId(data.id), 100);
    }
  };

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
          <button onClick={() => { setShowAiGenerator(true); setSelectedId(null); setEditForm(null); setEditingNode(null); }}
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

      <div className="flex flex-1 overflow-hidden" style={{ minHeight: fullscreen ? 0 : 500 }}>
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

        {/* Main Canvas Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {showAiGenerator ? (
            <AiGeneratorPanel
              aiPrompt={aiPrompt}
              setAiPrompt={setAiPrompt}
              generating={generating}
              generatedAutomation={generatedAutomation}
              savingNew={savingNew}
              onGenerate={handleGenerate}
              onSaveGenerated={handleSaveGenerated}
              onDiscard={() => setGeneratedAutomation(null)}
              onClose={() => { setShowAiGenerator(false); setGeneratedAutomation(null); setAiPrompt(""); }}
            />
          ) : selected && editForm ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Flow Action Bar */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-card flex-shrink-0">
                <div className="flex items-center gap-3">
                  <input
                    value={editForm.name}
                    onChange={e => handleNodeChange({ name: e.target.value })}
                    className="text-sm font-bold text-card-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5 max-w-[200px]"
                  />
                  <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold ${selected.active ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
                    {selected.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
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
                {/* React Flow Canvas */}
                <div className="flex-1 relative">
                  <ReactFlow
                    nodes={nodes}
                    edges={edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    nodeTypes={nodeTypes}
                    connectionMode={ConnectionMode.Loose}
                    fitView
                    fitViewOptions={{ padding: 0.4 }}
                    minZoom={0.3}
                    maxZoom={2}
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
                      pannable
                      zoomable
                    />
                  </ReactFlow>

                  {/* Click hint */}
                  {!editingNode && (
                    <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-card/80 backdrop-blur-sm border border-border text-[10px] text-muted-foreground shadow-lg animate-pulse">
                      Clique em um nó para editar
                    </div>
                  )}
                </div>

                {/* Node Editor Side Panel */}
                {editingNode && (
                  <div className="w-80 border-l border-border bg-card/95 backdrop-blur-sm flex-shrink-0 overflow-hidden animate-in slide-in-from-right-5 duration-200">
                    <NodeEditor
                      type={editingNode}
                      automation={editForm}
                      onChange={handleNodeChange}
                      onClose={() => setEditingNode(null)}
                    />
                  </div>
                )}

                {/* Phone Preview Panel */}
                {showPhone && (
                  <div className="w-[320px] border-l border-border bg-card/95 backdrop-blur-sm flex-shrink-0 overflow-auto py-6 animate-in slide-in-from-right-5 duration-200">
                    <PhonePreview
                      messageTemplate={editForm.message_template}
                      automationName={editForm.name}
                    />
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

// ─── AI Generator Panel ───
function AiGeneratorPanel({
  aiPrompt, setAiPrompt, generating, generatedAutomation, savingNew,
  onGenerate, onSaveGenerated, onDiscard, onClose,
}: {
  aiPrompt: string;
  setAiPrompt: (v: string) => void;
  generating: boolean;
  generatedAutomation: any;
  savingNew: boolean;
  onGenerate: () => void;
  onSaveGenerated: () => void;
  onDiscard: () => void;
  onClose: () => void;
}) {
  const suggestions = [
    "Resumo diário de performance às 18h para toda equipe com dicas da IA",
    "Lembrete de metas toda segunda às 9h para SDRs",
    "Relatório semanal de ranking para closers na sexta às 17h",
    "Motivação matinal diária às 8h para toda equipe",
  ];

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-lg w-full space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
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

        {/* Suggestions */}
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
          className="w-full rounded-2xl border border-border bg-secondary px-4 py-3 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none resize-none"
        />

        <div className="flex gap-2">
          <button onClick={onClose}
            className="px-4 py-2.5 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">
            Cancelar
          </button>
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
              <button onClick={onDiscard}
                className="px-4 py-2.5 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">
                Descartar
              </button>
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
