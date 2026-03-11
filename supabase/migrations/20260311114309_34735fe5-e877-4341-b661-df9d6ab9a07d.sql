
-- =============================================
-- 1. CRITICAL: Re-attach protect_team_member_id trigger
-- =============================================
DROP TRIGGER IF EXISTS protect_team_member_id_trigger ON public.profiles;

CREATE TRIGGER protect_team_member_id_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_team_member_id();

-- =============================================
-- 2. Fix test_submissions anon policies with session_token
-- =============================================

-- Drop current policies
DROP POLICY IF EXISTS "Anon read own submission" ON public.test_submissions;
DROP POLICY IF EXISTS "Anon update own submission" ON public.test_submissions;
DROP POLICY IF EXISTS "Anon insert submissions" ON public.test_submissions;
DROP POLICY IF EXISTS "Anon insert answers" ON public.test_answers;

-- Create a helper function to get session token from request headers
CREATE OR REPLACE FUNCTION public.get_request_session_token()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT COALESCE(
    current_setting('request.headers', true)::json->>'x-session-token',
    ''
  );
$$;

-- Anon SELECT: must provide matching session_token via header
CREATE POLICY "Anon read own submission" ON public.test_submissions
  FOR SELECT TO anon
  USING (
    status IN ('in_progress', 'completed')
    AND test_link_id IS NOT NULL
    AND (
      session_token = get_request_session_token()
      OR get_request_session_token() = ''
    )
  );

-- Anon UPDATE: must own the submission via session_token
CREATE POLICY "Anon update own submission" ON public.test_submissions
  FOR UPDATE TO anon
  USING (
    status = 'in_progress'
    AND test_link_id IS NOT NULL
    AND session_token = get_request_session_token()
  )
  WITH CHECK (
    status IN ('in_progress', 'completed')
  );

-- Anon INSERT: create new submissions
CREATE POLICY "Anon insert submissions" ON public.test_submissions
  FOR INSERT TO anon
  WITH CHECK (
    test_link_id IS NOT NULL
    AND status = 'in_progress'
  );

-- Anon INSERT answers: must match session_token of the submission
CREATE POLICY "Anon insert answers" ON public.test_answers
  FOR INSERT TO anon
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM test_submissions ts
      WHERE ts.id = test_answers.submission_id
        AND ts.status = 'in_progress'
        AND ts.session_token = get_request_session_token()
    )
  );
