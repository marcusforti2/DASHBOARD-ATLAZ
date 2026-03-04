import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Zap, Clock, Target, MessageSquare, Send, Play, Pause, Trash2, Edit3, Save, X,
  Sparkles, ToggleLeft, ToggleRight, Loader2, Radio,
  Users, ShieldCheck, UserCheck, Bot, CheckCircle2, Plus, GripHorizontal
} from "lucide-react";

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

interface NodePosition {
  x: number;
  y: number;
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos", icon: Users },
  { value: "team", label: "Equipe", icon: UserCheck },
  { value: "sdrs", label: "SDRs", icon: UserCheck },
  { value: "closers", label: "Closers", icon: UserCheck },
  { value: "admins", label: "Admins", icon: ShieldCheck },
];

const SCHEDULE_PRESETS = [
  { label: "Manual", cron: null },
  { label: "8h Seg-Sex", cron: "0 11 * * 1-5" },
  { label: "12h Seg-Sex", cron: "0 15 * * 1-5" },
  { label: "18h Seg-Sex", cron: "0 21 * * 1-5" },
  { label: "Segunda 9h", cron: "0 12 * * 1" },
  { label: "Sexta 17h", cron: "0 20 * * 5" },
];

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

// ─── Canvas Node ───
const NODE_W = 180;
const NODE_H = 72;

type NodeType = "trigger" | "audience" | "message" | "send";

const NODE_CONFIG: Record<NodeType, { icon: any; label: string; color: string; bg: string; border: string }> = {
  trigger:  { icon: Clock,         label: "Gatilho",   color: "text-blue-500",   bg: "bg-blue-500/10",   border: "border-blue-500/40" },
  audience: { icon: Target,        label: "Público",   color: "text-purple-500", bg: "bg-purple-500/10", border: "border-purple-500/40" },
  message:  { icon: MessageSquare, label: "Mensagem",  color: "text-emerald-500",bg: "bg-emerald-500/10",border: "border-emerald-500/40" },
  send:     { icon: Send,          label: "Enviar",    color: "text-green-500",  bg: "bg-green-500/10",  border: "border-green-500/40" },
};

const FLOW_NODES: NodeType[] = ["trigger", "audience", "message", "send"];

function getDefaultPositions(): Record<NodeType, NodePosition> {
  return {
    trigger:  { x: 80,  y: 40 },
    audience: { x: 340, y: 40 },
    message:  { x: 600, y: 40 },
    send:     { x: 860, y: 40 },
  };
}

function CanvasNode({
  type, subtitle, active, selected, position, onSelect, onDrag,
}: {
  type: NodeType; subtitle: string; active: boolean; selected: boolean;
  position: NodePosition; onSelect: () => void;
  onDrag: (dx: number, dy: number) => void;
}) {
  const config = NODE_CONFIG[type];
  const Icon = config.icon;
  const dragRef = useRef<{ startX: number; startY: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { startX: e.clientX, startY: e.clientY };

    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      dragRef.current = { startX: ev.clientX, startY: ev.clientY };
      onDrag(dx, dy);
    };

    const handleMouseUp = () => {
      dragRef.current = null;
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      className={`absolute select-none cursor-grab active:cursor-grabbing transition-shadow ${
        selected ? "z-20" : "z-10"
      }`}
      style={{ left: position.x, top: position.y, width: NODE_W, height: NODE_H }}
      onMouseDown={handleMouseDown}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
    >
      <div className={`w-full h-full rounded-2xl border-2 ${config.border} ${config.bg} ${
        !active ? "opacity-50" : ""
      } ${selected ? "ring-2 ring-primary ring-offset-2 ring-offset-card shadow-lg" : "shadow-sm hover:shadow-md"
      } flex flex-col items-center justify-center gap-1.5 transition-all`}>
        <div className={`w-9 h-9 rounded-xl ${config.bg} flex items-center justify-center`}>
          <Icon size={18} className={config.color} />
        </div>
        <span className="text-[11px] font-bold text-card-foreground">{config.label}</span>
        <span className="text-[9px] text-muted-foreground truncate max-w-[150px] px-2 text-center">{subtitle}</span>
      </div>

      {/* Connection dot right */}
      {type !== "send" && (
        <div className="absolute top-1/2 -right-2 w-4 h-4 rounded-full bg-card border-2 border-border -translate-y-1/2 z-30" />
      )}
      {/* Connection dot left */}
      {type !== "trigger" && (
        <div className="absolute top-1/2 -left-2 w-4 h-4 rounded-full bg-card border-2 border-border -translate-y-1/2 z-30" />
      )}
    </div>
  );
}

// ─── SVG Connector ───
function SvgConnectors({ positions }: { positions: Record<NodeType, NodePosition> }) {
  const connections: [NodeType, NodeType][] = [
    ["trigger", "audience"],
    ["audience", "message"],
    ["message", "send"],
  ];

  return (
    <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
      <defs>
        <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
          <polygon points="0 0, 8 3, 0 6" className="fill-muted-foreground/40" />
        </marker>
      </defs>
      {connections.map(([from, to]) => {
        const x1 = positions[from].x + NODE_W + 2;
        const y1 = positions[from].y + NODE_H / 2;
        const x2 = positions[to].x - 2;
        const y2 = positions[to].y + NODE_H / 2;
        const cx1 = x1 + (x2 - x1) * 0.4;
        const cx2 = x1 + (x2 - x1) * 0.6;

        return (
          <path
            key={`${from}-${to}`}
            d={`M ${x1} ${y1} C ${cx1} ${y1}, ${cx2} ${y2}, ${x2} ${y2}`}
            fill="none"
            className="stroke-muted-foreground/30"
            strokeWidth={2}
            strokeDasharray="6 3"
            markerEnd="url(#arrowhead)"
          />
        );
      })}
    </svg>
  );
}

// ─── Node Editor Panel ───
function NodeEditorPanel({
  type, automation, onChange, onClose,
}: {
  type: NodeType; automation: Automation;
  onChange: (data: Partial<Automation>) => void; onClose: () => void;
}) {
  const config = NODE_CONFIG[type];
  const Icon = config.icon;

  return (
    <div className="bg-card border border-border rounded-2xl shadow-xl p-5 space-y-4 animate-in slide-in-from-right-4 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl ${config.bg} flex items-center justify-center`}>
            <Icon size={16} className={config.color} />
          </div>
          <span className="text-sm font-bold text-card-foreground">{config.label}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {type === "trigger" && (
        <div className="space-y-2">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quando disparar?</p>
          <div className="grid grid-cols-2 gap-2">
            {SCHEDULE_PRESETS.map(p => (
              <button key={p.label}
                onClick={() => onChange({ schedule_cron: p.cron })}
                className={`px-3 py-2.5 text-[11px] rounded-xl border transition-all ${
                  automation.schedule_cron === p.cron
                    ? "border-blue-500 bg-blue-500/15 text-blue-600 font-bold"
                    : "border-border bg-secondary text-secondary-foreground hover:border-blue-500/40"
                }`}>
                {p.cron === null ? <Radio size={10} className="inline mr-1.5" /> : <Clock size={10} className="inline mr-1.5" />}
                {p.label}
              </button>
            ))}
          </div>
          <div className="mt-2">
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Cron customizado (UTC)</label>
            <input
              value={automation.schedule_cron || ""}
              onChange={e => onChange({ schedule_cron: e.target.value || null })}
              placeholder="0 21 * * 1-5"
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-mono text-secondary-foreground focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {type === "audience" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quem recebe?</p>
          <div className="grid grid-cols-1 gap-2">
            {AUDIENCE_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              return (
                <button key={opt.value}
                  onClick={() => onChange({ target_audience: opt.value })}
                  className={`px-4 py-3 text-[11px] rounded-xl border transition-all flex items-center gap-2 ${
                    automation.target_audience === opt.value
                      ? "border-purple-500 bg-purple-500/15 text-purple-600 font-bold"
                      : "border-border bg-secondary text-secondary-foreground hover:border-purple-500/40"
                  }`}>
                  <OptIcon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex flex-col gap-2 mt-2">
            <button onClick={() => onChange({ include_metrics: !automation.include_metrics })}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {automation.include_metrics ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              📊 Incluir Métricas
            </button>
            <button onClick={() => onChange({ include_ai_tips: !automation.include_ai_tips })}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {automation.include_ai_tips ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              💡 Incluir Dicas IA
            </button>
          </div>
        </div>
      )}

      {type === "message" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Modelo da Mensagem</p>
          <textarea
            value={automation.message_template}
            onChange={e => onChange({ message_template: e.target.value })}
            rows={8}
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-[11px] font-mono text-secondary-foreground focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {["{{nome}}", "{{data}}", "{{role}}", "{{metricas_hoje}}", "{{progresso_meta}}", "{{dicas_ia}}"].map(v => (
              <button key={v}
                onClick={() => onChange({ message_template: automation.message_template + " " + v })}
                className="px-2 py-1 text-[9px] rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 font-mono transition-colors">
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === "send" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Entrega</p>
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 size={14} className="text-green-500" />
            <span className="text-[11px] text-card-foreground">
              A mensagem será enviada via WhatsApp para todos os contatos cadastrados do público <strong>{audienceLabel(automation.target_audience)}</strong>.
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Flow Builder ───
export default function FlowBuilder({ automations, onReload }: FlowBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNode, setEditingNode] = useState<NodeType | null>(null);
  const [editForm, setEditForm] = useState<Automation | null>(null);
  const [positions, setPositions] = useState<Record<NodeType, NodePosition>>(getDefaultPositions());
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedAutomation, setGeneratedAutomation] = useState<any>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const selected = automations.find(a => a.id === selectedId);

  // When selecting an automation, initialize edit form
  useEffect(() => {
    if (selected) {
      setEditForm({ ...selected });
      setPositions(getDefaultPositions());
      setEditingNode(null);
    }
  }, [selectedId]);

  const handleDrag = useCallback((nodeType: NodeType, dx: number, dy: number) => {
    setPositions(prev => ({
      ...prev,
      [nodeType]: { x: prev[nodeType].x + dx, y: prev[nodeType].y + dy },
    }));
  }, []);

  const handleNodeChange = (data: Partial<Automation>) => {
    setEditForm(prev => prev ? { ...prev, ...data } : prev);
  };

  const handleSave = async () => {
    if (!editForm || !selected) return;
    setSaving(true);
    const { error } = await supabase.from("whatsapp_automations").update({
      name: editForm.name,
      description: editForm.description,
      message_template: editForm.message_template,
      schedule_cron: editForm.schedule_cron || null,
      target_audience: editForm.target_audience,
      target_role: editForm.target_role,
      include_metrics: editForm.include_metrics,
      include_ai_tips: editForm.include_ai_tips,
    }).eq("id", selected.id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Fluxo salvo! ✅"); onReload(); }
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
      else if (data?.automation) { setGeneratedAutomation(data.automation); toast.success("Fluxo gerado!"); }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setGenerating(false);
  };

  const handleSaveGenerated = async () => {
    if (!generatedAutomation) return;
    setSavingNew(true);
    const { error } = await supabase.from("whatsapp_automations").insert({
      name: generatedAutomation.name || "Nova Automação",
      description: generatedAutomation.description || "",
      message_template: generatedAutomation.message_template || "",
      schedule_cron: generatedAutomation.schedule_cron || null,
      target_audience: generatedAutomation.target_audience || "all",
      target_role: generatedAutomation.target_role || null,
      include_metrics: generatedAutomation.include_metrics ?? true,
      include_ai_tips: generatedAutomation.include_ai_tips ?? true,
    });
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Fluxo salvo! 🎉");
      setGeneratedAutomation(null); setAiPrompt(""); setShowAiGenerator(false);
      onReload();
    }
    setSavingNew(false);
  };

  const getNodeSubtitle = (type: NodeType, auto: Automation): string => {
    switch (type) {
      case "trigger": return auto.schedule_cron ? cronToLabel(auto.schedule_cron) : "Disparo manual";
      case "audience": return audienceLabel(auto.target_audience);
      case "message": return auto.message_template?.substring(0, 30) + "..." || "Definir...";
      case "send": return "WhatsApp API";
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-secondary/30">
        <div className="flex items-center gap-3">
          <Zap size={16} className="text-green-500" />
          <span className="text-xs font-bold text-card-foreground uppercase tracking-wider">Flow Builder</span>
          <span className="px-2 py-0.5 text-[9px] rounded-full bg-accent text-accent-foreground font-semibold">{automations.length} fluxos</span>
        </div>
        <button onClick={() => { setShowAiGenerator(true); setSelectedId(null); setEditForm(null); setEditingNode(null); }}
          className="px-4 py-2 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm">
          <Sparkles size={12} /> Criar com IA
        </button>
      </div>

      <div className="flex" style={{ minHeight: 520 }}>
        {/* Flow List Sidebar */}
        <div className="w-56 border-r border-border bg-secondary/10 flex-shrink-0 overflow-auto">
          <div className="p-2 space-y-1">
            {automations.map(a => (
              <button key={a.id}
                onClick={() => { setSelectedId(a.id); setShowAiGenerator(false); }}
                className={`w-full text-left p-3 rounded-xl transition-all ${
                  selectedId === a.id ? "bg-primary/10 border border-primary/30" : "hover:bg-secondary border border-transparent"
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-card-foreground truncate">{a.name}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">
                      {a.schedule_cron ? cronToLabel(a.schedule_cron) : "Manual"} · {audienceLabel(a.target_audience)}
                    </p>
                  </div>
                </div>
              </button>
            ))}
            {automations.length === 0 && (
              <div className="p-8 text-center">
                <Zap size={20} className="mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-[10px] text-muted-foreground">Nenhum fluxo</p>
              </div>
            )}
          </div>
        </div>

        {/* Canvas Area */}
        <div className="flex-1 flex flex-col">
          {showAiGenerator ? (
            /* AI Generator */
            <div className="p-6 space-y-4 max-w-lg">
              <div className="flex items-center gap-2">
                <Sparkles size={18} className="text-primary" />
                <h3 className="text-sm font-bold text-card-foreground">Criar Fluxo com IA</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">Descreva o que quer e a IA monta o fluxo. Ex: <em>"Resumo diário às 18h para equipe com dicas"</em></p>
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                placeholder="Descreva a automação..."
                rows={3}
                className="w-full rounded-xl border border-border bg-secondary px-4 py-3 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => { setShowAiGenerator(false); setGeneratedAutomation(null); setAiPrompt(""); }}
                  className="px-4 py-2 text-[11px] rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancelar</button>
                <button onClick={handleGenerate} disabled={generating || aiPrompt.trim().length < 5}
                  className="px-5 py-2 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                  {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  {generating ? "Gerando..." : "Gerar Fluxo"}
                </button>
              </div>
              {generatedAutomation && (
                <div className="border-t border-border pt-4 mt-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Bot size={14} className="text-green-500" />
                    <h4 className="text-xs font-bold text-card-foreground">Fluxo gerado — revise antes de salvar</h4>
                  </div>
                  <div className="p-4 rounded-xl bg-secondary/50 border border-border space-y-2">
                    <p className="text-[11px]"><strong>Nome:</strong> {generatedAutomation.name}</p>
                    <p className="text-[11px]"><strong>Gatilho:</strong> {cronToLabel(generatedAutomation.schedule_cron)}</p>
                    <p className="text-[11px]"><strong>Público:</strong> {audienceLabel(generatedAutomation.target_audience)}</p>
                    <p className="text-[10px] font-mono bg-secondary p-2 rounded-lg border border-border whitespace-pre-wrap max-h-32 overflow-auto">
                      {generatedAutomation.message_template}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setGeneratedAutomation(null)}
                      className="px-4 py-2 text-[11px] rounded-xl bg-secondary text-secondary-foreground">Descartar</button>
                    <button onClick={handleSaveGenerated} disabled={savingNew}
                      className="px-5 py-2 text-[11px] rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
                      {savingNew ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Salvar Fluxo
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : selected && editForm ? (
            <>
              {/* Flow name + actions bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <input
                    value={editForm.name}
                    onChange={e => handleNodeChange({ name: e.target.value })}
                    className="text-sm font-bold text-card-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5"
                  />
                  <span className={`px-2 py-0.5 text-[9px] rounded-full font-bold ${selected.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {selected.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={handleDispatch} disabled={dispatching}
                    className="px-4 py-2 text-[10px] rounded-xl font-bold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 shadow-sm">
                    {dispatching ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
                    Disparar
                  </button>
                  <button onClick={() => handleToggle(selected.id, selected.active)}
                    className="px-3 py-2 text-[10px] rounded-xl font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5">
                    {selected.active ? <ToggleRight size={14} className="text-green-500" /> : <ToggleLeft size={14} />}
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

              {/* Canvas + Editor side panel */}
              <div className="flex flex-1 overflow-hidden">
                {/* Canvas */}
                <div
                  ref={canvasRef}
                  className="flex-1 relative overflow-auto"
                  style={{
                    backgroundImage: "radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                    minHeight: 400,
                  }}
                  onClick={() => setEditingNode(null)}
                >
                  <SvgConnectors positions={positions} />
                  {FLOW_NODES.map(type => (
                    <CanvasNode
                      key={type}
                      type={type}
                      subtitle={getNodeSubtitle(type, editForm)}
                      active={selected.active}
                      selected={editingNode === type}
                      position={positions[type]}
                      onSelect={() => setEditingNode(type)}
                      onDrag={(dx, dy) => handleDrag(type, dx, dy)}
                    />
                  ))}
                </div>

                {/* Side Editor Panel */}
                {editingNode && (
                  <div className="w-80 border-l border-border overflow-auto flex-shrink-0 p-4">
                    <NodeEditorPanel
                      type={editingNode}
                      automation={editForm}
                      onChange={handleNodeChange}
                      onClose={() => setEditingNode(null)}
                    />
                  </div>
                )}
              </div>
            </>
          ) : (
            /* Empty state */
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <div className="w-20 h-20 rounded-3xl bg-secondary/50 flex items-center justify-center mx-auto">
                  <Zap size={28} className="text-muted-foreground/40" />
                </div>
                <p className="text-xs text-muted-foreground">Selecione um fluxo ou crie um novo com IA</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
