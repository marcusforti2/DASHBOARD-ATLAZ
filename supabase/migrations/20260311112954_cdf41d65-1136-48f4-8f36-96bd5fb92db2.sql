
-- =============================================
-- CRITICAL: Attach the protect_team_member_id trigger
-- The function exists but was never bound to the table!
-- =============================================
CREATE TRIGGER protect_team_member_id_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_team_member_id();

-- =============================================
-- Fix wa_notes RLS
-- =============================================
DROP POLICY IF EXISTS "Authenticated read wa_notes" ON public.wa_notes;

CREATE POLICY "Scoped read wa_notes" ON public.wa_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR contact_id IN (
      SELECT wc.contact_id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
         OR wc.assigned_to IS NULL
    )
  );

-- =============================================
-- Fix pipedrive_notes RLS
-- =============================================
DROP POLICY IF EXISTS "Authenticated read pipedrive_notes" ON public.pipedrive_notes;

CREATE POLICY "Scoped read pipedrive_notes" ON public.pipedrive_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR deal_pipedrive_id IN (
      SELECT pd.pipedrive_id FROM public.pipedrive_deals pd
      WHERE pd.team_member_id = get_my_team_member_id()
    )
  );

-- =============================================
-- Fix pipedrive_activities RLS
-- =============================================
DROP POLICY IF EXISTS "Authenticated read pipedrive_activities" ON public.pipedrive_activities;

CREATE POLICY "Scoped read pipedrive_activities" ON public.pipedrive_activities
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR deal_pipedrive_id IN (
      SELECT pd.pipedrive_id FROM public.pipedrive_deals pd
      WHERE pd.team_member_id = get_my_team_member_id()
    )
  );

-- =============================================
-- Fix test_submissions: create a secure accessor function
-- =============================================
CREATE OR REPLACE FUNCTION public.get_submission_by_id(_submission_id uuid)
RETURNS SETOF test_submissions
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT * FROM public.test_submissions 
  WHERE id = _submission_id 
    AND status IN ('in_progress', 'completed')
    AND test_link_id IS NOT NULL
  LIMIT 1;
$$;
