
ALTER TABLE public.wa_instances ADD COLUMN sdr_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL DEFAULT NULL;
