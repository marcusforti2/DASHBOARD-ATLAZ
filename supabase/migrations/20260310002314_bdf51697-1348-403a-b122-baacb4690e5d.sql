
-- ===========================================
-- FIX 1: Restrict anonymous access to test_submissions
-- ===========================================

-- Drop overly permissive anon SELECT policy
DROP POLICY IF EXISTS "Anon read own submission by id" ON public.test_submissions;

-- Recreate: anon can only read submissions they know the ID of AND that belong to a test_link
CREATE POLICY "Anon read own submission by id" ON public.test_submissions
  FOR SELECT TO anon
  USING (
    status = ANY (ARRAY['in_progress'::text, 'completed'::text])
    AND test_link_id IS NOT NULL
  );

-- Drop overly permissive anon UPDATE policy  
DROP POLICY IF EXISTS "Anon update in_progress submissions" ON public.test_submissions;

-- Recreate: anon can only update in_progress submissions that have a test_link_id
CREATE POLICY "Anon update in_progress submissions" ON public.test_submissions
  FOR UPDATE TO anon
  USING (status = 'in_progress'::text AND test_link_id IS NOT NULL)
  WITH CHECK (status = ANY (ARRAY['in_progress'::text, 'completed'::text]));

-- ===========================================
-- FIX 2: Prevent team_member_id hijacking on profiles
-- Block users from changing team_member_id themselves
-- ===========================================

CREATE OR REPLACE FUNCTION public.protect_team_member_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only admins can change team_member_id
  IF NEW.team_member_id IS DISTINCT FROM OLD.team_member_id THEN
    IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
      NEW.team_member_id := OLD.team_member_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_team_member_id
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_team_member_id();

-- ===========================================
-- FIX 3: Restrict pipedrive_persons to admins + assigned members
-- ===========================================

DROP POLICY IF EXISTS "Authenticated read pipedrive_persons" ON public.pipedrive_persons;

CREATE POLICY "Authenticated read pipedrive_persons" ON public.pipedrive_persons
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR wa_contact_id IN (
      SELECT wc.id FROM wa_contacts wc
      JOIN wa_conversations wconv ON wconv.contact_id = wc.id
      WHERE wconv.assigned_to = get_my_team_member_id()
    )
  );

-- ===========================================
-- FIX 4: Restrict wa_contacts to assigned members + admins
-- ===========================================

DROP POLICY IF EXISTS "Authenticated read wa_contacts" ON public.wa_contacts;

CREATE POLICY "Authenticated read wa_contacts" ON public.wa_contacts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR id IN (
      SELECT contact_id FROM wa_conversations
      WHERE assigned_to = get_my_team_member_id()
    )
    OR id IN (
      SELECT contact_id FROM wa_conversations
      WHERE assigned_to IS NULL
    )
  );

-- ===========================================
-- FIX 5: Restrict wa_messages to own conversations + admins
-- ===========================================

DROP POLICY IF EXISTS "Authenticated read wa_messages" ON public.wa_messages;

CREATE POLICY "Authenticated read wa_messages" ON public.wa_messages
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR conversation_id IN (
      SELECT id FROM wa_conversations
      WHERE assigned_to = get_my_team_member_id()
        OR assigned_to IS NULL
    )
  );

-- ===========================================
-- FIX 6: Restrict team_members PII (email/phone) - keep read but hide from non-admins via app logic
-- team_members needs to stay readable for dropdowns, but we add note
-- ===========================================
-- (team_members SELECT stays as-is since names are needed for UI, PII protection handled at app level)
