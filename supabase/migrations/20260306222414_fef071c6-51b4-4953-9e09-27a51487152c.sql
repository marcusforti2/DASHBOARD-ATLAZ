
-- Training Playbooks table
CREATE TABLE public.training_playbooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  content TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'geral',
  target_role TEXT NOT NULL DEFAULT 'all',
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.training_playbooks ENABLE ROW LEVEL SECURITY;

-- Admins can do everything
CREATE POLICY "Admins full access on training_playbooks"
  ON public.training_playbooks
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- SDR/Closer can read published playbooks
CREATE POLICY "Members can read published playbooks"
  ON public.training_playbooks
  FOR SELECT
  TO authenticated
  USING (is_published = true);

-- Updated_at trigger
CREATE TRIGGER update_training_playbooks_updated_at
  BEFORE UPDATE ON public.training_playbooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
