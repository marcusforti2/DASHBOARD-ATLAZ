import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Zap, Clock, Target, MessageSquare, Send, Play, Trash2, Save, X,
  Sparkles, ToggleLeft, ToggleRight, Loader2, Radio,
  Users, ShieldCheck, UserCheck, Bot, CheckCircle2, Plus, Copy, ChevronRight,
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

type NodeType = "trigger" | "audience" | "message" | "send";

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

const NODE_META: Record<NodeType, { icon: any; label: string; colorClass: string; bgClass: string; borderClass: string; ringClass: string }> = {
  trigger:  { icon: Clock,         label: "Gatilho",  colorClass: "text-blue-400",    bgClass: "bg-blue-500/10",    borderClass: "border-blue-500/30",    ringClass: "ring-blue-500/50" },
  audience: { icon: Target,        label: "Público",  colorClass: "text-purple-400",  bgClass: "bg-purple-500/10",  borderClass: "border-purple-500/30",  ringClass: "ring-purple-500/50" },
  message:  { icon: MessageSquare, label: "Mensagem", colorClass: "text-emerald-400", bgClass: "bg-emerald-500/10", borderClass: "border-emerald-500/30", ringClass: "ring-emerald-500/50" },
  send:     { icon: Send,          label: "Enviar",   colorClass: "text-green-400",   bgClass: "bg-green-500/10",   borderClass: "border-green-500/30",   ringClass: "ring-green-500/50" },
};

const FLOW_STEPS: NodeType[] = ["trigger", "audience", "message", "send"];

// ─── Inline Node (clickable, no drag) ───
function FlowNode({ type, subtitle, active, selected, onClick }: {
  type: NodeType; subtitle: string; active: boolean; selected: boolean; onClick: () => void;
}) {
  const meta = NODE_META[type];
  const Icon = meta.icon;
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-[140px] rounded-2xl border-2 p-3 transition-all ${meta.borderClass} ${meta.bgClass} ${
        !active ? "opacity-40" : "hover:scale-105"
      } ${selected ? `ring-2 ${meta.ringClass} shadow-lg` : "shadow-sm"} flex flex-col items-center gap-1.5`}
    >
      <div className={`w-9 h-9 rounded-xl ${meta.bgClass} flex items-center justify-center`}>
        <Icon size={16} className={meta.colorClass} />
      </div>
      <span className="text-[11px] font-bold text-card-foreground">{meta.label}</span>
      <span className="text-[9px] text-muted-foreground truncate max-w-[120px] text-center">{subtitle}</span>
    </button>
  );
}

// ─── Arrow connector ───
function Arrow() {
  return (
    <div className="flex-shrink-0 flex items-center text-muted-foreground/40">
      <div className="w-6 h-px bg-muted-foreground/30" />
      <ChevronRight size={14} className="text-muted-foreground/40 -ml-1" />
    </div>
  );
}

// ─── Node Editor (inline below nodes) ───
function NodeEditor({ type, automation, onChange, onClose }: {
  type: NodeType; automation: Automation; onChange: (d: Partial<Automation>) => void; onClose: () => void;
}) {
  const meta = NODE_META[type];
  const Icon = meta.icon;

  return (
    <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-5 space-y-4 animate-in fade-in-0 slide-in-from-top-2 duration-200">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg ${meta.bgClass} flex items-center justify-center`}>
            <Icon size={14} className={meta.colorClass} />
          </div>
          <span className="text-sm font-bold text-card-foreground">{meta.label}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {type === "trigger" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quando disparar?</p>
          <div className="grid grid-cols-3 gap-2">
            {SCHEDULE_PRESETS.map(p => (
              <button key={p.label}
                onClick={() => onChange({ schedule_cron: p.cron })}
                className={`px-3 py-2.5 text-[11px] rounded-xl border transition-all ${
                  automation.schedule_cron === p.cron
                    ? "border-blue-500 bg-blue-500/15 text-blue-400 font-bold"
                    : "border-border bg-secondary text-secondary-foreground hover:border-blue-500/40"
                }`}>
                {p.cron === null ? <Radio size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Cron customizado (UTC)</label>
            <input
              value={automation.schedule_cron || ""}
              onChange={e => onChange({ schedule_cron: e.target.value || null })}
              placeholder="0 21 * * 1-5"
              className="mt-1 w-full max-w-xs rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-mono text-secondary-foreground focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {type === "audience" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quem recebe?</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              return (
                <button key={opt.value}
                  onClick={() => onChange({ target_audience: opt.value })}
                  className={`px-4 py-2.5 text-[11px] rounded-xl border transition-all flex items-center gap-2 ${
                    automation.target_audience === opt.value
                      ? "border-purple-500 bg-purple-500/15 text-purple-400 font-bold"
                      : "border-border bg-secondary text-secondary-foreground hover:border-purple-500/40"
                  }`}>
                  <OptIcon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            <button onClick={() => onChange({ include_metrics: !automation.include_metrics })}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {automation.include_metrics ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              📊 Métricas
            </button>
            <button onClick={() => onChange({ include_ai_tips: !automation.include_ai_tips })}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {automation.include_ai_tips ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              💡 Dicas IA
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
            rows={6}
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-[11px] font-mono text-secondary-foreground focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {["{{nome}}", "{{data}}", "{{role}}", "{{metricas_hoje}}", "{{progresso_meta}}", "{{ranking}}", "{{dicas_ia}}"].map(v => (
              <button key={v}
                onClick={() => onChange({ message_template: automation.message_template + " " + v })}
                className="px-2 py-1 text-[9px] rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-mono transition-colors">
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === "send" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-[11px] text-card-foreground">
            Enviará via WhatsApp para contatos do público <strong>{audienceLabel(automation.target_audience)}</strong>.
          </span>
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
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedAutomation, setGeneratedAutomation] = useState<any>(null);
  const [savingNew, setSavingNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dispatching, setDispatching] = useState(false);

  const selected = automations.find(a => a.id === selectedId);

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
    if (!editForm.name.trim()) { toast.error("O nome do fluxo não pode ficar vazio"); return; }
    setSaving(true);
    const currentId = selected.id;
    const { error } = await supabase.from("whatsapp_automations").update({
      name: editForm.name.trim(),
      description: editForm.description,
      message_template: editForm.message_template,
      schedule_cron: editForm.schedule_cron || null,
      target_audience: editForm.target_audience,
      target_role: editForm.target_role,
      include_metrics: editForm.include_metrics,
      include_ai_tips: editForm.include_ai_tips,
    }).eq("id", currentId);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Fluxo salvo! ✅"); await onReload(); setSelectedId(currentId); }
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
      const newId = data?.id;
      toast.success("Fluxo salvo! 🎉");
      setGeneratedAutomation(null); setAiPrompt(""); setShowAiGenerator(false);
      await onReload();
      if (newId) setTimeout(() => setSelectedId(newId), 100);
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
    const newId = data?.id;
    toast.success("Fluxo criado! Clique nos passos para editar ✨");
    setShowAiGenerator(false);
    await onReload();
    if (newId) setTimeout(() => setSelectedId(newId), 100);
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
      toast.success("Fluxo duplicado! ✨");
      await onReload();
      if (data?.id) setTimeout(() => setSelectedId(data.id), 100);
    }
  };

  const getNodeSubtitle = (type: NodeType, auto: Automation): string => {
    switch (type) {
      case "trigger": return auto.schedule_cron ? cronToLabel(auto.schedule_cron) : "Disparo manual";
      case "audience": return audienceLabel(auto.target_audience);
      case "message": return (auto.message_template || "").substring(0, 25) + "...";
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
        <div className="flex items-center gap-2">
          <button onClick={handleCreateBlank}
            className="px-4 py-2 text-[11px] rounded-xl font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1.5 border border-border">
            <Plus size={12} /> Novo fluxo
          </button>
          <button onClick={() => { setShowAiGenerator(true); setSelectedId(null); setEditForm(null); setEditingNode(null); }}
            className="px-4 py-2 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 shadow-sm">
            <Sparkles size={12} /> Criar com IA
          </button>
        </div>
      </div>

      <div className="flex" style={{ minHeight: 420 }}>
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
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${a.active ? "bg-green-500" : "bg-muted-foreground/30"}`} />
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
                  title="Duplicar fluxo"
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

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-auto">
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
            <div className="flex-1 flex flex-col">
              {/* Flow name + actions bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
                <div className="flex items-center gap-3">
                  <input
                    value={editForm.name}
                    onChange={e => handleNodeChange({ name: e.target.value })}
                    className="text-sm font-bold text-card-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none px-1 py-0.5 max-w-[200px]"
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

              {/* Flow Pipeline (horizontal nodes) */}
              <div className="px-6 py-6">
                <div className="flex items-center justify-center gap-0">
                  {FLOW_STEPS.map((type, i) => (
                    <div key={type} className="flex items-center">
                      <FlowNode
                        type={type}
                        subtitle={getNodeSubtitle(type, editForm)}
                        active={selected.active}
                        selected={editingNode === type}
                        onClick={() => setEditingNode(editingNode === type ? null : type)}
                      />
                      {i < FLOW_STEPS.length - 1 && <Arrow />}
                    </div>
                  ))}
                </div>
              </div>

              {/* Inline editor below nodes */}
              {editingNode && (
                <div className="px-6 pb-6">
                  <NodeEditor
                    type={editingNode}
                    automation={editForm}
                    onChange={handleNodeChange}
                    onClose={() => setEditingNode(null)}
                  />
                </div>
              )}
            </div>
          ) : (
            /* Empty state */
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
