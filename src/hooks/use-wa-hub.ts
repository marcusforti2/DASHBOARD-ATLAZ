import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WaInstance {
  id: string;
  instance_name: string;
  closer_id: string | null;
  sdr_id: string | null;
  phone: string | null;
  is_connected: boolean;
  ai_sdr_enabled?: boolean;
  ai_sdr_config?: any;
}

export interface WaContact {
  id: string;
  phone: string;
  name: string;
  avatar_url: string | null;
  instance_id: string;
}

export interface WaMessage {
  id: string;
  conversation_id: string;
  sender: 'contact' | 'agent';
  agent_name: string | null;
  text: string;
  created_at: string;
  media_type: string | null;
  media_url: string | null;
  media_mime_type: string | null;
}

export interface WaConversation {
  id: string;
  contact_id: string;
  instance_id: string;
  assigned_to: string | null;
  assigned_role: string | null;
  status: string;
  lead_status: string;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  contact: WaContact;
  messages: WaMessage[];
}

export function useWaInstances() {
  const [instances, setInstances] = useState<WaInstance[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInstances = useCallback(async () => {
    const { data } = await supabase.from('wa_instances').select('*');
    setInstances((data ?? []) as WaInstance[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchInstances(); }, [fetchInstances]);

  useEffect(() => {
    const channel = supabase
      .channel('wa-instances-status')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_instances' }, () => fetchInstances())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchInstances]);

  return { instances, loading, refetch: fetchInstances };
}

/**
 * Optimized: loads conversations WITHOUT messages.
 * Messages are loaded separately per selected conversation.
 */
export function useWaConversations(instanceFilter?: string | null) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = useCallback(async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('wa_conversations')
        .select(`*, contact:wa_contacts!contact_id(*)`)
        .order('last_message_at', { ascending: false });

      if (instanceFilter) {
        query = query.eq('instance_id', instanceFilter);
      }

      const { data: convs } = await query;
      if (!convs) { setLoading(false); return; }

      // NO N+1: conversations loaded without messages
      const enriched = convs.map((conv: any) => ({
        ...conv,
        messages: [] as WaMessage[],
      })) as WaConversation[];

      setConversations(enriched);
    } catch (err) {
      console.error('Error fetching wa conversations:', err);
    } finally {
      setLoading(false);
    }
  }, [instanceFilter]);

  useEffect(() => { fetchConversations(); }, [fetchConversations]);

  useEffect(() => {
    const channel = supabase
      .channel('wa-all-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}

/**
 * Loads messages for a single conversation with realtime updates
 */
export function useWaMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<WaMessage[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) { setMessages([]); return; }
    setLoading(true);
    const { data } = await supabase
      .from('wa_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .neq('text', '__ai_processing__')
      .order('created_at', { ascending: true });
    setMessages((data ?? []) as WaMessage[]);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`wa-messages-${conversationId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'wa_messages',
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) => {
        setMessages(prev => [...prev, payload.new as WaMessage]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  /** Optimistic insert for sent messages */
  const addOptimistic = useCallback((msg: Partial<WaMessage>) => {
    const optimistic: WaMessage = {
      id: `optimistic-${Date.now()}`,
      conversation_id: conversationId || '',
      sender: 'agent',
      agent_name: null,
      text: msg.text || '',
      created_at: new Date().toISOString(),
      media_type: msg.media_type || null,
      media_url: msg.media_url || null,
      media_mime_type: msg.media_mime_type || null,
    };
    setMessages(prev => [...prev, optimistic]);
  }, [conversationId]);

  return { messages, loading, refetch: fetchMessages, addOptimistic };
}

export function useWaDashboardStats() {
  const [stats, setStats] = useState({
    active: 0, waiting: 0, closed: 0, instances: 0,
    totalMessages: 0, todayMessages: 0,
    avgResponseTime: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const today = new Date().toISOString().split('T')[0];
      const [
        { data: convs },
        { data: insts },
        { data: allMsgs },
        { data: todayMsgs },
      ] = await Promise.all([
        supabase.from('wa_conversations').select('status'),
        supabase.from('wa_instances').select('id, is_connected'),
        supabase.from('wa_messages').select('id', { count: 'exact', head: true }),
        supabase.from('wa_messages').select('id', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`),
      ]);

      const all = convs ?? [];
      setStats({
        active: all.filter((c: any) => c.status === 'active').length,
        waiting: all.filter((c: any) => c.status === 'waiting').length,
        closed: all.filter((c: any) => c.status === 'closed').length,
        instances: (insts ?? []).filter((i: any) => i.is_connected).length,
        totalMessages: (allMsgs as any)?.length ?? 0,
        todayMessages: (todayMsgs as any)?.length ?? 0,
        avgResponseTime: 0,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  return { stats, loading };
}

/** Quick reply templates */
export interface QuickReply {
  id: string;
  label: string;
  text: string;
  category: string;
}

const DEFAULT_QUICK_REPLIES: QuickReply[] = [
  { id: '1', label: '👋 Saudação', text: 'Olá! Tudo bem? Como posso te ajudar?', category: 'geral' },
  { id: '2', label: '📅 Agendar', text: 'Que tal agendarmos uma conversa? Qual o melhor horário pra você?', category: 'agendamento' },
  { id: '3', label: '⏳ Aguardar', text: 'Perfeito! Vou verificar aqui e já te retorno, ok?', category: 'geral' },
  { id: '4', label: '🔗 Link reunião', text: 'Segue o link para nossa reunião: ', category: 'agendamento' },
  { id: '5', label: '✅ Confirmar', text: 'Confirmado! Te espero no horário combinado. Qualquer coisa, me avisa!', category: 'agendamento' },
  { id: '6', label: '🙏 Agradecer', text: 'Muito obrigado pelo seu tempo! Foi um prazer falar com você.', category: 'geral' },
  { id: '7', label: '📞 Retornar', text: 'Vi que tentou falar comigo! Desculpa a demora, estou disponível agora.', category: 'follow-up' },
  { id: '8', label: '💬 Follow-up', text: 'Oi! Passando pra saber se teve a chance de avaliar nossa proposta. Ficou com alguma dúvida?', category: 'follow-up' },
];

export function useQuickReplies() {
  const [replies] = useState<QuickReply[]>(DEFAULT_QUICK_REPLIES);
  return { replies };
}
