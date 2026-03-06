
ALTER TABLE public.training_courses ADD COLUMN IF NOT EXISTS drive_folder_id text DEFAULT NULL;
ALTER TABLE public.training_modules ADD COLUMN IF NOT EXISTS drive_folder_id text DEFAULT NULL;
ALTER TABLE public.training_lessons ADD COLUMN IF NOT EXISTS drive_folder_id text DEFAULT NULL;
