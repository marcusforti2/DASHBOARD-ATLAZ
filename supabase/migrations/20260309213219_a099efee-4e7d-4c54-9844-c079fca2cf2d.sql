
-- Internal notes on leads/contacts
CREATE TABLE public.wa_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  conversation_id uuid REFERENCES public.wa_conversations(id) ON DELETE SET NULL,
  author_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_notes" ON public.wa_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_notes" ON public.wa_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Members insert wa_notes" ON public.wa_notes FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

-- Transfer logs
CREATE TABLE public.wa_transfer_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  from_member_id uuid REFERENCES public.team_members(id),
  to_member_id uuid NOT NULL REFERENCES public.team_members(id),
  from_role text,
  to_role text NOT NULL DEFAULT 'closer',
  note text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_transfer_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_transfer_logs" ON public.wa_transfer_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_transfer_logs" ON public.wa_transfer_logs FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Members insert wa_transfer_logs" ON public.wa_transfer_logs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

-- Lead scores
CREATE TABLE public.wa_lead_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE UNIQUE,
  score integer NOT NULL DEFAULT 0,
  engagement_score integer NOT NULL DEFAULT 0,
  response_speed_score integer NOT NULL DEFAULT 0,
  sentiment_score integer NOT NULL DEFAULT 50,
  risk_level text NOT NULL DEFAULT 'low',
  last_calculated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_lead_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_lead_scores" ON public.wa_lead_scores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_lead_scores" ON public.wa_lead_scores FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Members upsert wa_lead_scores" ON public.wa_lead_scores FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "Members update wa_lead_scores" ON public.wa_lead_scores FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

-- Follow-up reminders
CREATE TABLE public.wa_follow_up_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.team_members(id),
  remind_at timestamptz NOT NULL,
  note text DEFAULT '',
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_follow_up_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_follow_up_reminders" ON public.wa_follow_up_reminders FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_follow_up_reminders" ON public.wa_follow_up_reminders FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Members insert wa_follow_up_reminders" ON public.wa_follow_up_reminders FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "Members update wa_follow_up_reminders" ON public.wa_follow_up_reminders FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

-- Enable realtime for notes and transfer logs
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_transfer_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_follow_up_reminders;
