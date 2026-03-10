
CREATE TABLE public.pipedrive_sdr_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_pipedrive_id integer NOT NULL,
  person_name text,
  person_phone text NOT NULL,
  instance_id uuid NOT NULL REFERENCES public.wa_instances(id),
  instance_name text NOT NULL,
  conversation_id uuid REFERENCES public.wa_conversations(id),
  contact_id uuid REFERENCES public.wa_contacts(id),
  pipedrive_context jsonb DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  attempts integer DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  team_member_id uuid REFERENCES public.team_members(id)
);

ALTER TABLE public.pipedrive_sdr_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON public.pipedrive_sdr_queue
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_sdr_queue_status ON public.pipedrive_sdr_queue(status) WHERE status = 'pending';
CREATE INDEX idx_sdr_queue_created ON public.pipedrive_sdr_queue(created_at);
