
-- Fix: remove the empty-token fallback that bypasses session_token check
DROP POLICY IF EXISTS "Anon read own submission" ON public.test_submissions;

CREATE POLICY "Anon read own submission" ON public.test_submissions
  FOR SELECT TO anon
  USING (
    status IN ('in_progress', 'completed')
    AND test_link_id IS NOT NULL
    AND session_token = get_request_session_token()
  );
