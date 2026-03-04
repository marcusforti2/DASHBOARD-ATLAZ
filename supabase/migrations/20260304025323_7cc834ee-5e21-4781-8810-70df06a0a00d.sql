
-- Add optional user_id for admin contacts, make team_member_id nullable
ALTER TABLE public.whatsapp_contacts 
  ADD COLUMN user_id uuid,
  ALTER COLUMN team_member_id DROP NOT NULL;

-- Drop the unique constraint on team_member_id and add a broader one
ALTER TABLE public.whatsapp_contacts DROP CONSTRAINT IF EXISTS whatsapp_contacts_team_member_id_key;
CREATE UNIQUE INDEX whatsapp_contacts_team_member_unique ON public.whatsapp_contacts (team_member_id) WHERE team_member_id IS NOT NULL;
CREATE UNIQUE INDEX whatsapp_contacts_user_unique ON public.whatsapp_contacts (user_id) WHERE user_id IS NOT NULL;
