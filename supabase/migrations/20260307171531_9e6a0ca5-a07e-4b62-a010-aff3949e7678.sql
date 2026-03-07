
-- 1. Chat conversations table
CREATE TABLE public.coach_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  tool text NOT NULL DEFAULT 'chat',
  title text NOT NULL DEFAULT 'Nova conversa',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own conversations"
  ON public.coach_conversations FOR SELECT
  TO authenticated
  USING (member_id = get_my_team_member_id());

CREATE POLICY "Members insert own conversations"
  ON public.coach_conversations FOR INSERT
  TO authenticated
  WITH CHECK (member_id = get_my_team_member_id());

CREATE POLICY "Members delete own conversations"
  ON public.coach_conversations FOR DELETE
  TO authenticated
  USING (member_id = get_my_team_member_id());

CREATE POLICY "Admins manage coach_conversations"
  ON public.coach_conversations FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 2. Chat messages table
CREATE TABLE public.coach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.coach_conversations(id) ON DELETE CASCADE,
  role text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own messages"
  ON public.coach_messages FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.coach_conversations c
    WHERE c.id = coach_messages.conversation_id
    AND c.member_id = get_my_team_member_id()
  ));

CREATE POLICY "Admins manage coach_messages"
  ON public.coach_messages FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 3. AI tool usage tracking
CREATE TABLE public.ai_tool_usage (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  tool_type text NOT NULL DEFAULT 'chat',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_tool_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members read own usage"
  ON public.ai_tool_usage FOR SELECT
  TO authenticated
  USING (member_id = get_my_team_member_id() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage ai_tool_usage"
  ON public.ai_tool_usage FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- 4. Storage bucket for backups
INSERT INTO storage.buckets (id, name, public) VALUES ('data-backups', 'data-backups', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins manage backup files"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'data-backups' AND has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'data-backups' AND has_role(auth.uid(), 'admin'));
