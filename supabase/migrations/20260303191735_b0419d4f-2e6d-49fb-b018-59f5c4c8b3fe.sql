
-- Add member_id to monthly_goals and weekly_goals for per-closer goals
-- NULL member_id = team goal, non-null = individual closer goal

-- Drop the unique constraint on monthly_goals.month_id
ALTER TABLE public.monthly_goals DROP CONSTRAINT IF EXISTS monthly_goals_month_id_key;

-- Add member_id columns
ALTER TABLE public.monthly_goals ADD COLUMN member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE;
ALTER TABLE public.weekly_goals ADD COLUMN member_id uuid REFERENCES public.team_members(id) ON DELETE CASCADE;

-- Add unique constraints for team goals (member_id IS NULL) and individual goals
CREATE UNIQUE INDEX monthly_goals_month_member_unique ON public.monthly_goals (month_id, COALESCE(member_id, '00000000-0000-0000-0000-000000000000'));
CREATE UNIQUE INDEX weekly_goals_month_week_member_unique ON public.weekly_goals (month_id, week_number, COALESCE(member_id, '00000000-0000-0000-0000-000000000000'));
