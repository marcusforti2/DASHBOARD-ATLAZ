
-- 1. Add provider_message_id to wa_messages for real dedup
ALTER TABLE public.wa_messages ADD COLUMN IF NOT EXISTS provider_message_id text;

-- 2. Unique partial index for dedup (NULLs are ignored = legacy compatible)
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_messages_provider_dedup
  ON public.wa_messages (conversation_id, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- 3. Unique index on automation_actions for enrollment+step dedup
CREATE UNIQUE INDEX IF NOT EXISTS idx_automation_actions_enrollment_step
  ON public.automation_actions (enrollment_id, step_index);

-- 4. Index for ready actions (used by claim function)
CREATE INDEX IF NOT EXISTS idx_automation_actions_ready
  ON public.automation_actions (status, scheduled_for)
  WHERE status IN ('pending', 'retry');

-- 5. Replace claim function with retry-aware semantics
CREATE OR REPLACE FUNCTION public.claim_automation_actions(batch_size integer DEFAULT 10, worker_id text DEFAULT 'default'::text)
 RETURNS SETOF automation_actions
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT a.id
    FROM public.automation_actions a
    WHERE a.status IN ('pending', 'retry')
      AND a.scheduled_for <= now()
      AND a.retry_count < 5
      AND NOT EXISTS (
        SELECT 1 FROM public.contact_suppressions cs
        JOIN public.wa_contacts wc ON public.normalize_phone(wc.phone) = cs.phone
        WHERE wc.id = a.contact_id
      )
    ORDER BY a.scheduled_for ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.automation_actions
  SET status = 'locked', locked_at = now(), locked_by = worker_id
  FROM claimable
  WHERE public.automation_actions.id = claimable.id
  RETURNING public.automation_actions.*;
END;
$function$;
