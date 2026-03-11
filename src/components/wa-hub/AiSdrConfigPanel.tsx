import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Loader2, Save, Settings2, MessageSquare, Users, Clock, Sparkles,
  Phone, CalendarClock, Shield, BarChart3, Send, Brain, AlertTriangle,
  MessageCircle, Zap,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface AiSdrConfig {
  greeting: string;
  tone: string;
  auto_tag: boolean;
  max_messages_before_handoff: number;
  business_hours_only: boolean;
  prompt_context: string;
  follow_up_hours: number;
  follow_up_enabled: boolean;
  call_focus_mode: boolean;
  feature_auto_reply: boolean;
  feature_auto_tag: boolean;
  feature_qualification: boolean;
  feature_handoff: boolean;
  feature_sentiment: boolean;
  feature_pipedrive_sync: boolean;
  split_messages: boolean;
  urgent_call_alert: boolean;
  meeting_followups: boolean;
  master_prompt: string;
  organic_mode_enabled: boolean;
  organic_prompt: string;
  organic_tone: string;
}

interface Props {
  instanceId: string;
  instanceName: string;
  aiSdrEnabled: boolean;
  aiSdrConfig: AiSdrConfig;
  onUpdate: () => void;
}

const DEFAULT_CONFIG: AiSdrConfig = {
  greeting: "Olá! 👋 Obrigado por entrar em contato. Como posso ajudar você hoje?",
  tone: "profissional",
  auto_tag: true,
  max_messages_before_handoff: 10,
  business_hours_only: false,
  prompt_context: "",
  follow_up_hours: 24,
  follow_up_enabled: true,
  call_focus_mode: true,
  feature_auto_reply: true,
  feature_auto_tag: true,
  feature_qualification: true,
  feature_handoff: true,
  feature_sentiment: false,
  feature_pipedrive_sync: false,
  split_messages: true,
  urgent_call_alert: true,
  meeting_followups: true,
  master_prompt: "",
  organic_mode_enabled: true,
  organic_prompt: "",
  organic_tone: "cordial e prestativo",
};

const TONES = [
  { value: "profissional", label: "Profissional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "consultivo", label: "Consultivo", emoji: "🎯" },
  { value: "energetico", label: "Energético", emoji: "⚡" },
];

export function AiSdrConfigPanel({ instanceId, instanceName, aiSdrEnabled, aiSdrConfig, onUpdate }: Props) {
  const config = { ...DEFAULT_CONFIG, ...aiSdrConfig };
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<AiSdrConfig>(config);
  const [activeSection, setActiveSection] = useState<string | null>("automations");

  const handleToggle = async () => {
    setToggling(true);
    const { error } = await supabase
      .from("wa_instances")
      .update({ ai_sdr_enabled: !aiSdrEnabled } as any)
      .eq("id", instanceId);
    setToggling(false);
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(aiSdrEnabled ? "SDR IA desativada" : "SDR IA ativada! 🤖");
    onUpdate();
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("wa_instances")
      .update({ ai_sdr_config: localConfig } as any)
      .eq("id", instanceId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração da SDR IA salva! ✅");
    onUpdate();
  };

  const update = (key: keyof AiSdrConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const toggleSection = (section: string) => {
    setActiveSection(prev => prev === section ? null : section);
  };

  const ToggleItem = ({ label, icon, value, configKey, description }: {
    label: string; icon: React.ReactNode; value: boolean; configKey: keyof AiSdrConfig; description?: string;
  }) => (
    <div className="flex items-start gap-3 py-2">
      <button onClick={() => update(configKey, !value)} className="mt-0.5 shrink-0">
        {value ? <ToggleRight size={20} className="text-primary" /> : <ToggleLeft size={20} className="text-muted-foreground" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-card-foreground">
          {icon} {label}
        </div>
        {description && <p className="text-[9px] text-muted-foreground mt-0.5">{description}</p>}
      </div>
    </div>
  );

  const SectionHeader = ({ id, label, icon, count }: { id: string; label: string; icon: React.ReactNode; count?: number }) => (
    <button onClick={() => toggleSection(id)}
      className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors">
      <div className="flex items-center gap-2 text-[11px] font-bold text-card-foreground">
        {icon} {label}
        {count !== undefined && (
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">{count} ativas</span>
        )}
      </div>
      {activeSection === id ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
    </button>
  );

  const automationCount = [
    localConfig.feature_auto_reply,
    localConfig.feature_auto_tag,
    localConfig.feature_qualification,
    localConfig.feature_handoff,
    localConfig.feature_sentiment,
    localConfig.feature_pipedrive_sync,
    localConfig.call_focus_mode,
    localConfig.follow_up_enabled,
    localConfig.split_messages,
    localConfig.urgent_call_alert,
    localConfig.meeting_followups,
  ].filter(Boolean).length;

  return (
    <div className={`rounded-xl border transition-all ${aiSdrEnabled ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/20"}`}>
      {/* Toggle Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${aiSdrEnabled ? "bg-primary/20" : "bg-muted"}`}>
            <Bot size={16} className={aiSdrEnabled ? "text-primary" : "text-muted-foreground"} />
          </div>
          <div>
            <p className="text-xs font-bold text-card-foreground flex items-center gap-2">
              SDR IA
              {aiSdrEnabled && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold animate-pulse">
                  ATIVA
                </span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {aiSdrEnabled ? `${automationCount} automações ativas` : "Agente de IA desativado"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {aiSdrEnabled && (
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <Settings2 size={14} className="text-muted-foreground" />}
            </button>
          )}
          <button onClick={handleToggle} disabled={toggling}
            className="flex items-center gap-1.5 transition-colors">
            {toggling ? (
              <Loader2 size={18} className="animate-spin text-primary" />
            ) : aiSdrEnabled ? (
              <ToggleRight size={24} className="text-primary" />
            ) : (
              <ToggleLeft size={24} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {expanded && aiSdrEnabled && (
        <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3 animate-in slide-in-from-top-2 duration-200">

          {/* === AUTOMAÇÕES === */}
          <SectionHeader id="automations" label="Automações" icon={<Zap size={12} />} count={automationCount} />
          {activeSection === "automations" && (
            <div className="pl-2 space-y-1 border-l-2 border-primary/20 ml-2">
              <ToggleItem
                label="Resposta Automática"
                icon={<Send size={11} />}
                value={localConfig.feature_auto_reply}
                configKey="feature_auto_reply"
                description="IA responde leads automaticamente via WhatsApp"
              />
              <ToggleItem
                label="Foco em Ligação"
                icon={<Phone size={11} />}
                value={localConfig.call_focus_mode}
                configKey="call_focus_mode"
                description="IA prioriza agendar ligação em 3-4 trocas de msg"
              />
              <ToggleItem
                label="Mensagens Quebradas"
                icon={<MessageCircle size={11} />}
                value={localConfig.split_messages}
                configKey="split_messages"
                description="Divide resposta em várias msgs curtas (mais humano)"
              />
              <ToggleItem
                label="Follow-up Automático"
                icon={<CalendarClock size={11} />}
                value={localConfig.follow_up_enabled}
                configKey="follow_up_enabled"
                description={`Reenvia msg se lead não responder em ${localConfig.follow_up_hours}h`}
              />
              <ToggleItem
                label="Alerta Urgente (Ligar Agora)"
                icon={<AlertTriangle size={11} />}
                value={localConfig.urgent_call_alert}
                configKey="urgent_call_alert"
                description="Se lead pedir pra ligar na hora, alerta o closer por WhatsApp"
              />
              <ToggleItem
                label="Follow-up Pré-Reunião"
                icon={<CalendarClock size={11} />}
                value={localConfig.meeting_followups}
                configKey="meeting_followups"
                description="Envia lembrete 6h e 1h antes da ligação confirmada"
              />
              <ToggleItem
                label="Auto-Etiquetas"
                icon={<span className="text-[11px]">🏷️</span>}
                value={localConfig.feature_auto_tag}
                configKey="feature_auto_tag"
                description="IA classifica e etiqueta leads automaticamente"
              />
              <ToggleItem
                label="Qualificação Automática"
                icon={<Shield size={11} />}
                value={localConfig.feature_qualification}
                configKey="feature_qualification"
                description="IA qualifica leads (A/B/C) e busca agenda do closer"
              />
              <ToggleItem
                label="Handoff Automático"
                icon={<Users size={11} />}
                value={localConfig.feature_handoff}
                configKey="feature_handoff"
                description="Transfere para humano quando lead qualifica ou excede msgs"
              />
              <ToggleItem
                label="Análise de Sentimento"
                icon={<Brain size={11} />}
                value={localConfig.feature_sentiment}
                configKey="feature_sentiment"
                description="Analisa se lead está positivo, neutro ou negativo"
              />
              <ToggleItem
                label="Sync Pipedrive"
                icon={<BarChart3 size={11} />}
                value={localConfig.feature_pipedrive_sync}
                configKey="feature_pipedrive_sync"
                description="Sincroniza qualificação e notas com Pipedrive"
              />
              <ToggleItem
                label="Só Horário Comercial"
                icon={<Clock size={11} />}
                value={localConfig.business_hours_only}
                configKey="business_hours_only"
                description="IA só responde entre 9h e 18h (Seg-Sex)"
              />
            </div>
          )}

          {/* === CONFIGURAÇÕES === */}
          <SectionHeader id="settings" label="Configurações" icon={<Settings2 size={12} />} />
          {activeSection === "settings" && (
            <div className="space-y-4 pl-2">
              {/* Tone */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tom da conversa</label>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {TONES.map(t => (
                    <button key={t.value} onClick={() => update("tone", t.value)}
                      className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all flex items-center gap-1 ${
                        localConfig.tone === t.value
                          ? "border-primary bg-primary/15 text-primary font-bold"
                          : "border-border bg-secondary text-secondary-foreground hover:border-primary/40"
                      }`}>
                      {t.emoji} {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Greeting */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare size={10} /> Primeira mensagem
                </label>
                <Textarea
                  value={localConfig.greeting}
                  onChange={e => update("greeting", e.target.value)}
                  placeholder="Olá! 👋 Como posso ajudar?"
                  rows={2}
                  className="mt-1 text-xs resize-none"
                />
              </div>

              {/* Max messages before handoff */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Users size={10} /> Transferir para humano após
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number" min={3} max={50}
                    value={localConfig.max_messages_before_handoff}
                    onChange={e => update("max_messages_before_handoff", parseInt(e.target.value) || 10)}
                    className="h-8 w-20 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">mensagens</span>
                </div>
              </div>

              {/* Follow-up hours */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <CalendarClock size={10} /> Tempo de follow-up
                </label>
                <div className="mt-1 flex items-center gap-2">
                  <Input
                    type="number" min={1} max={168}
                    value={localConfig.follow_up_hours}
                    onChange={e => update("follow_up_hours", parseInt(e.target.value) || 24)}
                    className="h-8 w-20 text-xs"
                  />
                  <span className="text-[11px] text-muted-foreground">horas</span>
                </div>
              </div>
            </div>
          )}

          {/* === PROMPTS === */}
          <SectionHeader id="prompts" label="Prompts & Contexto" icon={<Sparkles size={12} />} />
          {activeSection === "prompts" && (
            <div className="space-y-4 pl-2">
              {/* Master Prompt */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Shield size={10} /> Regras absolutas (Master Prompt)
                </label>
                <Textarea
                  value={localConfig.master_prompt}
                  onChange={e => update("master_prompt", e.target.value)}
                  placeholder="Ex: NUNCA ofereça desconto. Sempre pergunte o faturamento. Sempre agende ligação em até 3 mensagens..."
                  rows={4}
                  className="mt-1 text-xs resize-none"
                />
                <p className="text-[9px] text-muted-foreground mt-1">
                  Regras que a IA NUNCA pode desobedecer. Têm prioridade máxima sobre qualquer outro contexto.
                </p>
              </div>

              {/* Prompt Context */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles size={10} /> Contexto adicional
                </label>
                <Textarea
                  value={localConfig.prompt_context}
                  onChange={e => update("prompt_context", e.target.value)}
                  placeholder="Ex: Somos uma empresa de software B2B. Nosso ticket médio é R$5.000/mês..."
                  rows={3}
                  className="mt-1 text-xs resize-none"
                />
              </div>
            </div>
          )}

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="w-full px-4 py-2.5 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar Configuração
          </button>
        </div>
      )}
    </div>
  );
}
