import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WaTag {
  id: string;
  name: string;
  color: string;
  sort_order: number;
  is_stage: boolean;
}

export interface WaContactTag {
  id: string;
  contact_id: string;
  tag_id: string;
}

export function useWaTags() {
  const [tags, setTags] = useState<WaTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTags = useCallback(async () => {
    const { data } = await supabase
      .from('wa_tags')
      .select('*')
      .order('sort_order', { ascending: true });
    setTags((data ?? []) as WaTag[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTags(); }, [fetchTags]);

  const createTag = async (name: string, color: string, isStage = false) => {
    const maxOrder = tags.length > 0 ? Math.max(...tags.map(t => t.sort_order)) + 1 : 0;
    const { error } = await supabase.from('wa_tags').insert({
      name, color, sort_order: maxOrder, is_stage: isStage,
    });
    if (error) throw error;
    await fetchTags();
  };

  const deleteTag = async (id: string) => {
    const { error } = await supabase.from('wa_tags').delete().eq('id', id);
    if (error) throw error;
    await fetchTags();
  };

  const updateTag = async (id: string, updates: Partial<Pick<WaTag, 'name' | 'color' | 'sort_order' | 'is_stage'>>) => {
    const { error } = await supabase.from('wa_tags').update(updates).eq('id', id);
    if (error) throw error;
    await fetchTags();
  };

  return { tags, loading, createTag, deleteTag, updateTag, refetch: fetchTags };
}

export function useWaContactTags() {
  const [contactTags, setContactTags] = useState<WaContactTag[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContactTags = useCallback(async () => {
    const { data } = await supabase.from('wa_contact_tags').select('*');
    setContactTags((data ?? []) as WaContactTag[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContactTags(); }, [fetchContactTags]);

  useEffect(() => {
    const channel = supabase
      .channel('wa-contact-tags-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_contact_tags' }, () => fetchContactTags())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchContactTags]);

  const addTag = async (contactId: string, tagId: string) => {
    const { error } = await supabase.from('wa_contact_tags').insert({ contact_id: contactId, tag_id: tagId });
    if (error && !error.message.includes('duplicate')) throw error;
    await fetchContactTags();
  };

  const removeTag = async (contactId: string, tagId: string) => {
    const { error } = await supabase.from('wa_contact_tags')
      .delete()
      .eq('contact_id', contactId)
      .eq('tag_id', tagId);
    if (error) throw error;
    await fetchContactTags();
  };

  const getTagsForContact = (contactId: string) =>
    contactTags.filter(ct => ct.contact_id === contactId);

  return { contactTags, loading, addTag, removeTag, getTagsForContact, refetch: fetchContactTags };
}
