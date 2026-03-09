import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WaInstance {
  id: string;
  instance_name: string;
  closer_id: string | null;
  sdr_id: string | null;
  phone: string | null;
  is_connected: boolean;
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

      const enriched = await Promise.all(
        convs.map(async (conv: any) => {
          const { data: msgs } = await supabase
            .from('wa_messages')
            .select('*')
            .eq('conversation_id', conv.id)
            .order('created_at', { ascending: true });
          return { ...conv, messages: (msgs ?? []) as WaMessage[] } as WaConversation;
        })
      );
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_messages' }, () => fetchConversations())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_conversations' }, () => fetchConversations())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchConversations]);

  return { conversations, loading, refetch: fetchConversations };
}

export function useWaDashboardStats() {
  const [stats, setStats] = useState({ active: 0, waiting: 0, closed: 0, instances: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: convs } = await supabase.from('wa_conversations').select('status');
      const { data: insts } = await supabase.from('wa_instances').select('id, is_connected');
      const all = convs ?? [];
      setStats({
        active: all.filter((c: any) => c.status === 'active').length,
        waiting: all.filter((c: any) => c.status === 'waiting').length,
        closed: all.filter((c: any) => c.status === 'closed').length,
        instances: (insts ?? []).filter((i: any) => i.is_connected).length,
      });
      setLoading(false);
    };
    fetch();
  }, []);

  return { stats, loading };
}
