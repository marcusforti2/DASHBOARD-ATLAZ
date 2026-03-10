
-- Email templates table
CREATE TABLE public.email_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  tenant_id text DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_templates" ON public.email_templates
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read email_templates" ON public.email_templates
  FOR SELECT TO authenticated
  USING (true);

-- Email flows table
CREATE TABLE public.email_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT false,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  edges jsonb NOT NULL DEFAULT '[]'::jsonb,
  audience_type text NOT NULL DEFAULT 'all',
  audience_member_ids text[] DEFAULT '{}'::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_flows" ON public.email_flows
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read email_flows" ON public.email_flows
  FOR SELECT TO authenticated
  USING (true);

-- Email flow executions table
CREATE TABLE public.email_flow_executions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid REFERENCES public.email_flows(id) ON DELETE CASCADE NOT NULL,
  member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  started_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT NULL,
  error_message text DEFAULT NULL
);

ALTER TABLE public.email_flow_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_flow_executions" ON public.email_flow_executions
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
