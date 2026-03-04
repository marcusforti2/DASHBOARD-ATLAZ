
-- Test links for behavioral mapping
CREATE TABLE public.test_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(16), 'hex'),
  label text NOT NULL DEFAULT 'Sem rótulo',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.test_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage test_links" ON public.test_links FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Public read active test_links" ON public.test_links FOR SELECT TO anon USING (is_active = true);

-- Test submissions
CREATE TABLE public.test_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_link_id uuid REFERENCES public.test_links(id) ON DELETE SET NULL,
  member_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  respondent_name text,
  respondent_email text,
  respondent_phone text,
  status text NOT NULL DEFAULT 'in_progress',
  completed_at timestamptz,
  ai_analysis jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.test_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage test_submissions" ON public.test_submissions FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anon insert test_submissions" ON public.test_submissions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon update own test_submissions" ON public.test_submissions FOR UPDATE TO anon USING (true) WITH CHECK (true);
CREATE POLICY "Members read own submissions" ON public.test_submissions FOR SELECT TO authenticated USING (member_id = get_my_team_member_id() OR has_role(auth.uid(), 'admin'));

-- Test answers
CREATE TABLE public.test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.test_submissions(id) ON DELETE CASCADE,
  question_id integer NOT NULL,
  answer text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.test_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage test_answers" ON public.test_answers FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Anon insert test_answers" ON public.test_answers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Members read own answers" ON public.test_answers FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.test_submissions ts WHERE ts.id = submission_id AND (ts.member_id = get_my_team_member_id() OR has_role(auth.uid(), 'admin')))
);

-- Chat messages for submission analysis
CREATE TABLE public.dna_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.test_submissions(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.dna_chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins manage dna_chat_messages" ON public.dna_chat_messages FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));
