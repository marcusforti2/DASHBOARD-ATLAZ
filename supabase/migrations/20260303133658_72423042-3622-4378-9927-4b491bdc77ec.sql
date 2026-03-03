
-- Table for team members
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for monthly periods
CREATE TABLE public.months (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  label TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (year, month)
);

-- Monthly goals
CREATE TABLE public.monthly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  conexoes INTEGER NOT NULL DEFAULT 0,
  conexoes_aceitas INTEGER NOT NULL DEFAULT 0,
  abordagens INTEGER NOT NULL DEFAULT 0,
  inmail INTEGER NOT NULL DEFAULT 0,
  follow_up INTEGER NOT NULL DEFAULT 0,
  numero INTEGER NOT NULL DEFAULT 0,
  lig_agendada INTEGER NOT NULL DEFAULT 0,
  lig_realizada INTEGER NOT NULL DEFAULT 0,
  reuniao_agendada INTEGER NOT NULL DEFAULT 0,
  reuniao_realizada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (month_id)
);

-- Weekly goals
CREATE TABLE public.weekly_goals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL CHECK (week_number >= 1 AND week_number <= 5),
  conexoes INTEGER NOT NULL DEFAULT 0,
  conexoes_aceitas INTEGER NOT NULL DEFAULT 0,
  abordagens INTEGER NOT NULL DEFAULT 0,
  inmail INTEGER NOT NULL DEFAULT 0,
  follow_up INTEGER NOT NULL DEFAULT 0,
  numero INTEGER NOT NULL DEFAULT 0,
  lig_agendada INTEGER NOT NULL DEFAULT 0,
  lig_realizada INTEGER NOT NULL DEFAULT 0,
  reuniao_agendada INTEGER NOT NULL DEFAULT 0,
  reuniao_realizada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (month_id, week_number)
);

-- Daily metrics entries
CREATE TABLE public.daily_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  day_of_week TEXT NOT NULL,
  conexoes INTEGER NOT NULL DEFAULT 0,
  conexoes_aceitas INTEGER NOT NULL DEFAULT 0,
  abordagens INTEGER NOT NULL DEFAULT 0,
  inmail INTEGER NOT NULL DEFAULT 0,
  follow_up INTEGER NOT NULL DEFAULT 0,
  numero INTEGER NOT NULL DEFAULT 0,
  lig_agendada INTEGER NOT NULL DEFAULT 0,
  lig_realizada INTEGER NOT NULL DEFAULT 0,
  reuniao_agendada INTEGER NOT NULL DEFAULT 0,
  reuniao_realizada INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (member_id, date)
);

-- AI reports storage
CREATE TABLE public.ai_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL DEFAULT 'monthly',
  content TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_reports ENABLE ROW LEVEL SECURITY;

-- Public read/write policies (no auth required for this internal tool)
CREATE POLICY "Allow all access to team_members" ON public.team_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to months" ON public.months FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to monthly_goals" ON public.monthly_goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to weekly_goals" ON public.weekly_goals FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to daily_metrics" ON public.daily_metrics FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to ai_reports" ON public.ai_reports FOR ALL USING (true) WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_daily_metrics_updated_at
BEFORE UPDATE ON public.daily_metrics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
