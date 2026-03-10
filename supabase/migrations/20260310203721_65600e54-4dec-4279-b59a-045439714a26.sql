
CREATE TABLE public.email_flow_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.email_flows(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text,
  source_file text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_flow_contacts_flow_id ON public.email_flow_contacts(flow_id);

ALTER TABLE public.email_flow_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_flow_contacts"
  ON public.email_flow_contacts
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
