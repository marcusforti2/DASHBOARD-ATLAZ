
-- Add avatar_url to team_members
ALTER TABLE public.team_members ADD COLUMN IF NOT EXISTS avatar_url text;

-- Create public storage bucket for member avatars
INSERT INTO storage.buckets (id, name, public) VALUES ('member-avatars', 'member-avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to member-avatars
CREATE POLICY "Admins upload avatars" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'member-avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update avatars" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'member-avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete avatars" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'member-avatars' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Public read avatars" ON storage.objects FOR SELECT TO public
USING (bucket_id = 'member-avatars');
