
CREATE TABLE public.email_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  flow_id uuid NOT NULL REFERENCES public.email_flows(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  recipient_name text,
  subject text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.email_send_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email_send_logs" ON public.email_send_logs
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_email_send_logs_flow_id ON public.email_send_logs(flow_id);
CREATE INDEX idx_email_send_logs_sent_at ON public.email_send_logs(sent_at DESC);
