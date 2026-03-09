
-- 1) Instances table (WhatsApp connections via Evolution API)
CREATE TABLE public.wa_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_name TEXT NOT NULL UNIQUE,
  closer_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  phone TEXT,
  is_connected BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_instances" ON public.wa_instances
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_instances" ON public.wa_instances
  FOR SELECT TO authenticated
  USING (true);

-- 2) Contacts table
CREATE TABLE public.wa_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(instance_id, phone)
);

ALTER TABLE public.wa_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_contacts" ON public.wa_contacts
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_contacts" ON public.wa_contacts
  FOR SELECT TO authenticated
  USING (true);

-- 3) Conversations table
CREATE TABLE public.wa_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id UUID NOT NULL REFERENCES public.wa_contacts(id) ON DELETE CASCADE,
  instance_id UUID NOT NULL REFERENCES public.wa_instances(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  assigned_role TEXT DEFAULT 'closer',
  status TEXT NOT NULL DEFAULT 'active',
  lead_status TEXT NOT NULL DEFAULT 'novo',
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_conversations" ON public.wa_conversations
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_conversations" ON public.wa_conversations
  FOR SELECT TO authenticated
  USING (true);

-- 4) Messages table
CREATE TABLE public.wa_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.wa_conversations(id) ON DELETE CASCADE,
  instance_id UUID REFERENCES public.wa_instances(id) ON DELETE SET NULL,
  sender TEXT NOT NULL DEFAULT 'contact',
  agent_name TEXT,
  agent_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  text TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.wa_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage wa_messages" ON public.wa_messages
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read wa_messages" ON public.wa_messages
  FOR SELECT TO authenticated
  USING (true);

-- Enable realtime for conversations and messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.wa_instances;

-- Indexes for performance
CREATE INDEX idx_wa_conversations_instance ON public.wa_conversations(instance_id);
CREATE INDEX idx_wa_conversations_contact ON public.wa_conversations(contact_id);
CREATE INDEX idx_wa_messages_conversation ON public.wa_messages(conversation_id);
CREATE INDEX idx_wa_contacts_instance_phone ON public.wa_contacts(instance_id, phone);
