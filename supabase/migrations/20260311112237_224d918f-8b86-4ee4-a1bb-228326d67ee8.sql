
-- Drop overly permissive SELECT policies on wa_ tables
DROP POLICY IF EXISTS "Authenticated read wa_contacts" ON public.wa_contacts;
DROP POLICY IF EXISTS "Authenticated read wa_conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "Authenticated read wa_messages" ON public.wa_messages;

-- wa_contacts: admins see all, members see contacts from their assigned conversations
CREATE POLICY "Members read assigned contacts" ON public.wa_contacts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR id IN (
      SELECT wc.contact_id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
         OR wc.assigned_to IS NULL
    )
  );

-- wa_conversations: admins see all, members see assigned + unassigned
CREATE POLICY "Members read assigned conversations" ON public.wa_conversations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR assigned_to = get_my_team_member_id()
    OR assigned_to IS NULL
  );

-- wa_messages: admins see all, members see messages from their assigned conversations
CREATE POLICY "Members read assigned messages" ON public.wa_messages
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR conversation_id IN (
      SELECT wc.id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
         OR wc.assigned_to IS NULL
    )
  );
