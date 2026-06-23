/**
 * Domínio semântico de conversas — Fase 3
 * Tipos fortes alinhados com os enums do banco (Fase 1 + Fase 2).
 * lead_status permanece como campo legado até a migração completa.
 */

// ─── Estágio comercial ────────────────────────────────────────────
export const LEAD_STAGES = [
  'novo',
  'em_contato',
  'qualificado',
  'agendado',
  'reuniao',
  'proposta',
  'ganho',
  'perdido',
  'pausado',
] as const;

export type LeadStage = (typeof LEAD_STAGES)[number];

// ─── Modo de atendimento ──────────────────────────────────────────
export const CONVERSATION_MODES = [
  'ia_ativa',
  'humano_assumiu',
  'compartilhado',
  'pausado',
] as const;

export type ConversationMode = (typeof CONVERSATION_MODES)[number];

// ─── Prioridade operacional ───────────────────────────────────────
export const PRIORITY_LEVELS = [
  'normal',
  'atento',
  'urgente',
] as const;

export type PriorityLevel = (typeof PRIORITY_LEVELS)[number];

// ─── Status da conversa (campo legado `status`) ───────────────────
export const CONVERSATION_STATUSES = [
  'active',
  'waiting',
  'closed',
] as const;

export type ConversationStatus = (typeof CONVERSATION_STATUSES)[number];

// ─── Role de atribuição (campo legado `assigned_role`) ────────────
export const ASSIGNMENT_ROLES = [
  'sdr',
  'closer',
  'admin',
] as const;

export type AssignmentRole = (typeof ASSIGNMENT_ROLES)[number];

// ─── Trilha de auditoria (Fase 2) ────────────────────────────────
export const STATE_EVENT_ACTOR_TYPES = [
  'human',
  'ai',
  'system',
  'admin',
] as const;

export type StateEventActorType = (typeof STATE_EVENT_ACTOR_TYPES)[number];

export const STATE_EVENT_SOURCES = [
  'ui',
  'ai_sdr_agent',
  'webhook',
  'automation',
  'migration',
  'admin_action',
] as const;

export type StateEventSource = (typeof STATE_EVENT_SOURCES)[number];

export interface WaConversationStateEvent {
  id: string;
  conversation_id: string;
  previous_lead_stage: LeadStage | null;
  new_lead_stage: LeadStage | null;
  previous_conversation_mode: ConversationMode | null;
  new_conversation_mode: ConversationMode | null;
  previous_priority_level: PriorityLevel | null;
  new_priority_level: PriorityLevel | null;
  actor_type: StateEventActorType;
  actor_user_id: string | null;
  actor_team_member_id: string | null;
  source: StateEventSource;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ─── Labels para UI (prontos para uso futuro) ─────────────────────

export const LEAD_STAGE_LABELS: Record<LeadStage, string> = {
  novo: 'Novo',
  em_contato: 'Em contato',
  qualificado: 'Qualificado',
  agendado: 'Agendado',
  reuniao: 'Reunião',
  proposta: 'Proposta',
  ganho: 'Ganho',
  perdido: 'Perdido',
  pausado: 'Pausado',
};

export const CONVERSATION_MODE_LABELS: Record<ConversationMode, string> = {
  ia_ativa: 'IA Ativa',
  humano_assumiu: 'Humano assumiu',
  compartilhado: 'Compartilhado',
  pausado: 'Pausado',
};

export const PRIORITY_LEVEL_LABELS: Record<PriorityLevel, string> = {
  normal: 'Normal',
  atento: 'Atento',
  urgente: 'Urgente',
};
