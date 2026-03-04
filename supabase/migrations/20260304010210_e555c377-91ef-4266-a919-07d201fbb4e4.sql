
-- Add 'sdr' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'sdr';

-- Add member_role column to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS member_role text NOT NULL DEFAULT 'sdr';
