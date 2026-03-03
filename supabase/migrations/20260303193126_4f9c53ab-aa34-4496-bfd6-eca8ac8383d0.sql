
-- Drop the old unique constraint that prevents per-member weekly goals
ALTER TABLE public.weekly_goals DROP CONSTRAINT IF EXISTS weekly_goals_month_id_week_number_key;
