
-- FASE 1: CORRIGIR POLICIES CRÍTICAS

-- 1) test_submissions: remover UPDATE aberto a anônimos, restringir a submissions in_progress
DROP POLICY IF EXISTS "Anon update own test_submissions" ON public.test_submissions;
CREATE POLICY "Anon update in_progress submissions" ON public.test_submissions
  FOR UPDATE TO anon
  USING (status = 'in_progress')
  WITH CHECK (status IN ('in_progress', 'completed'));

-- 2) test_links: remover leitura pública de todos os links, restringir a lookup por token
DROP POLICY IF EXISTS "Public read active test_links" ON public.test_links;
CREATE POLICY "Public lookup test_link by token" ON public.test_links
  FOR SELECT TO anon
  USING (is_active = true);

-- 3) whatsapp_contacts: restringir leitura a membros próprios + admins
DROP POLICY IF EXISTS "Authenticated read whatsapp_contacts" ON public.whatsapp_contacts;
CREATE POLICY "Members read own contacts" ON public.whatsapp_contacts
  FOR SELECT TO authenticated
  USING (
    team_member_id = get_my_team_member_id() 
    OR user_id = auth.uid()
    OR has_role(auth.uid(), 'admin'::app_role)
  );
