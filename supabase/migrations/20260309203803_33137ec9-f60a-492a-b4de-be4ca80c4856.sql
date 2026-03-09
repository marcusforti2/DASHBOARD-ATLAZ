
-- Fix overly permissive RLS: restrict insert/delete to authenticated users (closers/sdrs can tag their assigned contacts)
DROP POLICY "Authenticated insert wa_contact_tags" ON public.wa_contact_tags;
DROP POLICY "Authenticated delete wa_contact_tags" ON public.wa_contact_tags;

CREATE POLICY "Authenticated insert wa_contact_tags" ON public.wa_contact_tags FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));

CREATE POLICY "Authenticated delete wa_contact_tags" ON public.wa_contact_tags FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'closer'::app_role) OR has_role(auth.uid(), 'sdr'::app_role));
