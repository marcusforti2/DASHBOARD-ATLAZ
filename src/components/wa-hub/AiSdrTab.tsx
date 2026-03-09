import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, Sparkles, MessageSquare, Users, Tag, Clock,
  ToggleLeft, ToggleRight, Loader2, Save, Settings2,
  ArrowRight, Shield, Zap, Brain, Phone, CheckCircle2,
  AlertTriangle, TrendingUp, Send,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AiSdrConfig {
  greeting: string;
  tone: string;
  auto_tag: boolean;
  max_messages_before_handoff: number;
  business_hours_only: boolean;
  prompt_context: string;
  // Granular feature toggles
  feature_auto_reply: boolean;
  feature_auto_tag: boolean;
  feature_qualification: boolean;
  feature_handoff: boolean;
  feature_sentiment: boolean;
  feature_pipedrive_sync: boolean;
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
  feature_auto_reply: true,
  feature_auto_tag: true,
  feature_qualification: true,
  feature_handoff: true,
  feature_sentiment: false,
  feature_pipedrive_sync: false,
};

const TONES = [
  { value: "profissional", label: "Profissional", emoji: "💼", desc: "Sério e confiável" },
  { value: "casual", label: "Casual", emoji: "😊", desc: "Amigável e leve" },
  { value: "consultivo", label: "Consultivo", emoji: "🎯", desc: "Foco em solução" },
  { value: "energetico", label: "Energético", emoji: "⚡", desc: "Empolgante e ativo" },
];

const CAPABILITIES = [
  { icon: MessageSquare, title: "Resposta automática", desc: "Responde leads em tempo real 24h" },
  { icon: Tag, title: "Auto-etiquetas", desc: "Classifica leads por estágio automaticamente" },
  { icon: TrendingUp, title: "Qualificação", desc: "Identifica leads quentes com perguntas inteligentes" },
  { icon: ArrowRight, title: "Handoff inteligente", desc: "Transfere para humano no momento certo" },
  { icon: Brain, title: "Contexto da empresa", desc: "Usa sua base de conhecimento nas respostas" },
  { icon: Shield, title: "Identidade humana", desc: "Nunca revela que é IA para o lead" },
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

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) {
      setSelectedInstanceId(instances[0].id);
    }
  }, [instances]);

  useEffect(() => {
    if (selectedInstance) {
      setLocalConfig({ ...DEFAULT_CONFIG, ...(selectedInstance.ai_sdr_config || {}) });
    }
  }, [selectedInstanceId, selectedInstance?.ai_sdr_config]);

  // Load stats
  useEffect(() => {
    const loadStats = async () => {
      const today = new Date().toISOString().split("T")[0];
      const { count: msgCount } = await supabase
        .from("wa_messages")
        .select("*", { count: "exact", head: true })
        .eq("agent_name", "SDR IA 🤖");

      const { count: handoffCount } = await supabase
        .from("proactive_alerts")
        .select("*", { count: "exact", head: true })
        .eq("alert_type", "ai_handoff");

      setStats({
        totalMessages: msgCount || 0,
        handoffs: handoffCount || 0,
        activeInstances: activeAiInstances.length,
      });
    };
    loadStats();
  }, [instances]);

  const handleToggle = async () => {
    if (!selectedInstance) return;
    setToggling(true);
    const { error } = await supabase
      .from("wa_instances")
      .update({ ai_sdr_enabled: !selectedInstance.ai_sdr_enabled } as any)
      .eq("id", selectedInstance.id);
    setToggling(false);
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(selectedInstance.ai_sdr_enabled ? "SDR IA desativada" : "SDR IA ativada! 🤖");
    onRefetch();
  };

  const handleSave = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    const { error } = await supabase
      .from("wa_instances")
      .update({ ai_sdr_config: localConfig } as any)
      .eq("id", selectedInstance.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração salva! ✅");
    onRefetch();
  };

  const update = (key: keyof AiSdrConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const getCloserName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";
  const getSdrName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Hero / Overview */}
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
              Um agente autônomo que responde, qualifica e gerencia seus leads no WhatsApp — 24 horas por dia, sem pausa.
            </p>
          </div>
        </div>

        {/* Stats */}
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

      {/* What does the AI SDR do */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          O que a SDR IA faz?
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {CAPABILITIES.map((cap, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-3 hover:border-primary/30 transition-colors">
              <cap.icon className="w-4 h-4 text-primary mb-2" />
              <p className="text-xs font-bold text-foreground">{cap.title}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{cap.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Flow diagram */}
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-bold text-foreground mb-3">🔄 Fluxo do Agente</h3>
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {[
            { icon: Phone, label: "Lead envia msg", color: "text-blue-500" },
            { icon: Bot, label: "IA analisa", color: "text-primary" },
            { icon: MessageSquare, label: "Responde", color: "text-green-500" },
            { icon: Tag, label: "Atualiza etiqueta", color: "text-yellow-500" },
            { icon: CheckCircle2, label: "Qualificado?", color: "text-orange-500" },
            { icon: Users, label: "Handoff humano", color: "text-red-500" },
          ].map((step, i, arr) => (
            <div key={i} className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-center gap-1">
                <div className={`w-10 h-10 rounded-xl bg-secondary flex items-center justify-center`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <span className="text-[9px] text-muted-foreground text-center w-16">{step.label}</span>
              </div>
              {i < arr.length - 1 && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground shrink-0 mb-4" />}
            </div>
          ))}
        </div>
      </div>

      {/* Instance selector + config */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-5">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Configurar por Instância
        </h3>

        {/* Instance tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {instances.map(inst => {
            const name = inst.instance_name.replace(/^wpp_/i, "").replace(/^\w/, (c: string) => c.toUpperCase());
            const isSelected = inst.id === selectedInstanceId;
            return (
              <button
                key={inst.id}
                onClick={() => setSelectedInstanceId(inst.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all shrink-0 ${
                  isSelected
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-secondary text-muted-foreground hover:border-primary/30"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${inst.is_connected ? "bg-green-500" : "bg-red-400"}`} />
                {name}
                {inst.ai_sdr_enabled && (
                  <span className="text-[9px] px-1 py-0.5 rounded bg-primary/20 text-primary font-bold">IA</span>
                )}
              </button>
            );
          })}
        </div>

        {selectedInstance && (
          <div className="space-y-5">
            {/* Instance info + toggle */}
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
                  {toggling ? (
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  ) : selectedInstance.ai_sdr_enabled ? (
                    <ToggleRight className="w-8 h-8 text-primary" />
                  ) : (
                    <ToggleLeft className="w-8 h-8 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>

            {/* Config sections */}
            {selectedInstance.ai_sdr_enabled && (
              <div className="space-y-5 animate-in slide-in-from-top-2 duration-300">
                {/* Greeting */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Send className="w-3.5 h-3.5" /> Primeira mensagem (saudação)
                  </label>
                  <Textarea
                    value={localConfig.greeting}
                    onChange={e => update("greeting", e.target.value)}
                    placeholder="Olá! 👋 Como posso ajudar?"
                    rows={2}
                    className="text-sm resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Enviada automaticamente quando um novo lead envia a primeira mensagem.
                  </p>
                </div>

                {/* Tone */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                    Tom da conversa
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    {TONES.map(t => (
                      <button
                        key={t.value}
                        onClick={() => update("tone", t.value)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          localConfig.tone === t.value
                            ? "border-primary bg-primary/10"
                            : "border-border bg-secondary hover:border-primary/30"
                        }`}
                      >
                        <span className="text-lg">{t.emoji}</span>
                        <p className={`text-xs font-bold mt-1 ${localConfig.tone === t.value ? "text-primary" : "text-foreground"}`}>{t.label}</p>
                        <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Prompt Context */}
                <div>
                  <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5" /> Contexto e instruções para a IA
                  </label>
                  <Textarea
                    value={localConfig.prompt_context}
                    onChange={e => update("prompt_context", e.target.value)}
                    placeholder={`Escreva aqui informações da sua empresa e regras para a IA:\n\n• Qual seu produto/serviço?\n• Qual o ticket médio?\n• Como qualificar um lead? (critérios)\n• O que NÃO pode dizer?\n• Quando transferir para humano?`}
                    rows={6}
                    className="text-sm resize-none"
                  />
                  <p className="text-[10px] text-muted-foreground mt-1">
                    A IA também usa automaticamente sua <strong>Base de Conhecimento</strong> cadastrada no sistema.
                  </p>
                </div>

                {/* Handoff + toggles */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <Users className="w-3.5 h-3.5" /> Transferir após
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        type="number"
                        min={3}
                        max={50}
                        value={localConfig.max_messages_before_handoff}
                        onChange={e => update("max_messages_before_handoff", parseInt(e.target.value) || 10)}
                        className="h-9 w-20 text-sm"
                      />
                      <span className="text-xs text-muted-foreground">mensagens da IA</span>
                    </div>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => update("auto_tag", !localConfig.auto_tag)}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors p-2 rounded-lg"
                    >
                      {localConfig.auto_tag ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                      )}
                      <div className="text-left">
                        <p className="text-xs font-bold">🏷️ Auto-etiquetas</p>
                        <p className="text-[10px] text-muted-foreground">IA muda tags sozinha</p>
                      </div>
                    </button>
                  </div>

                  <div className="flex items-end">
                    <button
                      onClick={() => update("business_hours_only", !localConfig.business_hours_only)}
                      className="flex items-center gap-2 text-sm text-foreground hover:text-primary transition-colors p-2 rounded-lg"
                    >
                      {localConfig.business_hours_only ? (
                        <ToggleRight className="w-6 h-6 text-primary" />
                      ) : (
                        <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                      )}
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
