
ALTER TABLE public.daily_metrics ADD COLUMN indicacoes integer NOT NULL DEFAULT 0;
ALTER TABLE public.monthly_goals ADD COLUMN indicacoes integer NOT NULL DEFAULT 0;
ALTER TABLE public.weekly_goals ADD COLUMN indicacoes integer NOT NULL DEFAULT 0;
