
ALTER TABLE public.team_members 
  ADD COLUMN IF NOT EXISTS email text DEFAULT '',
  ADD COLUMN IF NOT EXISTS phone text DEFAULT '';
