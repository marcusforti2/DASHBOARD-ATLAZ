import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, Settings2, MessageSquare, Users, Tag, Clock,
  ToggleLeft, ToggleRight, Loader2, Save, Shield, Zap, Brain,
  Phone, CheckCircle2, AlertTriangle, TrendingUp, Send, Calendar,
  Target, Plus, Trash2, GripVertical, Sparkles, ArrowRight,
  BarChart3, User, BookOpen, GitBranch, MessageCircle, CalendarClock,
} from "lucide-react";
import { AutomationCard, type AutomationDef } from "@/components/ai-sdr/AutomationCard";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiSdrFlowView } from "@/components/wa-hub/AiSdrFlowView";
import { AiPromptsTab } from "@/components/wa-hub/AiPromptsTab";

interface AiSdrConfig {
  greeting: string;
  tone: string;
  auto_tag: boolean;
  max_messages_before_handoff: number;
  business_hours_only: boolean;
  prompt_context: string;
  master_prompt: string;
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
  feature_rate_limit: boolean;
  feature_reengagement: boolean;
  feature_blacklist: boolean;
  feature_daily_summary: boolean;
  feature_language_detection: boolean;
  feature_linkedin_lookup: boolean;
  feature_time_escalation: boolean;
  reengagement_days: number;
  escalation_hours: number;
  rate_limit_per_hour: number;
  blacklist_numbers: string[];
  target_audience: string;
  pain_points: string;
  desires: string;
  qualification_questions: string[];
  daily_summary_admin_ids: string[];
  lead_sources: LeadSource[];
  score_thresholds: { a_min: number; b_min: number };
}

interface LeadSource {
  id: string;
  name: string;
  active: boolean;
  context: string;
  color: string;
  pipedrive_label_id?: number | null;
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
  feature_rate_limit: true,
  feature_reengagement: false,
  feature_blacklist: false,
  feature_daily_summary: false,
  feature_language_detection: false,
  feature_linkedin_lookup: false,
  feature_time_escalation: false,
  reengagement_days: 7,
  escalation_hours: 48,
  rate_limit_per_hour: 5,
  blacklist_numbers: [],
  daily_summary_admin_ids: [],
  lead_sources: [
    { id: "linkedin", name: "PROSPECÇÃO/LINKEDIN", active: true, context: "Lead veio de prospecção ativa no LinkedIn. Você já se conectou com ele e agora está dando continuidade à conversa. Seja pessoal, mencione algo do perfil dele. NÃO diga o nome da empresa logo de cara.", color: "#4DA6FF", pipedrive_label_id: 43 },
    { id: "dripify", name: "DRIPIFY/AUTOMAÇÃO", active: false, context: "Lead recebeu uma sequência automatizada (Dripify ou similar) e respondeu. O contexto é diferente da prospecção manual — ele pode não lembrar quem você é. Apresente-se brevemente e retome o interesse.", color: "#E8A441", pipedrive_label_id: null },
    { id: "indicacao", name: "INDICAÇÃO", active: false, context: "Lead veio por indicação de alguém. Mencione quem indicou (se disponível) e use isso como ponte de confiança. Tom mais próximo e caloroso.", color: "#E8A441", pipedrive_label_id: null },
  ],
  target_audience: "",
  pain_points: "",
  desires: "",
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

type Section = "identidade" | "conhecimento" | "automacoes" | "qualificacao" | "fluxo" | "analytics";

const SECTIONS: { id: Section; label: string; icon: React.ElementType; desc: string }[] = [
  { id: "identidade", label: "Identidade", icon: User, desc: "Persona, tom e saudação" },
  { id: "conhecimento", label: "Conhecimento", icon: BookOpen, desc: "Prompts e contexto" },
  { id: "automacoes", label: "Automações", icon: Zap, desc: "Funcionalidades do agente" },
  { id: "qualificacao", label: "Qualificação", icon: Target, desc: "Perguntas e scoring" },
  { id: "fluxo", label: "Fluxo", icon: GitBranch, desc: "Visualização do agente" },
  { id: "analytics", label: "Analytics", icon: BarChart3, desc: "Métricas e performance" },
];

const AUTOMATIONS: AutomationDef[] = [
  {
    key: "feature_auto_reply", icon: Send, title: "Resposta automática", desc: "Responde leads em tempo real",
    color: "text-blue-500",
    explanation: "A IA responde automaticamente toda mensagem recebida de leads. Se 'Só Horário Comercial' estiver ativo, responde apenas de 8h às 18h. Caso contrário, responde 24 horas por dia, incluindo finais de semana.",
    warnings: ["Se 'Só Horário Comercial' estiver ativo, a IA NÃO responderá fora do horário."],
  },
  {
    key: "call_focus_mode", icon: Phone, title: "Foco em Ligação", desc: "Prioriza agendar call em 3-4 trocas",
    color: "text-emerald-500",
    explanation: "A IA direciona a conversa para agendar uma ligação/reunião o mais rápido possível (idealmente em 3-4 mensagens). Usa o Google Calendar do closer vinculado para sugerir horários disponíveis. Leads classificados como Score A recebem horários; Score B são transferidos para SDR humano.",
  },
  {
    key: "split_messages", icon: MessageCircle, title: "Mensagens Quebradas", desc: "Divide em várias msgs curtas (mais humano)",
    color: "text-sky-500",
    explanation: "Em vez de enviar uma mensagem longa, a IA quebra a resposta em 2-4 mensagens curtas com pausas de 1-5 segundos entre elas, simulando digitação humana. Usa o separador ||| internamente.",
    warnings: ["Cada mensagem quebrada conta individualmente no Rate Limit. Uma resposta dividida em 4 partes consome 4 do limite por hora."],
  },
  {
    key: "follow_up_enabled", icon: CalendarClock, title: "Follow-up Automático", desc: "Reenvia se lead não responder",
    color: "text-amber-500",
    explanation: "Se o lead não responder após o tempo configurado, a IA envia uma mensagem de follow-up contextualizada automaticamente. A mensagem NÃO é genérica — a IA analisa o histórico da conversa para criar um follow-up relevante.",
    warnings: ["Se 'Alerta Urgente' tiver sido acionado (lead pediu pra ligar), o follow-up é suspenso para evitar conflito com atendimento humano."],
    fields: [
      { key: "follow_up_hours", label: "Tempo antes do follow-up", type: "number" as const, suffix: "horas", min: 1, max: 168 },
    ],
  },
  {
    key: "urgent_call_alert", icon: AlertTriangle, title: "Alerta Urgente", desc: "Se lead pedir pra ligar na hora, alerta closer",
    color: "text-red-500",
    explanation: "Quando o lead diz algo como 'pode ligar agora?', 'estou disponível', a IA detecta a urgência, envia um alerta ao closer via WhatsApp e SUSPENDE as respostas automáticas para permitir intervenção humana imediata. O closer recebe o nome, telefone e contexto da conversa.",
  },
  {
    key: "meeting_followups", icon: Calendar, title: "Follow-up Pré-Reunião", desc: "Lembrete 6h e 1h antes da ligação",
    color: "text-violet-500",
    explanation: "Após agendar uma reunião/ligação, a IA envia automaticamente 2 lembretes ao lead: um 6 horas antes e outro 1 hora antes do compromisso. Isso reduz a taxa de no-show significativamente. Os lembretes são personalizados com o nome do closer e o assunto da conversa.",
  },
  {
    key: "feature_auto_tag", icon: Tag, title: "Auto-etiquetas", desc: "Classifica leads por estágio",
    color: "text-yellow-500",
    explanation: "A IA classifica automaticamente cada lead com etiquetas de estágio no WhatsApp Hub: 'Novo Lead', 'Em Qualificação', 'Reunião Agendada', 'Follow-up', etc. Isso mantém o funil organizado sem intervenção manual. As etiquetas são atualizadas em tempo real conforme a conversa evolui.",
  },
  {
    key: "feature_qualification", icon: TrendingUp, title: "Qualificação + Score", desc: "Classifica leads A/B/C",
    color: "text-green-500",
    explanation: "A IA faz as perguntas de qualificação (configuradas na aba 'Qualificação') de forma natural durante a conversa e atribui um score de 0-100. Score A (≥80): lead quente, pronto para closer. Score B (≥50): potencial, precisa de nurturing. Score C (<50): baixa prioridade ou desqualificado.",
  },
  {
    key: "feature_handoff", icon: ArrowRight, title: "Handoff inteligente", desc: "Score A→Closer, B→SDR, C→encerra",
    color: "text-orange-500",
    explanation: "Com base no score de qualificação, a IA transfere automaticamente: Score A → Closer (agenda ligação direto). Score B → SDR humano (precisa de mais trabalho). Score C → encerra educadamente. O handoff inclui um resumo da conversa para que o humano tenha contexto completo.",
    fields: [
      { key: "max_messages_before_handoff", label: "Máximo de mensagens antes de forçar handoff", type: "number" as const, suffix: "mensagens", min: 3, max: 50 },
    ],
  },
  {
    key: "feature_sentiment", icon: Brain, title: "Análise de sentimento", desc: "Detecta frustração e risco",
    color: "text-purple-500",
    explanation: "A IA analisa o tom emocional de cada mensagem do lead (positivo, neutro, frustrado, irritado). Se detectar frustração ou risco de perda, ajusta o tom da resposta para ser mais empático e pode acionar um alerta ao gestor. Útil para identificar leads que estão prestes a desistir.",
  },
  {
    key: "feature_pipedrive_sync", icon: Zap, title: "Sync Pipedrive", desc: "Atualiza deals e notas no CRM",
    color: "text-primary",
    explanation: "Sincroniza automaticamente as informações da conversa com o Pipedrive: cria/atualiza deals, adiciona notas com resumo da conversa, e move o deal entre estágios conforme a qualificação avança. Requer integração Pipedrive configurada no WhatsApp Hub.",
  },
  {
    key: "business_hours_only", icon: Clock, title: "Só Horário Comercial", desc: "IA só responde 8h-18h Seg-Sex",
    color: "text-slate-500",
    explanation: "Restringe as respostas automáticas da IA para o horário comercial: segunda a sexta, das 8h às 18h (horário de Brasília). Mensagens recebidas fora deste horário ficam pendentes e são respondidas no próximo dia útil. Ideal para manter uma imagem profissional.",
    warnings: ["Conflita com 'Resposta automática' se você espera respostas 24h. Ative apenas um dos dois cenários."],
  },
  {
    key: "feature_rate_limit", icon: Shield, title: "Anti-Spam / Rate Limit", desc: "Limita msgs por contato/hora",
    color: "text-rose-500",
    explanation: "Impede que a IA envie mensagens excessivas para um mesmo contato. Limita o número de mensagens enviadas por contato por hora. Se o limite for atingido, a IA para de responder até a próxima hora. Protege contra loops e spam acidental.",
    warnings: ["'Mensagens Quebradas' conta cada parte como uma mensagem separada. Uma resposta dividida em 4 partes consome 4 do limite."],
    fields: [
      { key: "rate_limit_per_hour", label: "Limite de mensagens por contato/hora", type: "number" as const, suffix: "msgs/hora", min: 1, max: 30 },
    ],
  },
  {
    key: "feature_reengagement", icon: MessageSquare, title: "Reengajamento automático", desc: "Reativa leads inativos há X dias",
    color: "text-teal-500",
    explanation: "Envia uma mensagem de reengajamento para leads que não interagiram nos últimos X dias. A mensagem é contextualizada com base na última conversa. Diferente do follow-up (que age em horas), o reengajamento age em dias para leads 'frios' que já não respondem há muito tempo.",
    warnings: ["Se 'Follow-up Automático' também estiver ativo, o lead receberá: follow-up em horas → reengajamento em dias. Certifique-se de que os tempos não se sobrepõem."],
    fields: [
      { key: "reengagement_days", label: "Reengajar após inatividade de", type: "number" as const, suffix: "dias", min: 1, max: 90 },
    ],
  },
  {
    key: "feature_blacklist", icon: Users, title: "Blacklist / DNC", desc: "Números que a IA nunca contata",
    color: "text-red-600",
    explanation: "Lista de números que a IA NUNCA deve contatar. Qualquer mensagem recebida desses números é completamente ignorada pela IA (nenhuma resposta automática, follow-up ou reengajamento). Útil para excluir fornecedores, parceiros ou leads que pediram para não serem contatados.",
    fields: [
      { key: "blacklist_numbers", label: "Números bloqueados (um por linha)", type: "textarea" as const, placeholder: "5511999999999\n5521888888888" },
    ],
  },
  {
    key: "feature_daily_summary", icon: BarChart3, title: "Resumo diário WhatsApp", desc: "Envia resumo de leads quentes aos gestores",
    color: "text-indigo-500",
    explanation: "Todo dia útil às 8h, a IA envia um resumo via WhatsApp para os administradores selecionados contendo: quantidade de novos leads, leads quentes (Score A), reuniões agendadas para o dia e leads que precisam de atenção. Selecione abaixo quais gestores devem receber o resumo.",
    fields: [
      { key: "daily_summary_admin_ids", label: "Administradores que receberão o resumo", type: "multi-select" as const, options: [] },
    ],
  },
  {
    key: "feature_language_detection", icon: Sparkles, title: "Detecção de idioma", desc: "Adapta idioma automaticamente (PT/EN/ES)",
    color: "text-cyan-500",
    explanation: "A IA detecta automaticamente o idioma da primeira mensagem do lead (Português, Inglês ou Espanhol) e continua toda a conversa nesse idioma. Ideal para empresas que recebem leads internacionais. A detecção é feita na primeira mensagem e mantida ao longo de toda a conversa.",
  },
  {
    key: "feature_linkedin_lookup", icon: TrendingUp, title: "Auto-pesquisa LinkedIn", desc: "Enriquece lead com dados do LinkedIn",
    color: "text-blue-600",
    explanation: "Quando o lead menciona sua empresa, cargo ou setor, a IA ativa um gatilho de enriquecimento para buscar informações complementares no LinkedIn. Os dados são adicionados ao perfil do lead no WhatsApp Hub para que o closer tenha contexto antes da ligação.",
  },
  {
    key: "feature_time_escalation", icon: AlertTriangle, title: "Escalonamento por tempo", desc: "Escala ao gestor se sem resposta em X horas",
    color: "text-orange-600",
    explanation: "Se um lead qualificado (Score A ou B) não responder após X horas, a IA cria um alerta de alta prioridade para o gestor. Diferente do follow-up (que tenta recontactar o lead), o escalonamento notifica o HUMANO para intervir manualmente. Deve ser configurado com tempo MAIOR que o follow-up.",
    warnings: ["O tempo de escalonamento deve ser MAIOR que o tempo de follow-up. Caso contrário, o lead será escalado antes de receber follow-up."],
    fields: [
      { key: "escalation_hours", label: "Escalar se sem resposta após", type: "number" as const, suffix: "horas", min: 1, max: 168 },
    ],
  },
];

export default function AiSdrPage() {
  const [instances, setInstances] = useState<Instance[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; member_role: string }[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("identidade");
  const [localConfig, setLocalConfig] = useState<AiSdrConfig>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [stats, setStats] = useState({ totalMessages: 0, handoffs: 0, activeInstances: 0, avgResponseTime: 0 });

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);
  const closerName = useMemo(() => {
    if (!selectedInstance?.closer_id) return "";
    return teamMembers.find(m => m.id === selectedInstance.closer_id)?.name || "";
  }, [selectedInstance?.closer_id, teamMembers]);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedInstance) {
      setLocalConfig({ ...DEFAULT_CONFIG, ...(selectedInstance.ai_sdr_config || {}) });
    }
  }, [selectedInstanceId, selectedInstance?.ai_sdr_config]);

  const loadData = async () => {
    setLoadingData(true);
    const [instRes, membRes] = await Promise.all([
      supabase.from("wa_instances").select("id, instance_name, is_connected, ai_sdr_enabled, ai_sdr_config, closer_id, sdr_id"),
      supabase.from("team_members").select("id, name, member_role").eq("active", true),
    ]);
    const insts = (instRes.data || []) as Instance[];
    setInstances(insts);
    setTeamMembers(membRes.data || []);
    if (insts.length > 0 && !selectedInstanceId) setSelectedInstanceId(insts[0].id);

    // Stats
    const activeCount = insts.filter(i => i.ai_sdr_enabled).length;
    const { count: msgCount } = await supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("agent_name", "SDR IA 🤖");
    const { count: handoffCount } = await supabase.from("proactive_alerts").select("*", { count: "exact", head: true }).eq("alert_type", "ai_handoff");
    setStats({ totalMessages: msgCount || 0, handoffs: handoffCount || 0, activeInstances: activeCount, avgResponseTime: 0 });
    setLoadingData(false);
  };

  const handleToggle = async () => {
    if (!selectedInstance) return;
    setToggling(true);
    const { error } = await supabase.from("wa_instances").update({ ai_sdr_enabled: !selectedInstance.ai_sdr_enabled } as any).eq("id", selectedInstance.id);
    setToggling(false);
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(selectedInstance.ai_sdr_enabled ? "SDR IA desativada" : "SDR IA ativada! 🤖");
    loadData();
  };

  const handleSave = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    const { error } = await supabase.from("wa_instances").update({ ai_sdr_config: localConfig } as any).eq("id", selectedInstance.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração salva! ✅");
    loadData();
  };

  const update = (key: keyof AiSdrConfig, value: any) => setLocalConfig(prev => ({ ...prev, [key]: value }));

  const addQuestion = () => update("qualification_questions", [...(localConfig.qualification_questions || []), ""]);
  const removeQuestion = (i: number) => update("qualification_questions", (localConfig.qualification_questions || []).filter((_: string, idx: number) => idx !== i));
  const updateQuestion = (i: number, v: string) => {
    const q = [...(localConfig.qualification_questions || [])];
    q[i] = v;
    update("qualification_questions", q);
  };
  const updateThreshold = (key: "a_min" | "b_min", value: number) => update("score_thresholds", { ...localConfig.score_thresholds, [key]: value });

  const getCloserName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";
  const getSdrName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";

  const automationCount = AUTOMATIONS.filter(f => localConfig[f.key as keyof AiSdrConfig]).length;

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Bot className="w-16 h-16 text-muted-foreground/30" />
        <h2 className="text-lg font-bold text-foreground">Nenhuma instância de WhatsApp</h2>
        <p className="text-sm text-muted-foreground">Crie uma instância no WhatsApp Hub para configurar a SDR IA.</p>
      </div>
    );
  }

  const renderSection = () => {
    if (!selectedInstance) return null;

    switch (activeSection) {
      case "identidade":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Identidade do Agente</h3>
              <p className="text-sm text-muted-foreground">Defina quem a IA vai fingir ser nas conversas com leads.</p>
            </div>

            {/* Closer identity */}
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                  <User className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold text-foreground">
                    {closerName ? `Responde como ${closerName}` : "Nenhum closer vinculado"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    A IA assume a identidade do closer vinculado à instância.
                  </p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground bg-card rounded-lg p-3 border border-border">
                💡 Para trocar o closer, vá em <strong>WhatsApp Hub → Instâncias</strong> e altere o closer vinculado.
              </p>
            </div>

            {/* Tone */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 block">
                Tom da conversa
              </label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {TONES.map(t => (
                  <button key={t.value} onClick={() => update("tone", t.value)}
                    className={`p-4 rounded-xl border text-left transition-all ${
                      localConfig.tone === t.value
                        ? "border-primary bg-primary/10 shadow-sm"
                        : "border-border bg-card hover:border-primary/30"
                    }`}>
                    <span className="text-2xl">{t.emoji}</span>
                    <p className={`text-sm font-bold mt-2 ${localConfig.tone === t.value ? "text-primary" : "text-foreground"}`}>
                      {t.label}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Lead Sources */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Tag className="w-3.5 h-3.5" /> Origens de Lead — Contexto por Canal
              </label>
              <p className="text-xs text-muted-foreground mb-3">
                Cada origem tem um contexto diferente. A IA adapta a abordagem inicial com base em como o lead chegou.
              </p>
              <div className="space-y-3">
                {(localConfig.lead_sources || []).map((src, idx) => (
                  <div key={src.id} className={`rounded-xl border transition-all ${src.active ? "border-primary/30 bg-primary/5" : "border-border bg-card opacity-70"}`}>
                    <div className="flex items-center gap-3 p-4">
                      <div className="w-3 h-8 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                      <div className="flex-1 min-w-0">
                        {src.id.startsWith("custom_") ? (
                          <Input
                            value={src.name}
                            onChange={e => {
                              const sources = [...(localConfig.lead_sources || [])];
                              sources[idx] = { ...sources[idx], name: e.target.value };
                              update("lead_sources", sources);
                            }}
                            className="h-7 text-xs font-bold border-none bg-transparent p-0 focus-visible:ring-0"
                          />
                        ) : (
                          <p className={`text-xs font-bold ${src.active ? "text-foreground" : "text-muted-foreground"}`}>{src.name}</p>
                        )}
                      </div>
                      {src.id.startsWith("custom_") && (
                        <button
                          onClick={() => {
                            const sources = (localConfig.lead_sources || []).filter((_, i) => i !== idx);
                            update("lead_sources", sources);
                          }}
                          className="p-1 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          const sources = [...(localConfig.lead_sources || [])];
                          sources[idx] = { ...sources[idx], active: !sources[idx].active };
                          update("lead_sources", sources);
                        }}
                        className="p-1 rounded-md hover:bg-accent/50 transition-colors"
                      >
                        {src.active
                          ? <ToggleRight className="w-6 h-6 text-primary" />
                          : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
                      </button>
                    </div>
                    {src.active && (
                      <div className="px-4 pb-4 pt-0 space-y-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                              Pipedrive Label ID
                            </label>
                            <Input
                              type="number"
                              value={src.pipedrive_label_id ?? ""}
                              onChange={e => {
                                const sources = [...(localConfig.lead_sources || [])];
                                const val = e.target.value ? parseInt(e.target.value) : null;
                                sources[idx] = { ...sources[idx], pipedrive_label_id: val };
                                update("lead_sources", sources);
                              }}
                              placeholder="Ex: 43"
                              className="h-8 w-28 text-xs font-mono"
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground flex-1">
                            ID da etiqueta no Pipedrive. A IA só dispara proativamente para deals com essa etiqueta.
                          </p>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 block">
                            Contexto / Instruções para a IA
                          </label>
                          <Textarea
                            value={src.context}
                            onChange={e => {
                              const sources = [...(localConfig.lead_sources || [])];
                              sources[idx] = { ...sources[idx], context: e.target.value };
                              update("lead_sources", sources);
                            }}
                            placeholder="Descreva o contexto e como a IA deve abordar leads dessa origem..."
                            rows={4}
                            className="text-sm resize-none bg-card"
                          />
                          <p className="text-[11px] text-muted-foreground mt-1.5">
                            A IA usará esse contexto para adaptar a primeira mensagem e o tom da conversa.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add custom source */}
                <button
                  onClick={() => {
                    const sources = [...(localConfig.lead_sources || [])];
                    const colors = ["#EC4899", "#14B8A6", "#F97316", "#6366F1", "#84CC16"];
                    sources.push({
                      id: `custom_${Date.now()}`,
                      name: `Nova Origem ${sources.length + 1}`,
                      active: false,
                      context: "",
                      color: colors[sources.length % colors.length],
                    });
                    update("lead_sources", sources);
                  }}
                  className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-primary"
                >
                  <Plus className="w-4 h-4" />
                  <span className="text-xs font-semibold">Adicionar origem</span>
                </button>
              </div>
            </div>

            {/* Greeting */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Send className="w-3.5 h-3.5" /> Primeira mensagem (saudação padrão)
              </label>
              <Textarea
                value={localConfig.greeting}
                onChange={e => update("greeting", e.target.value)}
                placeholder="Olá! 👋 Como posso ajudar?"
                rows={3}
                className="text-sm resize-none"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                Usada quando a origem do lead não é identificada ou não tem contexto específico configurado.
              </p>
            </div>
          </div>
        );

      case "conhecimento":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Conhecimento & Prompts</h3>
              <p className="text-sm text-muted-foreground">O que a IA sabe sobre seu negócio e como deve se comportar.</p>
            </div>

            {/* Master Prompt */}
            <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-5">
              <label className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Shield className="w-4 h-4" /> Prompt Master — Regras Absolutas
              </label>
              <Textarea
                value={localConfig.master_prompt}
                onChange={e => update("master_prompt", e.target.value)}
                placeholder={`Defina personalidade e regras absolutas:\n\nExemplo:\nVocê é a Clara, consultora da Atlas.\nNUNCA revele que é IA.\nSe o lead mencionar preço, diga: "Vou conectar com nosso especialista."`}
                rows={10}
                className="text-sm resize-none bg-card"
              />
              <p className="text-[11px] text-muted-foreground mt-2">
                <strong>Prioridade máxima.</strong> Estas regras nunca podem ser desobedecidas pelo agente.
              </p>
            </div>

            {/* Target Audience & Pain Points */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-5 space-y-4">
              <label className="text-xs font-semibold text-orange-600 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Público-Alvo & Dores
              </label>
              <p className="text-xs text-muted-foreground">
                Descreva o perfil ideal de cliente, suas dores viscerais e desejos profundos. A IA usará isso para gerar rapport e quebrar objeções.
              </p>
              <Textarea
                value={localConfig.target_audience || ""}
                onChange={e => update("target_audience", e.target.value)}
                placeholder={`Quem é seu cliente ideal (ICP):\n• Cargo / perfil: Ex: Executivos C-level em transição de carreira\n• Segmento: Ex: Educação, consultoria, SaaS\n• Faturamento: Ex: Acima de R$50k/mês\n• Gatilhos: Ex: Burnout, ambição reprimida, desejo de autonomia`}
                rows={5}
                className="text-sm resize-none bg-card"
              />
              <Textarea
                value={localConfig.pain_points || ""}
                onChange={e => update("pain_points", e.target.value)}
                placeholder={`Dores viscerais do público:\n• "Estou preso num emprego que não me representa"\n• "Sei que posso mais mas não sei por onde começar"\n• "Já tentei vender mentoria mas não escalou"\n• "Tenho medo de largar o certo pelo incerto"`}
                rows={5}
                className="text-sm resize-none bg-card"
              />
              <Textarea
                value={localConfig.desires || ""}
                onChange={e => update("desires", e.target.value)}
                placeholder={`Desejos profundos:\n• Liberdade financeira e de tempo\n• Ser reconhecido como autoridade\n• Faturar 1M/ano com mentoria\n• Impactar vidas e deixar um legado\n• Sair do operacional e viver de intelectual`}
                rows={5}
                className="text-sm resize-none bg-card"
              />
            </div>

            {/* Prompt Context */}
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Brain className="w-3.5 h-3.5" /> Contexto do negócio (complementar)
              </label>
              <Textarea
                value={localConfig.prompt_context}
                onChange={e => update("prompt_context", e.target.value)}
                placeholder={`Informações adicionais:\n• Qual seu produto/serviço?\n• Qual o ticket médio?\n• Critérios de qualificação`}
                rows={6}
                className="text-sm resize-none"
              />
            </div>

            {/* Embedded Business Prompts */}
            <div className="rounded-xl border border-border bg-card/50 p-1">
              <AiPromptsTab />
            </div>
          </div>
        );

      case "automacoes":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Automações do Agente</h3>
              <p className="text-sm text-muted-foreground">
                Clique em cada automação para expandir, ver explicações e configurar parâmetros.
                <Badge variant="secondary" className="ml-2 text-[10px]">{automationCount} ativas</Badge>
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {AUTOMATIONS.map(def => {
                // Inject dynamic options for multi-select fields
                const enrichedDef = { ...def };
                if (enrichedDef.fields) {
                  enrichedDef.fields = enrichedDef.fields.map(f => {
                    if (f.key === "daily_summary_admin_ids" && f.type === "multi-select") {
                      return { ...f, options: teamMembers.filter(m => m.member_role.includes("admin")).map(m => ({ value: m.id, label: `${m.name} (${m.member_role})` })) };
                    }
                    return f;
                  });
                }
                const isOn = localConfig[enrichedDef.key as keyof AiSdrConfig] as boolean;
                return (
                  <AutomationCard
                    key={enrichedDef.key}
                    def={enrichedDef}
                    isOn={isOn}
                    config={{
                      ...localConfig,
                      blacklist_numbers: (localConfig.blacklist_numbers || []).join("\n"),
                    }}
                    onToggle={() => update(def.key as keyof AiSdrConfig, !isOn)}
                    onFieldChange={(key, value) => {
                      if (key === "blacklist_numbers") {
                        update("blacklist_numbers", String(value).split("\n").map((n: string) => n.trim()).filter(Boolean));
                      } else {
                        update(key as keyof AiSdrConfig, value);
                      }
                    }}
                  />
                );
              })}
            </div>
          </div>
        );

      case "qualificacao":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Qualificação & Scoring</h3>
              <p className="text-sm text-muted-foreground">Perguntas que a IA faz de forma natural e critérios de pontuação A/B/C.</p>
            </div>

            {/* Questions */}
            <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-5 space-y-4">
              <label className="text-xs font-semibold text-green-600 uppercase tracking-wider flex items-center gap-1.5">
                <Target className="w-4 h-4" /> Perguntas de Qualificação
              </label>
              <p className="text-xs text-muted-foreground">
                A IA fará essas perguntas de forma natural durante a conversa (não como formulário).
              </p>

              <div className="space-y-2">
                {(localConfig.qualification_questions || []).map((q: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical className="w-4 h-4 text-muted-foreground/50 shrink-0" />
                    <span className="text-sm font-bold text-muted-foreground w-6 shrink-0">{i + 1}.</span>
                    <Input value={q} onChange={e => updateQuestion(i, e.target.value)}
                      placeholder="Ex: Qual seu faturamento mensal?" className="text-sm h-10 flex-1" />
                    <button onClick={() => removeQuestion(i)}
                      className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1.5">
                <Plus className="w-4 h-4" /> Adicionar pergunta
              </Button>
            </div>

            {/* Score thresholds */}
            <div className="rounded-xl border border-border bg-card p-5">
              <label className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-1.5 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" /> Thresholds de Score
              </label>
              <div className="grid grid-cols-3 gap-4">
                <div className="rounded-xl bg-green-500/5 border border-green-500/20 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-green-500/15 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-green-600">A</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">Agenda Closer</p>
                  <p className="text-xs text-muted-foreground mb-2">Lead quente — agenda reunião direto</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs text-muted-foreground">≥</span>
                    <Input type="number" min={0} max={100}
                      value={localConfig.score_thresholds?.a_min || 80}
                      onChange={e => updateThreshold("a_min", parseInt(e.target.value) || 80)}
                      className="h-8 w-16 text-sm text-center" />
                  </div>
                </div>
                <div className="rounded-xl bg-yellow-500/5 border border-yellow-500/20 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-yellow-500/15 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-yellow-600">B</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">Passa para SDR</p>
                  <p className="text-xs text-muted-foreground mb-2">Tem interesse, precisa nutrir</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs text-muted-foreground">≥</span>
                    <Input type="number" min={0} max={100}
                      value={localConfig.score_thresholds?.b_min || 50}
                      onChange={e => updateThreshold("b_min", parseInt(e.target.value) || 50)}
                      className="h-8 w-16 text-sm text-center" />
                  </div>
                </div>
                <div className="rounded-xl bg-red-500/5 border border-red-500/20 p-4 text-center">
                  <div className="w-12 h-12 rounded-full bg-red-500/15 flex items-center justify-center mx-auto mb-2">
                    <span className="text-lg font-bold text-red-600">C</span>
                  </div>
                  <p className="text-sm font-bold text-foreground">Encerra</p>
                  <p className="text-xs text-muted-foreground mb-2">Não qualificado</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs text-muted-foreground">&lt;</span>
                    <span className="text-sm font-bold text-muted-foreground">{localConfig.score_thresholds?.b_min || 50}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );

      case "fluxo":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Fluxo do Agente</h3>
              <p className="text-sm text-muted-foreground">
                Visualização em tempo real da árvore de decisão baseada nas suas configurações.
                {closerName && <Badge variant="secondary" className="ml-2 text-[10px]">Responde como {closerName}</Badge>}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 min-h-[500px]">
              <AiSdrFlowView config={localConfig} closerName={closerName} />
            </div>
          </div>
        );

      case "analytics":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-base font-bold text-foreground mb-1">Analytics & Performance</h3>
              <p className="text-sm text-muted-foreground">Métricas do agente SDR IA.</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <MessageSquare className="w-6 h-6 text-primary mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.totalMessages}</p>
                <p className="text-xs text-muted-foreground">Mensagens enviadas</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <ArrowRight className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{stats.handoffs}</p>
                <p className="text-xs text-muted-foreground">Handoffs realizados</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <Bot className="w-6 h-6 text-green-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-primary">{stats.activeInstances}</p>
                <p className="text-xs text-muted-foreground">Instâncias com IA</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-5 text-center">
                <Zap className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-2xl font-bold text-foreground">{automationCount}</p>
                <p className="text-xs text-muted-foreground">Automações ativas</p>
              </div>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground text-center py-8">
                📊 Analytics detalhados (taxa de conversão, tempo médio de resposta, score médio) em breve.
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6 min-h-[calc(100vh-8rem)]">
      {/* Left sidebar */}
      <div className="w-64 shrink-0 space-y-4">
        {/* Instance selector */}
        <div className="rounded-xl border border-border bg-card p-3 space-y-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1">Instância</p>
          {instances.map(inst => {
            const name = inst.instance_name.replace(/^wpp_/i, "").replace(/^\w/, (c: string) => c.toUpperCase());
            const isSelected = inst.id === selectedInstanceId;
            return (
              <button key={inst.id} onClick={() => setSelectedInstanceId(inst.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-all text-left ${
                  isSelected
                    ? "bg-primary/10 text-primary border border-primary/30"
                    : "text-muted-foreground hover:bg-secondary border border-transparent"
                }`}>
                <span className={`w-2 h-2 rounded-full shrink-0 ${inst.is_connected ? "bg-green-500" : "bg-red-400"}`} />
                <span className="truncate flex-1">{name}</span>
                {inst.ai_sdr_enabled && <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-bold shrink-0">IA</span>}
              </button>
            );
          })}
        </div>

        {/* Toggle AI */}
        {selectedInstance && (
          <div className={`rounded-xl border p-3 ${selectedInstance.ai_sdr_enabled ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot className={`w-4 h-4 ${selectedInstance.ai_sdr_enabled ? "text-primary" : "text-muted-foreground"}`} />
                <span className={`text-xs font-bold ${selectedInstance.ai_sdr_enabled ? "text-primary" : "text-muted-foreground"}`}>
                  {selectedInstance.ai_sdr_enabled ? "IA Ativa" : "IA Off"}
                </span>
              </div>
              <button onClick={handleToggle} disabled={toggling} className="transition-transform hover:scale-110">
                {toggling ? <Loader2 className="w-5 h-5 animate-spin text-primary" /> :
                  selectedInstance.ai_sdr_enabled ? <ToggleRight className="w-6 h-6 text-primary" /> : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
              </button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              SDR: {getSdrName(selectedInstance.sdr_id)} · Closer: {getCloserName(selectedInstance.closer_id)}
            </p>
          </div>
        )}

        {/* Section navigation */}
        <nav className="rounded-xl border border-border bg-card p-2 space-y-0.5">
          {SECTIONS.map(s => {
            const isActive = activeSection === s.id;
            return (
              <button key={s.id} onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all ${
                  isActive
                    ? "bg-primary/10 text-primary font-semibold"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}>
                <s.icon className={`w-4 h-4 shrink-0 ${isActive ? "text-primary" : ""}`} />
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{s.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{s.desc}</p>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        {selectedInstance?.ai_sdr_enabled ? (
          <div className="space-y-6">
            {renderSection()}

            {/* Floating save button */}
            {activeSection !== "fluxo" && activeSection !== "analytics" && (
              <div className="sticky bottom-4 flex justify-end">
                <Button onClick={handleSave} disabled={saving} size="lg" className="gap-2 shadow-lg">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Salvar Configuração
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4">
            <Bot className="w-16 h-16 text-muted-foreground/30" />
            <h3 className="text-lg font-bold text-foreground">SDR IA desativada</h3>
            <p className="text-sm text-muted-foreground">Ative a IA na instância selecionada para configurar.</p>
            <Button onClick={handleToggle} disabled={toggling} className="gap-2">
              {toggling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              Ativar SDR IA
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}