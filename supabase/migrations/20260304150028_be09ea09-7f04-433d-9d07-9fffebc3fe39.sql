
-- Motivational popups table
CREATE TABLE public.motivational_popups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL,
  emoji text DEFAULT '🔥',
  category text NOT NULL DEFAULT 'motivation',
  active boolean NOT NULL DEFAULT true,
  time_range_start time DEFAULT '08:00',
  time_range_end time DEFAULT '18:00',
  frequency_minutes integer DEFAULT 120,
  target_role text DEFAULT 'all',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.motivational_popups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage motivational_popups" ON public.motivational_popups
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read motivational_popups" ON public.motivational_popups
  FOR SELECT TO authenticated
  USING (true);

-- Company knowledge base table
CREATE TABLE public.company_knowledge (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'general',
  title text NOT NULL,
  content text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_knowledge ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage company_knowledge" ON public.company_knowledge
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read company_knowledge" ON public.company_knowledge
  FOR SELECT TO authenticated
  USING (true);
