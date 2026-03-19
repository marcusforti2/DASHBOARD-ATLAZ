/**
 * Domínio central da SDR IA — tipos, defaults e configurações.
 * Fonte única de verdade para AiSdrConfig e estruturas relacionadas.
 */

// ─── Automação por lead source ────────────────────────────────────
export interface LeadSourceAutomation {
  follow_up_enabled: boolean;
  follow_up_hours: number;
  auto_stage_change: boolean;
  stage_on_contact: string;
  stage_on_qualified: string;
  stage_on_meeting: string;
  stage_on_no_response: string;
  notification_priority: 'normal' | 'high' | 'urgent';
  notify_via_whatsapp: boolean;
  flow_id?: string | null;
}

export const DEFAULT_SOURCE_AUTOMATION: LeadSourceAutomation = {
  follow_up_enabled: true,
  follow_up_hours: 24,
  auto_stage_change: true,
  stage_on_contact: 'Em contato',
  stage_on_qualified: 'Qualificado',
  stage_on_meeting: 'Reunião agendada',
  stage_on_no_response: 'Sem resposta',
  notification_priority: 'normal',
  notify_via_whatsapp: false,
  flow_id: null,
};

// ─── Lead source ──────────────────────────────────────────────────
export interface LeadSource {
  id: string;
  name: string;
  active: boolean;
  context: string;
  color: string;
  
  automation?: LeadSourceAutomation;
}

// ─── Configuração completa da SDR IA ──────────────────────────────
export interface AiSdrConfig {
  // Identity
  greeting: string;
  tone: string;
  organic_mode_enabled: boolean;
  organic_prompt: string;
  organic_tone: string;
  organic_name: string;

  // Knowledge
  prompt_context: string;
  master_prompt: string;
  target_audience: string;
  pain_points: string;
  desires: string;

  // Core features
  auto_tag: boolean;
  feature_auto_reply: boolean;
  feature_auto_tag: boolean;
  feature_qualification: boolean;
  feature_handoff: boolean;
  feature_sentiment: boolean;
  feature_pipedrive_sync: boolean;

  // Automation
  max_messages_before_handoff: number;
  business_hours_only: boolean;
  business_hours_start: number;
  business_hours_end: number;
  human_takeover_mode: boolean;
  human_takeover_minutes: number;
  follow_up_hours: number;
  follow_up_enabled: boolean;
  call_focus_mode: boolean;
  split_messages: boolean;
  urgent_call_alert: boolean;
  meeting_followups: boolean;

  // Advanced features
  feature_rate_limit: boolean;
  feature_reengagement: boolean;
  feature_blacklist: boolean;
  feature_daily_summary: boolean;
  feature_language_detection: boolean;
  feature_linkedin_lookup: boolean;
  feature_time_escalation: boolean;
  feature_tts_reply: boolean;
  feature_calendar_auto: boolean;
  feature_smart_delay: boolean;

  // Advanced params
  smart_delay_min_seconds: number;
  smart_delay_max_seconds: number;
  tts_voice_id: string;
  reengagement_days: number;
  escalation_hours: number;
  rate_limit_per_hour: number;
  blacklist_numbers: string[];
  daily_summary_admin_ids: string[];

  // Qualification
  qualification_questions: string[];
  score_thresholds: { a_min: number; b_min: number };

  // Lead sources
  lead_sources: LeadSource[];
}

// ─── Default config ───────────────────────────────────────────────
export const DEFAULT_AI_SDR_CONFIG: AiSdrConfig = {
  greeting: 'Olá! 👋 Obrigado por entrar em contato. Como posso ajudar você hoje?',
  tone: 'profissional',
  organic_mode_enabled: true,
  organic_prompt:
    'O gestor está em imersão hoje, 100% indisponível. Quando alguém mandar msg:\n1. Responda de forma curta e casual (tipo 1 frase só no começo)\n2. Pergunte do que se trata\n3. Anote o assunto e quem é\n4. Fale que vai ver quem cuida disso e retorna depois\n5. Use abreviações: hj, vc, blz, tb, msg\n6. NÃO prometa nada, só anote\n7. Se insistir, diga que ele tá em evento o dia todo e volta amanhã',
  organic_tone: 'casual e amigável',
  organic_name: 'Bia',
  prompt_context: '',
  master_prompt: '',
  target_audience: '',
  pain_points: '',
  desires: '',
  auto_tag: true,
  feature_auto_reply: true,
  feature_auto_tag: true,
  feature_qualification: true,
  feature_handoff: true,
  feature_sentiment: false,
  feature_pipedrive_sync: false,
  max_messages_before_handoff: 10,
  business_hours_only: false,
  business_hours_start: 8,
  business_hours_end: 21,
  human_takeover_mode: true,
  human_takeover_minutes: 60,
  follow_up_hours: 24,
  follow_up_enabled: true,
  call_focus_mode: true,
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
  feature_tts_reply: false,
  feature_calendar_auto: true,
  feature_smart_delay: true,
  smart_delay_min_seconds: 3,
  smart_delay_max_seconds: 20,
  tts_voice_id: 'onwK4e9ZLuTAKqWW03F9',
  reengagement_days: 7,
  escalation_hours: 48,
  rate_limit_per_hour: 5,
  blacklist_numbers: [],
  daily_summary_admin_ids: [],
  qualification_questions: [
    'Como posso te chamar?',
    'Qual tipo de negócio você atua?',
    'Qual o faturamento mensal aproximado?',
    'Já tem processo comercial estruturado?',
  ],
  score_thresholds: { a_min: 80, b_min: 50 },
  lead_sources: [
    {
      id: 'linkedin',
      name: 'PROSPECÇÃO/LINKEDIN',
      active: true,
      context:
        'Lead veio de prospecção ativa no LinkedIn. Você já se conectou com ele e agora está dando continuidade à conversa. Seja pessoal, mencione algo do perfil dele. NÃO diga o nome da empresa logo de cara.',
      color: '#4DA6FF',
      pipedrive_label_id: 43,
      automation: { ...DEFAULT_SOURCE_AUTOMATION, follow_up_hours: 24, notification_priority: 'normal' },
    },
    {
      id: 'dripify',
      name: 'DRIPIFY/AUTOMAÇÃO',
      active: false,
      context:
        'Lead recebeu uma sequência automatizada (Dripify ou similar) e respondeu. O contexto é diferente da prospecção manual — ele pode não lembrar quem você é. Apresente-se brevemente e retome o interesse.',
      color: '#E8A441',
      pipedrive_label_id: 40,
      automation: { ...DEFAULT_SOURCE_AUTOMATION, follow_up_hours: 48, notification_priority: 'normal' },
    },
    {
      id: 'indicacao',
      name: 'INDICAÇÃO',
      active: false,
      context:
        'Lead veio por indicação de alguém. Mencione quem indicou (se disponível) e use isso como ponte de confiança. Tom mais próximo e caloroso.',
      color: '#3B82F6',
      pipedrive_label_id: 27,
      automation: {
        ...DEFAULT_SOURCE_AUTOMATION,
        follow_up_hours: 12,
        notification_priority: 'urgent',
        notify_via_whatsapp: true,
      },
    },
  ],
};

// ─── Tones reutilizáveis ──────────────────────────────────────────
export const AI_SDR_TONES = [
  { value: 'profissional', label: 'Profissional', emoji: '💼', desc: 'Sério e confiável' },
  { value: 'casual', label: 'Casual', emoji: '😊', desc: 'Amigável e leve' },
  { value: 'consultivo', label: 'Consultivo', emoji: '🎯', desc: 'Foco em solução' },
  { value: 'energetico', label: 'Energético', emoji: '⚡', desc: 'Empolgante e ativo' },
] as const;
