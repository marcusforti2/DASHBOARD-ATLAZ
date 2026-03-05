
ALTER TABLE public.company_knowledge
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_name text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('knowledge-files', 'knowledge-files', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins manage knowledge files"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'knowledge-files' AND public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (bucket_id = 'knowledge-files' AND public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY "Authenticated read knowledge files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'knowledge-files');
