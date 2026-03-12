
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_event_actor_type_enum') THEN
    CREATE TYPE public.conversation_event_actor_type_enum AS ENUM (
      'human', 'ai', 'system', 'admin'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'conversation_event_source_enum') THEN
    CREATE TYPE public.conversation_event_source_enum AS ENUM (
      'ui', 'ai_sdr_agent', 'webhook', 'automation', 'migration', 'admin_action'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.wa_conversation_state_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  previous_lead_stage public.lead_stage_enum,
  new_lead_stage public.lead_stage_enum,
  previous_conversation_mode public.conversation_mode_enum,
  new_conversation_mode public.conversation_mode_enum,
  previous_priority_level public.priority_level_enum,
  new_priority_level public.priority_level_enum,
  actor_type public.conversation_event_actor_type_enum NOT NULL,
  actor_user_id uuid,
  actor_team_member_id uuid,
  source public.conversation_event_source_enum NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_conversation_state_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage wa_conversation_state_events" ON public.wa_conversation_state_events;
CREATE POLICY "Admins manage wa_conversation_state_events"
ON public.wa_conversation_state_events
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Scoped read wa_conversation_state_events" ON public.wa_conversation_state_events;
CREATE POLICY "Scoped read wa_conversation_state_events"
ON public.wa_conversation_state_events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR EXISTS (
    SELECT 1
    FROM public.wa_conversations wc
    JOIN public.profiles p ON p.team_member_id = wc.assigned_to
    WHERE wc.id = wa_conversation_state_events.conversation_id
      AND p.id = auth.uid()
  )
);

CREATE INDEX IF NOT EXISTS idx_wa_conversation_state_events_conversation_id
  ON public.wa_conversation_state_events (conversation_id, created_at DESC);

INSERT INTO public.wa_conversation_state_events (
  conversation_id,
  previous_lead_stage,
  new_lead_stage,
  previous_conversation_mode,
  new_conversation_mode,
  previous_priority_level,
  new_priority_level,
  actor_type,
  source,
  reason,
  metadata
)
SELECT
  id,
  NULL,
  lead_stage,
  NULL,
  conversation_mode,
  NULL,
  priority_level,
  'system'::public.conversation_event_actor_type_enum,
  'migration'::public.conversation_event_source_enum,
  'Inicialização dos novos campos semânticos',
  jsonb_build_object('legacy_lead_status', lead_status)
FROM public.wa_conversations;
