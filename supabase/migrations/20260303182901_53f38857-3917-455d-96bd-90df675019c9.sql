
-- Create table for behavioral analysis PDFs
CREATE TABLE public.closer_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  ai_analysis text,
  analysis_type text NOT NULL DEFAULT 'behavioral',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.closer_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage closer_analyses"
  ON public.closer_analyses FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Closers read own analyses"
  ON public.closer_analyses FOR SELECT
  TO authenticated
  USING (member_id = public.get_my_team_member_id());

-- Storage bucket for closer PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('closer-documents', 'closer-documents', false);

-- Storage RLS: admins can upload/read/delete
CREATE POLICY "Admins manage closer documents"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'closer-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'closer-documents' AND public.has_role(auth.uid(), 'admin'));

-- Closers can read their own documents
CREATE POLICY "Closers read own documents"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'closer-documents');
