
CREATE TABLE public.lead_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  lead_name TEXT NOT NULL DEFAULT '',
  whatsapp TEXT DEFAULT '',
  social_link TEXT DEFAULT '',
  metric_type TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.lead_entries ENABLE ROW LEVEL SECURITY;

-- Members can insert their own leads
CREATE POLICY "Members insert own leads" ON public.lead_entries
  FOR INSERT TO authenticated
  WITH CHECK (member_id = public.get_my_team_member_id());

-- Members can read own leads
CREATE POLICY "Members read own leads" ON public.lead_entries
  FOR SELECT TO authenticated
  USING (member_id = public.get_my_team_member_id() OR public.has_role(auth.uid(), 'admin'));

-- Admins full access
CREATE POLICY "Admins manage lead_entries" ON public.lead_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
