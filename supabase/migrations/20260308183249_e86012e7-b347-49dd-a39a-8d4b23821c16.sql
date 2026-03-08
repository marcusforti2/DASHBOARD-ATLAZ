
-- Fix linter warning: tighten ai_reports insert to authenticated only (not anon)
DROP POLICY IF EXISTS "Authenticated insert ai_reports" ON public.ai_reports;
CREATE POLICY "Authenticated insert ai_reports" ON public.ai_reports
  FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Tighten anon insert on test_submissions: require test_link_id and status in_progress
DROP POLICY IF EXISTS "Anon insert test_submissions" ON public.test_submissions;
CREATE POLICY "Anon insert test_submissions" ON public.test_submissions
  FOR INSERT TO anon
  WITH CHECK (test_link_id IS NOT NULL AND status = 'in_progress');

-- Tighten anon insert on test_answers: require submission exists
DROP POLICY IF EXISTS "Anon insert test_answers" ON public.test_answers;
CREATE POLICY "Anon insert test_answers" ON public.test_answers
  FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.test_submissions ts 
    WHERE ts.id = submission_id AND ts.status = 'in_progress'
  ));
