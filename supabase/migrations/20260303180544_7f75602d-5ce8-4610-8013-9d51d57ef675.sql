-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'closer');

-- Create profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  team_member_id uuid REFERENCES public.team_members(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get current user's team_member_id
CREATE OR REPLACE FUNCTION public.get_my_team_member_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT team_member_id FROM public.profiles WHERE id = auth.uid()
$$;

-- RLS for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- RLS for user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Admins can manage roles" ON public.user_roles
  FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update existing RLS policies
DROP POLICY IF EXISTS "Allow all access to daily_metrics" ON public.daily_metrics;
DROP POLICY IF EXISTS "Allow all access to monthly_goals" ON public.monthly_goals;
DROP POLICY IF EXISTS "Allow all access to weekly_goals" ON public.weekly_goals;
DROP POLICY IF EXISTS "Allow all access to months" ON public.months;
DROP POLICY IF EXISTS "Allow all access to team_members" ON public.team_members;
DROP POLICY IF EXISTS "Allow all access to ai_reports" ON public.ai_reports;

-- Authenticated users can read all data
CREATE POLICY "Authenticated read months" ON public.months FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read team_members" ON public.team_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read monthly_goals" ON public.monthly_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read weekly_goals" ON public.weekly_goals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read ai_reports" ON public.ai_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated read daily_metrics" ON public.daily_metrics FOR SELECT TO authenticated USING (true);

-- Closers can insert/update their own daily_metrics
CREATE POLICY "Closers insert own metrics" ON public.daily_metrics
  FOR INSERT TO authenticated
  WITH CHECK (member_id = public.get_my_team_member_id());

CREATE POLICY "Closers update own metrics" ON public.daily_metrics
  FOR UPDATE TO authenticated
  USING (member_id = public.get_my_team_member_id())
  WITH CHECK (member_id = public.get_my_team_member_id());

-- Admins can manage everything
CREATE POLICY "Admins manage daily_metrics" ON public.daily_metrics FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage months" ON public.months FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage team_members" ON public.team_members FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage monthly_goals" ON public.monthly_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage weekly_goals" ON public.weekly_goals FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage ai_reports" ON public.ai_reports FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated insert ai_reports" ON public.ai_reports
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Trigger for updated_at on profiles
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();