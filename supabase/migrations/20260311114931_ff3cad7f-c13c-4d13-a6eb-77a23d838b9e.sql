
-- 1. Fix profiles UPDATE policy to prevent team_member_id changes
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND team_member_id IS NOT DISTINCT FROM (SELECT p.team_member_id FROM public.profiles p WHERE p.id = auth.uid())
  );

-- 2. Restrict training content to published only for non-admins
DROP POLICY IF EXISTS "Authenticated read training_courses" ON public.training_courses;
CREATE POLICY "Scoped read training_courses" ON public.training_courses
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR (published = true AND active = true));

DROP POLICY IF EXISTS "Authenticated read training_modules" ON public.training_modules;
CREATE POLICY "Scoped read training_modules" ON public.training_modules
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR course_id IN (
    SELECT id FROM public.training_courses WHERE published = true AND active = true
  ));

DROP POLICY IF EXISTS "Authenticated read training_lessons" ON public.training_lessons;
CREATE POLICY "Scoped read training_lessons" ON public.training_lessons
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR module_id IN (
    SELECT tm.id FROM public.training_modules tm
    JOIN public.training_courses tc ON tc.id = tm.course_id
    WHERE tc.published = true AND tc.active = true
  ));
