ALTER TABLE public.wa_conversations 
  ADD COLUMN IF NOT EXISTS linkedin_context text DEFAULT '',
  ADD COLUMN IF NOT EXISTS linkedin_profile jsonb DEFAULT '{}'::jsonb;