
-- Table to store event reminders for WhatsApp notifications
CREATE TABLE public.event_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_google_id text NOT NULL,
  event_title text NOT NULL,
  event_description text DEFAULT '',
  event_start_at timestamptz NOT NULL,
  lead_name text DEFAULT '',
  lead_phone text DEFAULT '',
  team_member_ids text[] DEFAULT '{}',
  remind_at timestamptz NOT NULL,
  reminder_type text NOT NULL DEFAULT 'lead',
  reminder_label text NOT NULL DEFAULT '24h',
  sent boolean NOT NULL DEFAULT false,
  sent_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.event_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users manage own reminders"
  ON public.event_reminders FOR ALL
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins manage all reminders"
  ON public.event_reminders FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- Index for efficient cron queries
CREATE INDEX idx_event_reminders_pending ON public.event_reminders (remind_at) WHERE sent = false;
