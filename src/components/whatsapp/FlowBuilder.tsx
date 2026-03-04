import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Zap, Clock, Target, MessageSquare, Send, Play, Pause, Trash2, Edit3, Save, X,
  ChevronRight, Sparkles, ToggleLeft, ToggleRight, Loader2, ArrowDown, Radio,
  Users, ShieldCheck, UserCheck, Bot, FileText, CheckCircle2, AlertCircle
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

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos (Equipe + Admins)", icon: Users },
  { value: "team", label: "Só Equipe (SDRs + Closers)", icon: UserCheck },
  { value: "sdrs", label: "Só SDRs", icon: UserCheck },
  { value: "closers", label: "Só Closers", icon: UserCheck },
  { value: "admins", label: "Só Administradores", icon: ShieldCheck },
];

const SCHEDULE_PRESETS = [
  { label: "Manual (sem agendamento)", cron: null },
  { label: "Diário 8h (Seg-Sex)", cron: "0 11 * * 1-5" },
  { label: "Diário 12h (Seg-Sex)", cron: "0 15 * * 1-5" },
  { label: "Diário 18h (Seg-Sex)", cron: "0 21 * * 1-5" },
  { label: "Segunda 9h", cron: "0 12 * * 1" },
  { label: "Sexta 17h", cron: "0 20 * * 5" },
  { label: "Personalizado", cron: "custom" },
];

function cronToLabel(cron: string | null): string {
  if (!cron) return "Manual";
  const presets: Record<string, string> = {
    "0 11 * * 1-5": "8h Seg-Sex",
    "0 15 * * 1-5": "12h Seg-Sex",
    "0 21 * * 1-5": "18h Seg-Sex",
    "0 12 * * 1": "Segunda 9h",
    "0 20 * * 5": "Sexta 17h",
  };
  return presets[cron] || cron;
}

function audienceLabel(a: string): string {
  return { all: "Todos", sdrs: "SDRs", closers: "Closers", admins: "Admins", team: "Equipe" }[a] || a;
}

function audienceIcon(a: string) {
  return a === "admins" ? ShieldCheck : Users;
}

// ─── Flow Node Component ───
function FlowNode({ icon: Icon, label, color, children, dashed, active = true }: {
  icon: any; label: string; color: string; children: React.ReactNode; dashed?: boolean; active?: boolean;
}) {
  return (
    <div className={`relative rounded-xl border-2 p-4 transition-all ${dashed ? "border-dashed" : ""} ${active ? `border-${color}/30 bg-${color}/5` : "border-border/40 bg-muted/30 opacity-60"}`}
      >
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${active ? "bg-primary/15" : "bg-muted"}`}>
          <Icon size={14} className={active ? "text-primary" : "text-muted-foreground"} />
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
      </div>
      {children}
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex justify-center py-1">
      <div className="flex flex-col items-center">
        <div className="w-0.5 h-4 bg-border" />
        <ArrowDown size={12} className="text-muted-foreground -mt-0.5" />
      </div>
    </div>
  );
}

// ─── Flow View (Read-Only) ───
function FlowView({ automation, onEdit, onToggle, onDelete, onDispatch }: {
  automation: Automation;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
  onDispatch: () => void;
}) {
  const [dispatching, setDispatching] = useState(false);

  const handleDispatch = async () => {
    setDispatching(true);
    try {
      const { data, error } = await supabase.functions.invoke("daily-whatsapp-report", {
        body: { automation_id: automation.id },
      });
      if (error) toast.error("Erro: " + error.message);
      else if (data?.error) toast.error("Erro: " + data.error);
      else {
        const sc = data?.results?.filter((r: any) => r.success).length || 0;
        toast.success(`Enviado para ${sc}/${data?.results?.length || 0} contatos!`);
      }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setDispatching(false);
    onDispatch();
  };

  const AudienceIcon = audienceIcon(automation.target_audience);

  return (
    <div className="space-y-0">
      {/* Step 1: Trigger */}
      <FlowNode icon={automation.schedule_cron ? Clock : Radio} label="Gatilho" color="blue" active={automation.active}>
        <div className="flex items-center gap-2">
          {automation.schedule_cron ? (
            <>
              <Clock size={12} className="text-blue-500" />
              <span className="text-xs font-semibold text-card-foreground">Agendamento: {cronToLabel(automation.schedule_cron)}</span>
            </>
          ) : (
            <>
              <Radio size={12} className="text-orange-500" />
              <span className="text-xs font-semibold text-card-foreground">Disparo Manual</span>
            </>
          )}
        </div>
      </FlowNode>

      <FlowConnector />

      {/* Step 2: Audience Filter */}
      <FlowNode icon={AudienceIcon} label="Filtro de Público" color="purple" active={automation.active}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 text-[10px] font-semibold rounded-full bg-purple-500/15 text-purple-600">
            <Target size={9} className="inline mr-1" />
            {audienceLabel(automation.target_audience)}
          </span>
          {automation.include_metrics && (
            <span className="px-2 py-1 text-[10px] rounded-full bg-blue-500/10 text-blue-600">📊 Com Métricas</span>
          )}
          {automation.include_ai_tips && (
            <span className="px-2 py-1 text-[10px] rounded-full bg-amber-500/10 text-amber-600">💡 Com Dicas IA</span>
          )}
        </div>
      </FlowNode>

      <FlowConnector />

      {/* Step 3: Message */}
      <FlowNode icon={MessageSquare} label="Mensagem" color="green" active={automation.active}>
        <pre className="p-3 rounded-lg bg-secondary text-[10px] text-secondary-foreground whitespace-pre-wrap font-mono border border-border max-h-40 overflow-auto">
          {automation.message_template}
        </pre>
        <p className="text-[9px] text-muted-foreground mt-2">
          Variáveis: {"{{nome}}"} {"{{data}}"} {"{{role}}"} {"{{metricas_hoje}}"} {"{{progresso_meta}}"} {"{{dicas_ia}}"}
        </p>
      </FlowNode>

      <FlowConnector />

      {/* Step 4: Delivery */}
      <FlowNode icon={Send} label="Entrega via WhatsApp" color="green" active={automation.active}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={12} className="text-green-500" />
          <span className="text-[11px] text-card-foreground">
            Enviado para <strong>{audienceLabel(automation.target_audience)}</strong> com contato cadastrado
          </span>
        </div>
      </FlowNode>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 mt-2">
        <button onClick={handleDispatch} disabled={dispatching}
          className="px-4 py-2 text-[10px] rounded-lg font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm">
          {dispatching ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
          Disparar Agora
        </button>
        <button onClick={onToggle}
          className={`px-3 py-2 text-[10px] rounded-lg font-medium flex items-center gap-1.5 transition-colors ${automation.active ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
          {automation.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
          {automation.active ? "Ativa" : "Inativa"}
        </button>
        <button onClick={onEdit}
          className="px-3 py-2 text-[10px] rounded-lg font-medium bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5 transition-colors">
          <Edit3 size={10} /> Editar Fluxo
        </button>
        <button onClick={onDelete}
          className="px-3 py-2 text-[10px] rounded-lg font-medium text-destructive hover:bg-destructive/10 flex items-center gap-1.5 transition-colors">
          <Trash2 size={10} /> Excluir
        </button>
      </div>
      <p className="text-[9px] text-muted-foreground mt-1">
        Criada em {new Date(automation.created_at).toLocaleDateString("pt-BR")} · Atualizada: {new Date(automation.updated_at).toLocaleDateString("pt-BR")}
      </p>
    </div>
  );
}

// ─── Flow Editor ───
function FlowEditor({ automation, onSave, onCancel }: {
  automation: Automation;
  onSave: (data: Partial<Automation>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({ ...automation });
  const [saving, setSaving] = useState(false);
  const [customCron, setCustomCron] = useState(
    SCHEDULE_PRESETS.some(p => p.cron === form.schedule_cron) ? false : !!form.schedule_cron
  );

  const handleSave = async () => {
    setSaving(true);
    await onSave({
      name: form.name,
      description: form.description,
      message_template: form.message_template,
      schedule_cron: form.schedule_cron || null,
      target_audience: form.target_audience,
      target_role: form.target_role,
      include_metrics: form.include_metrics,
      include_ai_tips: form.include_ai_tips,
    });
    setSaving(false);
  };

  return (
    <div className="space-y-0">
      {/* Header */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 mb-0">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <FileText size={14} className="text-primary" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Informações</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase">Nome</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>
          <div>
            <label className="text-[9px] font-semibold text-muted-foreground uppercase">Descrição</label>
            <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none" />
          </div>
        </div>
      </div>

      <FlowConnector />

      {/* Step 1: Trigger */}
      <div className="rounded-xl border-2 border-blue-500/30 bg-blue-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <Clock size={14} className="text-blue-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Gatilho</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {SCHEDULE_PRESETS.map(preset => (
            <button key={preset.label}
              onClick={() => {
                if (preset.cron === "custom") { setCustomCron(true); }
                else { setCustomCron(false); setForm(p => ({ ...p, schedule_cron: preset.cron })); }
              }}
              className={`px-3 py-2 text-[10px] rounded-lg border transition-all text-left ${
                (!customCron && form.schedule_cron === preset.cron) || (customCron && preset.cron === "custom")
                  ? "border-blue-500 bg-blue-500/15 text-blue-600 font-semibold"
                  : "border-border bg-secondary text-secondary-foreground hover:border-blue-500/50"
              }`}>
              {preset.cron === null ? <Radio size={10} className="inline mr-1" /> : preset.cron === "custom" ? <Edit3 size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
              {preset.label}
            </button>
          ))}
        </div>
        {customCron && (
          <div className="mt-3">
            <label className="text-[9px] font-semibold text-muted-foreground uppercase">Expressão Cron (UTC)</label>
            <input value={form.schedule_cron || ""} onChange={e => setForm(p => ({ ...p, schedule_cron: e.target.value || null }))}
              placeholder="0 21 * * 1-5"
              className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
            <p className="text-[9px] text-muted-foreground mt-1">Lembre: UTC-3 → adicione 3h. Ex: 18h BRT = "0 21 * * 1-5"</p>
          </div>
        )}
      </div>

      <FlowConnector />

      {/* Step 2: Audience */}
      <div className="rounded-xl border-2 border-purple-500/30 bg-purple-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
            <Target size={14} className="text-purple-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Filtro de Público</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {AUDIENCE_OPTIONS.map(opt => {
            const Icon = opt.icon;
            return (
              <button key={opt.value}
                onClick={() => setForm(p => ({ ...p, target_audience: opt.value }))}
                className={`px-3 py-2 text-[10px] rounded-lg border transition-all text-left flex items-center gap-1.5 ${
                  form.target_audience === opt.value
                    ? "border-purple-500 bg-purple-500/15 text-purple-600 font-semibold"
                    : "border-border bg-secondary text-secondary-foreground hover:border-purple-500/50"
                }`}>
                <Icon size={10} />
                {opt.label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3">
          <button onClick={() => setForm(p => ({ ...p, include_metrics: !p.include_metrics }))}
            className="flex items-center gap-1.5 text-[10px] text-card-foreground">
            {form.include_metrics ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
            📊 Incluir Métricas
          </button>
          <button onClick={() => setForm(p => ({ ...p, include_ai_tips: !p.include_ai_tips }))}
            className="flex items-center gap-1.5 text-[10px] text-card-foreground">
            {form.include_ai_tips ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
            💡 Incluir Dicas IA
          </button>
        </div>
      </div>

      <FlowConnector />

      {/* Step 3: Message */}
      <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-4">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
            <MessageSquare size={14} className="text-green-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mensagem</span>
        </div>
        <textarea value={form.message_template} onChange={e => setForm(p => ({ ...p, message_template: e.target.value }))}
          rows={8}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-[11px] text-secondary-foreground focus:ring-2 focus:ring-green-500 outline-none resize-none font-mono" />
        <div className="mt-2 flex flex-wrap gap-1.5">
          {["{{nome}}", "{{data}}", "{{role}}", "{{metricas_hoje}}", "{{metricas_mes}}", "{{progresso_meta}}", "{{falta_meta}}", "{{dicas_ia}}"].map(v => (
            <button key={v} onClick={() => setForm(p => ({ ...p, message_template: p.message_template + " " + v }))}
              className="px-2 py-0.5 text-[9px] rounded bg-green-500/10 text-green-600 hover:bg-green-500/20 font-mono transition-colors">
              {v}
            </button>
          ))}
        </div>
      </div>

      <FlowConnector />

      {/* Step 4: Delivery */}
      <div className="rounded-xl border-2 border-green-500/30 bg-green-500/5 p-4">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-green-500/15 flex items-center justify-center">
            <Send size={14} className="text-green-500" />
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Entrega via WhatsApp</span>
        </div>
        <p className="text-[10px] text-muted-foreground mt-2">A mensagem será enviada para todos os contatos cadastrados do público selecionado.</p>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 pt-4">
        <button onClick={onCancel}
          className="px-4 py-2 text-[10px] rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1.5 transition-colors">
          <X size={10} /> Cancelar
        </button>
        <button onClick={handleSave} disabled={saving || !form.name || !form.message_template}
          className="px-5 py-2 text-[10px] rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors shadow-sm">
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
          Salvar Fluxo
        </button>
      </div>
    </div>
  );
}

// ─── Main Flow Builder ───
export default function FlowBuilder({ automations, onReload }: FlowBuilderProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedAutomation, setGeneratedAutomation] = useState<any>(null);
  const [savingNew, setSavingNew] = useState(false);

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("whatsapp_automations").update({ active: !active }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(active ? "Desativada" : "Ativada"); onReload(); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta automação permanentemente?")) return;
    const { error } = await supabase.from("whatsapp_automations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluída"); if (selectedId === id) setSelectedId(null); onReload(); }
  };

  const handleSaveEdit = async (id: string, data: Partial<Automation>) => {
    const { error } = await supabase.from("whatsapp_automations").update(data).eq("id", id);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Fluxo atualizado! ✅"); setEditingId(null); onReload(); }
  };

  const handleGenerate = async () => {
    if (aiPrompt.trim().length < 5) { toast.error("Descreva melhor a automação"); return; }
    setGenerating(true); setGeneratedAutomation(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-automation", { body: { prompt: aiPrompt.trim() } });
      if (error) toast.error("Erro: " + error.message);
      else if (data?.error) toast.error("Erro: " + data.error);
      else if (data?.automation) { setGeneratedAutomation(data.automation); toast.success("Fluxo gerado! Revise e salve."); }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setGenerating(false);
  };

  const handleSaveGenerated = async (data: Partial<Automation>) => {
    setSavingNew(true);
    const { error } = await supabase.from("whatsapp_automations").insert({
      name: data.name || "Nova Automação",
      description: data.description || "",
      message_template: data.message_template || "",
      schedule_cron: data.schedule_cron || null,
      target_audience: data.target_audience || "all",
      target_role: data.target_role || null,
      include_metrics: data.include_metrics ?? true,
      include_ai_tips: data.include_ai_tips ?? true,
    });
    if (error) toast.error("Erro: " + error.message);
    else {
      toast.success("Fluxo salvo! 🎉");
      setGeneratedAutomation(null);
      setAiPrompt("");
      setShowAiGenerator(false);
      onReload();
    }
    setSavingNew(false);
  };

  const selected = automations.find(a => a.id === selectedId);

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex flex-col lg:flex-row" style={{ minHeight: "500px" }}>
        {/* Sidebar - List */}
        <div className="w-full lg:w-72 border-b lg:border-b-0 lg:border-r border-border bg-secondary/20 flex-shrink-0">
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-green-500" />
                <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">Fluxos</h3>
                <span className="px-1.5 py-0.5 text-[9px] rounded-full bg-accent text-accent-foreground font-semibold">{automations.length}</span>
              </div>
            </div>
            <button onClick={() => { setShowAiGenerator(true); setSelectedId(null); setEditingId(null); }}
              className="w-full px-3 py-2 text-[10px] rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5">
              <Sparkles size={10} /> Criar Fluxo com IA
            </button>
          </div>

          <div className="p-2 space-y-1 max-h-96 lg:max-h-[500px] overflow-auto">
            {automations.map(a => (
              <button key={a.id}
                onClick={() => { setSelectedId(a.id); setEditingId(null); setShowAiGenerator(false); }}
                className={`w-full text-left p-3 rounded-lg transition-all ${
                  selectedId === a.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-secondary border border-transparent"
                }`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${a.active ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-semibold text-card-foreground truncate">{a.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        {a.schedule_cron ? <><Clock size={8} className="inline mr-0.5" />{cronToLabel(a.schedule_cron)}</> : <><Radio size={8} className="inline mr-0.5" />Manual</>}
                      </span>
                      <span className="text-[9px] text-muted-foreground">·</span>
                      <span className="text-[9px] text-muted-foreground">{audienceLabel(a.target_audience)}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {automations.length === 0 && !showAiGenerator && (
              <div className="p-6 text-center">
                <Zap size={20} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-[10px] text-muted-foreground">Nenhum fluxo criado</p>
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 p-5 overflow-auto">
          {showAiGenerator ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <h3 className="text-sm font-bold text-card-foreground">Criar Fluxo com IA</h3>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Descreva o que você quer e a IA cria o fluxo completo. Depois você pode editar cada etapa.
              </p>
              <p className="text-[10px] text-muted-foreground italic">
                Ex: "Enviar resumo diário às 18h para toda a equipe com métricas e dicas" ou "Ranking semanal toda sexta para os admins"
              </p>
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)}
                placeholder="Descreva a automação que deseja criar..."
                rows={3}
                className="w-full rounded-lg border border-border bg-secondary px-4 py-3 text-xs text-secondary-foreground focus:ring-2 focus:ring-primary outline-none resize-none" />
              <div className="flex gap-2">
                <button onClick={() => { setShowAiGenerator(false); setGeneratedAutomation(null); setAiPrompt(""); }}
                  className="px-4 py-2 text-[10px] rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
                  Cancelar
                </button>
                <button onClick={handleGenerate} disabled={generating || aiPrompt.trim().length < 5}
                  className="px-5 py-2 text-[10px] rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
                  {generating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
                  {generating ? "Gerando fluxo..." : "Gerar Fluxo"}
                </button>
              </div>

              {generatedAutomation && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot size={14} className="text-green-500" />
                    <h4 className="text-xs font-bold text-card-foreground">Fluxo Gerado — Revise e edite antes de salvar</h4>
                  </div>
                  <FlowEditor
                    automation={{
                      id: "new",
                      ...generatedAutomation,
                      active: true,
                      created_at: new Date().toISOString(),
                      updated_at: new Date().toISOString(),
                    }}
                    onSave={handleSaveGenerated}
                    onCancel={() => setGeneratedAutomation(null)}
                  />
                </div>
              )}
            </div>
          ) : selected && editingId === selected.id ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Edit3 size={14} className="text-primary" />
                <h3 className="text-sm font-bold text-card-foreground">Editando: {selected.name}</h3>
              </div>
              <FlowEditor
                automation={selected}
                onSave={(data) => handleSaveEdit(selected.id, data)}
                onCancel={() => setEditingId(null)}
              />
            </div>
          ) : selected ? (
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Zap size={14} className={selected.active ? "text-green-500" : "text-muted-foreground"} />
                  <h3 className="text-sm font-bold text-card-foreground">{selected.name}</h3>
                  <span className={`px-2 py-0.5 text-[9px] rounded-full font-semibold ${selected.active ? "bg-green-500/15 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    {selected.active ? "Ativa" : "Inativa"}
                  </span>
                </div>
              </div>
              {selected.description && (
                <p className="text-[11px] text-muted-foreground mb-4">{selected.description}</p>
              )}
              <FlowView
                automation={selected}
                onEdit={() => setEditingId(selected.id)}
                onToggle={() => handleToggle(selected.id, selected.active)}
                onDelete={() => handleDelete(selected.id)}
                onDispatch={() => {}}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mx-auto">
                  <Zap size={24} className="text-muted-foreground" />
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
