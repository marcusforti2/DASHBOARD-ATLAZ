
-- Add published flag and timestamp to training_courses
ALTER TABLE public.training_courses ADD COLUMN published boolean NOT NULL DEFAULT false;
ALTER TABLE public.training_courses ADD COLUMN published_at timestamp with time zone;

-- Create training notifications table
CREATE TABLE public.training_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.training_courses(id) ON DELETE CASCADE NOT NULL,
  target_role text NOT NULL DEFAULT 'all',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.training_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage training_notifications" ON public.training_notifications
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read training_notifications" ON public.training_notifications
  FOR SELECT TO authenticated
  USING (true);
