
-- ═══════════════════════════════════════════════════════════════
-- Módulo de Campanhas — Schema completo com hardening
-- ═══════════════════════════════════════════════════════════════

-- 1. Função de normalização de telefone
CREATE OR REPLACE FUNCTION public.normalize_phone(input text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = 'public'
AS $$
  SELECT regexp_replace(
    CASE
      WHEN left(input, 1) = '+' THEN substring(input from 2)
      ELSE input
    END,
    '[^0-9]', '', 'g'
  );
$$;

-- 2. Tabela de campanhas
CREATE TABLE public.campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'draft', -- draft, active, paused, completed
  instance_id uuid REFERENCES public.wa_instances(id) ON DELETE CASCADE NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual', -- manual, event, scheduled
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb, -- array of action definitions
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage campaigns" ON public.campaigns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read campaigns" ON public.campaigns
  FOR SELECT TO authenticated USING (true);

-- 3. Matrículas (enrollment) com unique por campanha+contato
CREATE TABLE public.campaign_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES public.wa_contacts(id) ON DELETE CASCADE NOT NULL,
  conversation_id uuid REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'active', -- active, completed, cancelled, opted_out
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  current_step integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.campaign_enrollments ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_enrollment_campaign_contact
  ON public.campaign_enrollments(campaign_id, contact_id);

CREATE POLICY "Admins manage enrollments" ON public.campaign_enrollments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read enrollments" ON public.campaign_enrollments
  FOR SELECT TO authenticated USING (true);

-- 4. Fila de ações com campos de concorrência e retry
CREATE TABLE public.automation_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE NOT NULL,
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE NOT NULL,
  contact_id uuid REFERENCES public.wa_contacts(id) ON DELETE CASCADE NOT NULL,
  step_index integer NOT NULL DEFAULT 0,
  action_type text NOT NULL DEFAULT 'send_message', -- send_message, wait, condition, tag, handoff
  action_payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- pending, locked, executed, failed, cancelled, skipped
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- Hardening fields
  locked_at timestamptz,
  locked_by text,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text,
  executed_at timestamptz
);

ALTER TABLE public.automation_actions ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_automation_actions_ready
  ON public.automation_actions(status, scheduled_for)
  WHERE status IN ('pending', 'failed');

CREATE POLICY "Admins manage automation_actions" ON public.automation_actions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 5. Eventos inbound com deduplicação
CREATE TABLE public.campaign_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE CASCADE,
  enrollment_id uuid REFERENCES public.campaign_enrollments(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.wa_contacts(id) ON DELETE CASCADE NOT NULL,
  event_type text NOT NULL, -- message_received, positive_interest, opt_out, reply, link_click
  provider_event_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_campaign_events_provider_dedup
  ON public.campaign_events(provider_event_id)
  WHERE provider_event_id IS NOT NULL;

CREATE POLICY "Admins manage campaign_events" ON public.campaign_events
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read campaign_events" ON public.campaign_events
  FOR SELECT TO authenticated USING (true);

-- 6. Suppressions (opt-out global)
CREATE TABLE public.contact_suppressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  reason text NOT NULL DEFAULT 'opt_out',
  source text NOT NULL DEFAULT 'campaign', -- campaign, manual, complaint
  campaign_id uuid REFERENCES public.campaigns(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.contact_suppressions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_suppression_phone
  ON public.contact_suppressions(phone);

CREATE POLICY "Admins manage suppressions" ON public.contact_suppressions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 7. Trigger updated_at em campaigns
CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 8. Claim function for queue processing (FOR UPDATE SKIP LOCKED)
CREATE OR REPLACE FUNCTION public.claim_automation_actions(batch_size integer DEFAULT 10, worker_id text DEFAULT 'default')
RETURNS SETOF public.automation_actions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH claimable AS (
    SELECT a.id
    FROM public.automation_actions a
    WHERE a.status IN ('pending', 'failed')
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
$$;
