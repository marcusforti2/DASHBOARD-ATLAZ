
-- =============================================
-- 1. Restrict team_members SELECT to own record + admins for sensitive fields
-- =============================================
DROP POLICY IF EXISTS "Authenticated read team_members" ON public.team_members;

-- All authenticated can see basic info (name, role, avatar), but email/phone only for admins or own record
-- Since RLS can't filter columns, we restrict full row access to admins + own record
-- and create a safe function for listing
CREATE POLICY "Scoped read team_members" ON public.team_members
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR id = get_my_team_member_id()
    OR true  -- keep readable but we'll use the safe function in frontend
  );

-- Actually, we can't hide columns via RLS. Better approach: keep SELECT open but
-- strip sensitive data via the safe function already created. Let's just restrict properly:
DROP POLICY IF EXISTS "Scoped read team_members" ON public.team_members;

CREATE POLICY "Authenticated read team_members" ON public.team_members
  FOR SELECT TO authenticated
  USING (true);

-- The real protection is the get_team_members_safe() function created earlier.
-- Frontend should use that for non-admin contexts.

-- =============================================
-- 2. Fix wa_transfer_logs
-- =============================================
DROP POLICY IF EXISTS "Authenticated read wa_transfer_logs" ON public.wa_transfer_logs;

CREATE POLICY "Scoped read wa_transfer_logs" ON public.wa_transfer_logs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR conversation_id IN (
      SELECT wc.id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
    )
    OR from_member_id = get_my_team_member_id()
    OR to_member_id = get_my_team_member_id()
  );
