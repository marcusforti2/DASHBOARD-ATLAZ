
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lead_stage_enum') THEN
    CREATE TYPE public.lead_stage_enum AS ENUM (
      'novo', 'em_contato', 'qualificado', 'agendado', 'reuniao', 'proposta', 'ganho', 'perdido', 'pausado'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_mode_enum') THEN
    CREATE TYPE public.conversation_mode_enum AS ENUM (
      'ia_ativa', 'humano_assumiu', 'compartilhado', 'pausado'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level_enum') THEN
    CREATE TYPE public.priority_level_enum AS ENUM (
      'normal', 'atento', 'urgente'
    );
  END IF;
END $$;

ALTER TABLE public.wa_conversations
  ADD COLUMN IF NOT EXISTS lead_stage public.lead_stage_enum,
  ADD COLUMN IF NOT EXISTS conversation_mode public.conversation_mode_enum,
  ADD COLUMN IF NOT EXISTS priority_level public.priority_level_enum,
  ADD COLUMN IF NOT EXISTS handoff_reason text,
  ADD COLUMN IF NOT EXISTS human_takeover_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_takeover_by uuid,
  ADD COLUMN IF NOT EXISTS last_ai_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_human_message_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_stage_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_stage_changed_by uuid,
  ADD COLUMN IF NOT EXISTS last_mode_changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_mode_changed_by uuid;

UPDATE public.wa_conversations
SET lead_stage = CASE lead_status
    WHEN 'novo' THEN 'novo'::public.lead_stage_enum
    WHEN 'em_contato' THEN 'em_contato'::public.lead_stage_enum
    WHEN 'qualificado' THEN 'qualificado'::public.lead_stage_enum
    WHEN 'agendado' THEN 'agendado'::public.lead_stage_enum
    WHEN 'reuniao' THEN 'reuniao'::public.lead_stage_enum
    WHEN 'perdido' THEN 'perdido'::public.lead_stage_enum
    WHEN 'urgente' THEN 'em_contato'::public.lead_stage_enum
    ELSE 'novo'::public.lead_stage_enum
  END
WHERE lead_stage IS NULL;

UPDATE public.wa_conversations
SET conversation_mode = CASE lead_status
    WHEN 'agendado' THEN 'humano_assumiu'::public.conversation_mode_enum
    WHEN 'reuniao' THEN 'humano_assumiu'::public.conversation_mode_enum
    WHEN 'perdido' THEN 'pausado'::public.conversation_mode_enum
    WHEN 'urgente' THEN 'humano_assumiu'::public.conversation_mode_enum
    ELSE 'ia_ativa'::public.conversation_mode_enum
  END
WHERE conversation_mode IS NULL;

UPDATE public.wa_conversations
SET priority_level = CASE lead_status
    WHEN 'urgente' THEN 'urgente'::public.priority_level_enum
    WHEN 'qualificado' THEN 'atento'::public.priority_level_enum
    WHEN 'agendado' THEN 'atento'::public.priority_level_enum
    WHEN 'reuniao' THEN 'atento'::public.priority_level_enum
    ELSE 'normal'::public.priority_level_enum
  END
WHERE priority_level IS NULL;

UPDATE public.wa_conversations
SET
  last_stage_changed_at = COALESCE(last_stage_changed_at, updated_at, created_at),
  last_mode_changed_at = COALESCE(last_mode_changed_at, updated_at, created_at);

ALTER TABLE public.wa_conversations
  ALTER COLUMN lead_stage SET NOT NULL,
  ALTER COLUMN lead_stage SET DEFAULT 'novo'::public.lead_stage_enum,
  ALTER COLUMN conversation_mode SET NOT NULL,
  ALTER COLUMN conversation_mode SET DEFAULT 'ia_ativa'::public.conversation_mode_enum,
  ALTER COLUMN priority_level SET NOT NULL,
  ALTER COLUMN priority_level SET DEFAULT 'normal'::public.priority_level_enum;

CREATE INDEX IF NOT EXISTS idx_wa_conversations_lead_stage ON public.wa_conversations (lead_stage);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_conversation_mode ON public.wa_conversations (conversation_mode);
CREATE INDEX IF NOT EXISTS idx_wa_conversations_priority_level ON public.wa_conversations (priority_level);
