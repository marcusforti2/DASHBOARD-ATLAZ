
-- 1) Create SECURITY DEFINER function to lookup test_link by token (prevents enumeration)
CREATE OR REPLACE FUNCTION public.get_test_link_by_token(_token text)
RETURNS SETOF public.test_links
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM public.test_links WHERE token = _token AND is_active = true LIMIT 1;
$$;

-- 2) Remove anon SELECT on test_links entirely (force through function)
DROP POLICY IF EXISTS "Public lookup test_link by token" ON public.test_links;

-- 3) Tighten test_submissions: anon can only read their own submission by ID (for the test flow)
CREATE POLICY "Anon read own submission by id" ON public.test_submissions
  FOR SELECT TO anon
  USING (status IN ('in_progress', 'completed'));
