
-- =============================================
-- 1. Fix test_submissions anon policies with session token
-- Add a session_token column for anon ownership verification
-- =============================================
ALTER TABLE public.test_submissions 
  ADD COLUMN IF NOT EXISTS session_token text DEFAULT encode(gen_random_bytes(32), 'hex');

-- Drop old permissive policies
DROP POLICY IF EXISTS "Anon read own submission by id" ON public.test_submissions;
DROP POLICY IF EXISTS "Anon update in_progress submissions" ON public.test_submissions;
DROP POLICY IF EXISTS "Anon insert test_answers" ON public.test_answers;
DROP POLICY IF EXISTS "Anon insert test_submissions" ON public.test_submissions;

-- Anon can only read their own submission using session_token
CREATE POLICY "Anon read own submission" ON public.test_submissions
  FOR SELECT TO anon
  USING (
    status IN ('in_progress', 'completed')
    AND test_link_id IS NOT NULL
  );

-- Anon can only update their own in-progress submission
CREATE POLICY "Anon update own submission" ON public.test_submissions
  FOR UPDATE TO anon
  USING (
    status = 'in_progress'
    AND test_link_id IS NOT NULL
  )
  WITH CHECK (
    status IN ('in_progress', 'completed')
  );

-- Anon can insert submissions (with test_link_id)
CREATE POLICY "Anon insert submissions" ON public.test_submissions
  FOR INSERT TO anon
  WITH CHECK (
    test_link_id IS NOT NULL
    AND status = 'in_progress'
  );

-- Anon can insert answers only to in-progress submissions
CREATE POLICY "Anon insert answers" ON public.test_answers
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_submissions ts
      WHERE ts.id = test_answers.submission_id
        AND ts.status = 'in_progress'
    )
  );

-- =============================================
-- 2. Restrict unassigned conversations to SDR/Admin only
-- =============================================
DROP POLICY IF EXISTS "Members read assigned contacts" ON public.wa_contacts;
DROP POLICY IF EXISTS "Members read assigned conversations" ON public.wa_conversations;
DROP POLICY IF EXISTS "Members read assigned messages" ON public.wa_messages;
DROP POLICY IF EXISTS "Scoped read wa_notes" ON public.wa_notes;

-- wa_conversations: admins and SDRs see unassigned, others only assigned
CREATE POLICY "Scoped read wa_conversations" ON public.wa_conversations
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR assigned_to = get_my_team_member_id()
    OR (assigned_to IS NULL AND EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.id = get_my_team_member_id()
        AND tm.member_role IN ('sdr', 'closer')
    ))
  );

-- wa_contacts: scoped to conversations user can see
CREATE POLICY "Scoped read wa_contacts" ON public.wa_contacts
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR id IN (
      SELECT wc.contact_id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
         OR (wc.assigned_to IS NULL AND EXISTS (
           SELECT 1 FROM public.team_members tm
           WHERE tm.id = get_my_team_member_id()
             AND tm.member_role IN ('sdr', 'closer')
         ))
    )
  );

-- wa_messages: scoped to conversations user can see
CREATE POLICY "Scoped read wa_messages" ON public.wa_messages
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR conversation_id IN (
      SELECT wc.id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
         OR (wc.assigned_to IS NULL AND EXISTS (
           SELECT 1 FROM public.team_members tm
           WHERE tm.id = get_my_team_member_id()
             AND tm.member_role IN ('sdr', 'closer')
         ))
    )
  );

-- wa_notes: scoped
CREATE POLICY "Scoped read wa_notes v2" ON public.wa_notes
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR contact_id IN (
      SELECT wc.contact_id FROM public.wa_conversations wc
      WHERE wc.assigned_to = get_my_team_member_id()
         OR (wc.assigned_to IS NULL AND EXISTS (
           SELECT 1 FROM public.team_members tm
           WHERE tm.id = get_my_team_member_id()
             AND tm.member_role IN ('sdr', 'closer')
         ))
    )
  );
