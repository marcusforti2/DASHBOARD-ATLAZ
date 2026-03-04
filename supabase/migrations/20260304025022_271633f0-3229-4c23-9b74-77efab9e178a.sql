
CREATE TABLE public.whatsapp_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  message_template text NOT NULL,
  schedule_cron text,
  target_audience text NOT NULL DEFAULT 'all',
  target_role text,
  active boolean NOT NULL DEFAULT true,
  include_metrics boolean NOT NULL DEFAULT true,
  include_ai_tips boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.whatsapp_automations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage whatsapp_automations"
  ON public.whatsapp_automations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated read whatsapp_automations"
  ON public.whatsapp_automations FOR SELECT
  TO authenticated
  USING (true);
