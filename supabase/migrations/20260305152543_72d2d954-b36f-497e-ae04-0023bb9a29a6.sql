
CREATE TABLE public.process_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_public BOOLEAN NOT NULL DEFAULT false,
  public_token TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.process_flows ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins manage process_flows" ON public.process_flows
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Owner can manage their own
CREATE POLICY "Users manage own process_flows" ON public.process_flows
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Public processes can be read by anyone (for public links)
CREATE POLICY "Public process_flows readable" ON public.process_flows
  FOR SELECT TO anon, authenticated
  USING (is_public = true);

-- Trigger for updated_at
CREATE TRIGGER update_process_flows_updated_at
  BEFORE UPDATE ON public.process_flows
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
