
-- Table for predefined tags (admin manages)
CREATE TABLE public.wa_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text NOT NULL DEFAULT '#3b82f6',
  sort_order integer NOT NULL DEFAULT 0,
  is_stage boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_tags" ON public.wa_tags FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_tags" ON public.wa_tags FOR SELECT TO authenticated
  USING (true);

-- Junction table for contact-tag relationships
CREATE TABLE public.wa_contact_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES public.wa_tags(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contact_id, tag_id)
);

ALTER TABLE public.wa_contact_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_contact_tags" ON public.wa_contact_tags FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_contact_tags" ON public.wa_contact_tags FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Authenticated insert wa_contact_tags" ON public.wa_contact_tags FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated delete wa_contact_tags" ON public.wa_contact_tags FOR DELETE TO authenticated
  USING (true);

-- Insert default stage tags
INSERT INTO public.wa_tags (name, color, sort_order, is_stage) VALUES
  ('Novo', '#6b7280', 0, true),
  ('Qualificado', '#3b82f6', 1, true),
  ('Negociando', '#f59e0b', 2, true),
  ('Proposta', '#8b5cf6', 3, true),
  ('Fechado', '#10b981', 4, true),
  ('Perdido', '#ef4444', 5, true);

-- Enable realtime for tag changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_contact_tags;
