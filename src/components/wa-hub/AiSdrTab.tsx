import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, Sparkles, MessageSquare, Users, Tag, Clock,
  ToggleLeft, ToggleRight, Loader2, Save, Settings2,
  ArrowRight, Shield, Zap, Brain, Phone, CheckCircle2,
  AlertTriangle, TrendingUp, Send, Calendar, Target,
  Plus, Trash2, GripVertical,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiSdrFlowView } from "./AiSdrFlowView";
import { RoutingPanel } from "./RoutingPanel";

interface AiSdrConfig {
  greeting: string;
  tone: string;
  auto_tag: boolean;
  max_messages_before_handoff: number;
  business_hours_only: boolean;
  prompt_context: string;
  master_prompt: string;
  // Granular feature toggles
  feature_auto_reply: boolean;
  feature_auto_tag: boolean;
  feature_qualification: boolean;
  feature_handoff: boolean;
  feature_sentiment: boolean;
  feature_pipedrive_sync: boolean;
  // Qualification config
  qualification_questions: string[];
  score_thresholds: { a_min: number; b_min: number };
}

interface Instance {
  id: string;
  instance_name: string;
  is_connected: boolean;
  ai_sdr_enabled: boolean;
  ai_sdr_config: any;
  closer_id: string | null;
  sdr_id: string | null;
}

const DEFAULT_CONFIG: AiSdrConfig = {
  greeting: "Olá! 👋 Obrigado por entrar em contato. Como posso ajudar você hoje?",
  tone: "profissional",
  auto_tag: true,
  max_messages_before_handoff: 10,
  business_hours_only: false,
  prompt_context: "",
  master_prompt: "",
  feature_auto_reply: true,
  feature_auto_tag: true,
  feature_qualification: true,
  feature_handoff: true,
  feature_sentiment: false,
  feature_pipedrive_sync: false,
  qualification_questions: [
    "Como posso te chamar?",
    "Qual tipo de negócio você atua?",
    "Qual o faturamento mensal aproximado?",
    "Já tem processo comercial estruturado?",
  ],
  score_thresholds: { a_min: 80, b_min: 50 },
};

const TONES = [
  { value: "profissional", label: "Profissional", emoji: "💼", desc: "Sério e confiável" },
  { value: "casual", label: "Casual", emoji: "😊", desc: "Amigável e leve" },
  { value: "consultivo", label: "Consultivo", emoji: "🎯", desc: "Foco em solução" },
  { value: "energetico", label: "Energético", emoji: "⚡", desc: "Empolgante e ativo" },
];

const FEATURES = [
  { key: "feature_auto_reply" as const, icon: MessageSquare, title: "Resposta automática", desc: "Responde leads em tempo real 24h com IA", color: "text-blue-500" },
  { key: "feature_auto_tag" as const, icon: Tag, title: "Auto-etiquetas", desc: "Classifica leads por estágio automaticamente", color: "text-yellow-500" },
  { key: "feature_qualification" as const, icon: TrendingUp, title: "Qualificação + Score", desc: "Faz perguntas e classifica leads A/B/C com score automático", color: "text-green-500" },
  { key: "feature_handoff" as const, icon: ArrowRight, title: "Handoff inteligente", desc: "Score A → Closer | Score B → SDR humano | Score C → encerra", color: "text-orange-500" },
  { key: "feature_sentiment" as const, icon: Brain, title: "Análise de sentimento", desc: "Detecta frustração, urgência e risco de perda em tempo real", color: "text-purple-500" },
  { key: "feature_pipedrive_sync" as const, icon: Zap, title: "Sync Pipedrive", desc: "Atualiza deals, cria notas de qualificação no Pipedrive", color: "text-primary" },
];

interface Props {
  instances: Instance[];
  teamMembers: { id: string; name: string; member_role: string }[];
  onRefetch: () => void;
}

export function AiSdrTab({ instances, teamMembers, onRefetch }: Props) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [localConfig, setLocalConfig] = useState<AiSdrConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState({ totalMessages: 0, handoffs: 0, activeInstances: 0 });

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);
  const activeAiInstances = instances.filter(i => i.ai_sdr_enabled);
  const closerName = useMemo(() => {
    if (!selectedInstance?.closer_id) return "";
    return teamMembers.find(m => m.id === selectedInstance.closer_id)?.name || "";
  }, [selectedInstance?.closer_id, teamMembers]);

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) setSelectedInstanceId(instances[0].id);
  }, [instances]);

  useEffect(() => {
    if (selectedInstance) setLocalConfig({ ...DEFAULT_CONFIG, ...(selectedInstance.ai_sdr_config || {}) });
  }, [selectedInstanceId, selectedInstance?.ai_sdr_config]);

  useEffect(() => {
    const loadStats = async () => {
      const { count: msgCount } = await supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("agent_name", "SDR IA 🤖");
      const { count: handoffCount } = await supabase.from("proactive_alerts").select("*", { count: "exact", head: true }).eq("alert_type", "ai_handoff");
      setStats({ totalMessages: msgCount || 0, handoffs: handoffCount || 0, activeInstances: activeAiInstances.length });
    };
    loadStats();
  }, [instances]);

  const handleToggle = async () => {
    if (!selectedInstance) return;
    setToggling(true);
    const { error } = await supabase.from("wa_instances").update({ ai_sdr_enabled: !selectedInstance.ai_sdr_enabled } as any).eq("id", selectedInstance.id);
    setToggling(false);
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(selectedInstance.ai_sdr_enabled ? "SDR IA desativada" : "SDR IA ativada! 🤖");
    onRefetch();
  };

  const handleSave = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    const { error } = await supabase.from("wa_instances").update({ ai_sdr_config: localConfig } as any).eq("id", selectedInstance.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração salva! ✅");
    onRefetch();
  };

  const update = (key: keyof AiSdrConfig, value: any) => setLocalConfig(prev => ({ ...prev, [key]: value }));

  const addQuestion = () => {
    const questions = [...(localConfig.qualification_questions || []), ""];
    update("qualification_questions", questions);
  };

  const removeQuestion = (index: number) => {
    const questions = (localConfig.qualification_questions || []).filter((_: string, i: number) => i !== index);
    update("qualification_questions", questions);
  };

  const updateQuestion = (index: number, value: string) => {
    const questions = [...(localConfig.qualification_questions || [])];
    questions[index] = value;
    update("qualification_questions", questions);
  };

  const updateThreshold = (key: "a_min" | "b_min", value: number) => {
    update("score_thresholds", { ...localConfig.score_thresholds, [key]: value });
  };

  const getCloserName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";
  const getSdrName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              SDR de Inteligência Artificial
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                {activeAiInstances.length} ativa{activeAiInstances.length !== 1 ? "s" : ""}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Agente autônomo que qualifica, pontua e agenda reuniões — 24h por dia.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-foreground">{stats.totalMessages}</p>
            <p className="text-[10px] text-muted-foreground">Mensagens enviadas</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-foreground">{stats.handoffs}</p>
            <p className="text-[10px] text-muted-foreground">Handoffs realizados</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-primary">{stats.activeInstances}</p>
            <p className="text-[10px] text-muted-foreground">Instâncias com IA</p>
          </div>
        </div>
      </div>

      {/* Feature Toggles */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Funcionalidades do Agente
        </h3>
        <p className="text-xs text-muted-foreground mb-3">Escolha exatamente o que a SDR IA deve fazer.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {FEATURES.map((feat) => {
            const isOn = selectedInstance ? (localConfig[feat.key] ?? true) : false;
            return (
              <button
                key={feat.key}
                onClick={() => selectedInstance && update(feat.key, !isOn)}
                disabled={!selectedInstance}
                className={`relative flex items-start gap-3 p-4 rounded-xl border text-left transition-all ${
                  isOn ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-card opacity-70 hover:opacity-100"
                } ${!selectedInstance ? "cursor-not-allowed" : "cursor-pointer hover:border-primary/30"}`}
              >
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isOn ? "bg-primary/15" : "bg-muted"}`}>
                  <feat.icon className={`w-4.5 h-4.5 ${isOn ? feat.color : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`text-xs font-bold ${isOn ? "text-foreground" : "text-muted-foreground"}`}>{feat.title}</p>
                    {isOn ? <ToggleRight className="w-5 h-5 text-primary shrink-0" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{feat.desc}</p>
                </div>
              </button>
            );
          })}
        </div>
        {!selectedInstance && (
          <p className="text-[10px] text-muted-foreground mt-2 text-center">Selecione uma instância abaixo para configurar.</p>
        )}
      </div>

      {/* Interactive Flow diagram */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          🔄 Fluxo Completo do Agente
          {closerName && <Badge variant="secondary" className="text-[10px]">Responde como {closerName}</Badge>}
        </h3>
        <AiSdrFlowView config={localConfig} closerName={closerName} />
      </div>

      {/* Instance selector + config */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Configurar por Instância
        </h3>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {instances.map(inst => {
            const name = inst.instance_name.replace(/^wpp_/i, "").replace(/^\w/, (c: string) => c.toUpperCase());
            const isSelected = inst.id === selectedInstanceId;
            return (
              <button
                key={inst.id}
                onClick={() => setSelectedInstanceId(inst.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
                  isSelected ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${inst.is_connected ? "bg-green-500" : "bg-red-400"}`} />
                {name}
                {inst.ai_sdr_enabled && <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary font-bold">IA</span>}
              </button>
            );
          })}
        </div>

        {selectedInstance && (
          <div className="space-y-5">
            {/* Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/50 border border-border">
              <div>
                <p className="text-sm font-bold text-foreground flex items-center gap-2">
                  {selectedInstance.instance_name.replace(/^wpp_/i, "").replace(/^\w/, (c: string) => c.toUpperCase())}
                  {!selectedInstance.is_connected && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/10 text-destructive flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Desconectada
                    </span>
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  SDR: {getSdrName(selectedInstance.sdr_id)} · Closer: {getCloserName(selectedInstance.closer_id)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-xs font-bold ${selectedInstance.ai_sdr_enabled ? "text-primary" : "text-muted-foreground"}`}>
                  {selectedInstance.ai_sdr_enabled ? "IA Ativa" : "IA Desligada"}
                </span>
                <button onClick={handleToggle} disabled={toggling} className="transition-transform hover:scale-110">
                  {toggling ? <Loader2 className="w-6 h-6 animate-spin text-primary" /> : selectedInstance.ai_sdr_enabled ? <ToggleRight className="w-8 h-8 text-primary" /> : <ToggleLeft className="w-8 h-8 text-muted-foreground" />}
                </button>
              </div>
            </div>

            {selectedInstance.ai_sdr_enabled && (
              <div className="space-y-5 animate-in slide-in-from-top-2 duration-300">
                {/* Greeting */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Send className="w-3.5 h-3.5" /> Primeira mensagem (saudação)
                  </label>
                  <Textarea value={localConfig.greeting} onChange={e => update("greeting", e.target.value)} placeholder="Olá! 👋 Como posso ajudar?" rows={2} className="text-sm resize-none" />
                  <p className="text-[10px] text-muted-foreground mt-1">Enviada quando a IA inicia conversa proativamente (via Pipedrive) ou quando um novo lead envia a primeira mensagem.</p>
                </div>

                {/* Tone */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">Tom da conversa</label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {TONES.map(t => (
                      <button key={t.value} onClick={() => update("tone", t.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${localConfig.tone === t.value ? "border-primary bg-primary/10" : "border-border bg-secondary hover:border-primary/30"}`}>
                        <span className="text-lg">{t.emoji}</span>
                        <p className={`text-xs font-bold mt-1 ${localConfig.tone === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</p>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Master Prompt */}
                <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4">
                  <label className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Shield className="w-3.5 h-3.5" /> Prompt Master — Personalidade da SDR IA
                  </label>
                  <Textarea value={localConfig.master_prompt} onChange={e => update("master_prompt", e.target.value)}
                    placeholder={`Defina a personalidade e regras absolutas da IA:\n\nExemplo:\nVocê é a Clara, assistente do time da Atlas.\nNUNCA revele que é IA. Seu objetivo é qualificar o lead.\nSe o lead mencionar preço, responda: "Para garantir a melhor proposta, vou conectar você com nosso especialista."`}
                    rows={8} className="text-sm resize-none bg-card" />
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    <strong>Prioridade máxima.</strong> Define personalidade, regras e limites do agente.
                  </p>
                </div>

                {/* Qualification Questions */}
                {localConfig.feature_qualification && (
                  <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-4 space-y-3">
                    <label className="text-xs font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" /> Perguntas de Qualificação
                    </label>
                    <p className="text-[10px] text-muted-foreground">
                      A IA fará essas perguntas de forma natural durante a conversa (não como formulário). Arraste para reordenar.
                    </p>

                    <div className="space-y-2">
                      {(localConfig.qualification_questions || []).map((q: string, i: number) => (
                        <div key={i} className="flex items-center gap-2">
                          <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                          <span className="text-xs font-bold text-muted-foreground w-5 shrink-0">{i + 1}.</span>
                          <Input value={q} onChange={e => updateQuestion(i, e.target.value)}
                            placeholder="Ex: Qual seu faturamento mensal?"
                            className="text-sm h-9 flex-1" />
                          <button onClick={() => removeQuestion(i)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1.5 text-xs">
                      <Plus className="w-3.5 h-3.5" /> Adicionar pergunta
                    </Button>

                    {/* Score thresholds */}
                    <div className="pt-3 border-t border-green-500/10">
                      <label className="text-xs font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                        <TrendingUp className="w-3.5 h-3.5" /> Thresholds de Score
                      </label>
                      <div className="grid grid-cols-3 gap-3">
                        <div className="rounded-lg bg-card border border-border p-3 text-center">
                          <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-1">
                            <span className="text-sm font-bold text-green-600">A</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-1">Agenda com Closer</p>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-muted-foreground">≥</span>
                            <Input type="number" min={0} max={100}
                              value={localConfig.score_thresholds?.a_min || 80}
                              onChange={e => updateThreshold("a_min", parseInt(e.target.value) || 80)}
                              className="h-7 w-14 text-xs text-center" />
                          </div>
                        </div>
                        <div className="rounded-lg bg-card border border-border p-3 text-center">
                          <div className="w-8 h-8 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-1">
                            <span className="text-sm font-bold text-yellow-600">B</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-1">Passa para SDR</p>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-muted-foreground">≥</span>
                            <Input type="number" min={0} max={100}
                              value={localConfig.score_thresholds?.b_min || 50}
                              onChange={e => updateThreshold("b_min", parseInt(e.target.value) || 50)}
                              className="h-7 w-14 text-xs text-center" />
                          </div>
                        </div>
                        <div className="rounded-lg bg-card border border-border p-3 text-center">
                          <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-1">
                            <span className="text-sm font-bold text-red-600">C</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mb-1">Encerra educado</p>
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-[10px] text-muted-foreground">&lt;</span>
                            <span className="text-xs font-bold text-muted-foreground">{localConfig.score_thresholds?.b_min || 50}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Prompt Context */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5" /> Contexto do negócio (complementar)
                  </label>
                  <Textarea value={localConfig.prompt_context} onChange={e => update("prompt_context", e.target.value)}
                    placeholder={`Informações adicionais:\n\n• Qual seu produto/serviço?\n• Qual o ticket médio?\n• Como qualificar um lead? (critérios)`}
                    rows={5} className="text-sm resize-none" />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A IA também puxa automaticamente os <strong>Prompts do Negócio</strong> (aba Prompts IA) e sua <strong>Base de Conhecimento</strong>.
                  </p>
                </div>

                {/* Handoff + business hours */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {localConfig.feature_handoff && (
                    <div>
                      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                        <Users className="w-3.5 h-3.5" /> Transferir após
                      </label>
                      <div className="flex items-center gap-2">
                        <Input type="number" min={3} max={50} value={localConfig.max_messages_before_handoff}
                          onChange={e => update("max_messages_before_handoff", parseInt(e.target.value) || 10)}
                          className="h-9 w-20 text-sm" />
                        <span className="text-xs text-muted-foreground">mensagens da IA</span>
                      </div>
                    </div>
                  )}
                  <div className="flex items-end">
                    <button onClick={() => update("business_hours_only", !localConfig.business_hours_only)}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors p-2 rounded-lg">
                      {localConfig.business_hours_only ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                      <div className="text-left">
                        <p className="text-xs font-bold">🕐 Só horário comercial</p>
                        <p className="text-[10px] text-muted-foreground">8h às 18h, Seg-Sex</p>
                      </div>
                    </button>
                  </div>
                </div>

                {/* Save */}
                <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configuração da IA
                </Button>
              </div>
            )}
          </div>
        )}

        {instances.length === 0 && (
          <div className="text-center py-8">
            <Bot className="w-10 h-10 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Crie uma instância de WhatsApp primeiro</p>
            <p className="text-[10px] text-muted-foreground">Vá na aba Instâncias para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
