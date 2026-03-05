
ALTER TABLE public.test_links ADD COLUMN test_type text NOT NULL DEFAULT 'closer';
ALTER TABLE public.test_submissions ADD COLUMN test_type text NOT NULL DEFAULT 'closer';
