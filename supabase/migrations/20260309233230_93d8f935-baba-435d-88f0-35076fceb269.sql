
-- Pipedrive deals sync table
CREATE TABLE public.pipedrive_deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_id integer NOT NULL UNIQUE,
  title text NOT NULL DEFAULT '',
  person_name text,
  person_id integer,
  org_name text,
  stage_name text,
  pipeline_name text,
  status text DEFAULT 'open',
  value numeric DEFAULT 0,
  currency text DEFAULT 'BRL',
  won_time timestamptz,
  lost_time timestamptz,
  close_time timestamptz,
  lost_reason text,
  owner_name text,
  owner_email text,
  wa_conversation_id uuid REFERENCES wa_conversations(id),
  team_member_id uuid REFERENCES team_members(id),
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipedrive persons sync table
CREATE TABLE public.pipedrive_persons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_id integer NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  email text,
  phone text,
  org_name text,
  owner_name text,
  wa_contact_id uuid REFERENCES wa_contacts(id),
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipedrive activities sync table
CREATE TABLE public.pipedrive_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_id integer NOT NULL UNIQUE,
  type text DEFAULT 'call',
  subject text DEFAULT '',
  deal_pipedrive_id integer,
  person_pipedrive_id integer,
  done boolean DEFAULT false,
  due_date date,
  due_time time,
  note text,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Pipedrive notes sync table
CREATE TABLE public.pipedrive_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pipedrive_id integer NOT NULL UNIQUE,
  content text DEFAULT '',
  deal_pipedrive_id integer,
  person_pipedrive_id integer,
  raw_data jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Webhook log for debugging
CREATE TABLE public.pipedrive_webhook_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event text NOT NULL,
  entity text NOT NULL,
  pipedrive_id integer,
  payload jsonb DEFAULT '{}',
  processed boolean DEFAULT false,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.pipedrive_deals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_persons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pipedrive_webhook_logs ENABLE ROW LEVEL SECURITY;

-- Admin full access policies
CREATE POLICY "Admins manage pipedrive_deals" ON public.pipedrive_deals FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read pipedrive_deals" ON public.pipedrive_deals FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage pipedrive_persons" ON public.pipedrive_persons FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read pipedrive_persons" ON public.pipedrive_persons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage pipedrive_activities" ON public.pipedrive_activities FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read pipedrive_activities" ON public.pipedrive_activities FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage pipedrive_notes" ON public.pipedrive_notes FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated read pipedrive_notes" ON public.pipedrive_notes FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Admins manage pipedrive_webhook_logs" ON public.pipedrive_webhook_logs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
