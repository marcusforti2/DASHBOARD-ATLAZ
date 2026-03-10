import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { createInstance, setWebhook, getWebhookUrl, restartInstance } from '@/lib/evolutionApi';
import { useWaInstances } from '@/hooks/use-wa-hub';

export function useWaInstanceManager() {
  const { instances, loading, refetch: refetchInstances } = useWaInstances();
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; member_role: string }[]>([]);

  // Create form state
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCloserId, setNewCloserId] = useState('none');
  const [newSdrId, setNewSdrId] = useState('none');
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPhone, setEditPhone] = useState('');
  const [editCloserId, setEditCloserId] = useState('none');
  const [editSdrId, setEditSdrId] = useState('none');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from('team_members').select('id, name, member_role').eq('active', true).then(({ data }) => {
      setTeamMembers(data ?? []);
    });
  }, []);

  // Auto-sync connection status on load
  const hasSynced = useRef(false);
  useEffect(() => {
    if (instances.length === 0 || hasSynced.current) return;
    hasSynced.current = true;
    const syncStatuses = async () => {
      let changed = false;
      for (const inst of instances) {
        try {
          const { getInstanceStatus } = await import('@/lib/evolutionApi');
          const data = await getInstanceStatus(inst.instance_name);
          const isConn = data?.state === 'open';
          if (inst.is_connected !== isConn) {
            await supabase.from('wa_instances').update({ is_connected: isConn } as any).eq('id', inst.id);
            changed = true;
          }
        } catch {
          if (inst.is_connected) {
            await supabase.from('wa_instances').update({ is_connected: false } as any).eq('id', inst.id);
            changed = true;
          }
        }
      }
      if (changed) refetchInstances();
    };
    syncStatuses();
  }, [instances.length]);

  const handleCreateInstance = useCallback(async () => {
    const name = newName.trim();
    if (!name) { toast.error('Nome da instância obrigatório'); return; }
    const instanceName = name.startsWith('wpp_') ? name : `wpp_${name.toLowerCase().replace(/\s+/g, '_')}`;
    try {
      setCreating(true);
      const { data: existing } = await supabase.from('wa_instances').select('id').eq('instance_name', instanceName).maybeSingle();
      if (existing) { toast.error(`A instância "${instanceName}" já existe no sistema.`); return; }
      try { await createInstance(instanceName); } catch { /* may already exist */ }
      try { await setWebhook(instanceName); } catch { /* continue */ }
      const { error } = await supabase.from('wa_instances').insert({
        instance_name: instanceName, phone: newPhone.trim() || null,
        closer_id: newCloserId !== 'none' ? newCloserId : null,
        sdr_id: newSdrId !== 'none' ? newSdrId : null, is_connected: false,
      } as any);
      if (error) throw error;
      toast.success(`Instância "${instanceName}" criada com webhook!`);
      setNewName(''); setNewPhone(''); setNewCloserId('none'); setNewSdrId('none'); setShowCreate(false);
      refetchInstances();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar instância');
    } finally { setCreating(false); }
  }, [newName, newPhone, newCloserId, newSdrId, refetchInstances]);

  const handleSetWebhook = useCallback(async (instanceName: string) => {
    try { await setWebhook(instanceName); toast.success(`Webhook cadastrado para "${instanceName}"`); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro ao cadastrar webhook'); }
  }, []);

  const handleReconfigureAllWebhooks = useCallback(async () => {
    let ok = 0, fail = 0;
    toast.info('Reconfigurando webhooks de todas as instâncias...');
    for (const inst of instances) {
      try { await setWebhook(inst.instance_name); ok++; } catch { fail++; }
    }
    toast.success(`Webhooks reconfigurados: ${ok} OK, ${fail} falhas`);
  }, [instances]);

  const handleReconnectAll = useCallback(async () => {
    toast.info('Reconectando todas as instâncias...');
    let ok = 0, fail = 0;
    for (const inst of instances) {
      try { await restartInstance(inst.instance_name); ok++; } catch { fail++; }
    }
    await refetchInstances();
    toast.success(`Reconexão: ${ok} reiniciadas, ${fail} falhas`);
  }, [instances, refetchInstances]);

  const handleCopyWebhookUrl = useCallback((instanceName: string) => {
    const url = getWebhookUrl(instanceName);
    navigator.clipboard.writeText(url);
    toast.success('URL do webhook copiada!');
  }, []);

  const handleDelete = useCallback(async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir a instância "${name}"?`)) return;
    const { error } = await supabase.from('wa_instances').delete().eq('id', id);
    if (error) { toast.error('Erro ao excluir'); return; }
    toast.success(`Instância "${name}" excluída`);
    refetchInstances();
  }, [refetchInstances]);

  const startEdit = useCallback((inst: any) => {
    setEditingId(inst.id);
    setEditPhone(inst.phone || '');
    setEditCloserId(inst.closer_id || 'none');
    setEditSdrId(inst.sdr_id || 'none');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null); setEditPhone(''); setEditCloserId('none'); setEditSdrId('none');
  }, []);

  const handleSaveEdit = useCallback(async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('wa_instances').update({
      phone: editPhone.trim() || null,
      closer_id: editCloserId !== 'none' ? editCloserId : null,
      sdr_id: editSdrId !== 'none' ? editSdrId : null,
    } as any).eq('id', id);
    setSaving(false);
    if (error) { toast.error('Erro ao salvar'); return; }
    toast.success('Instância atualizada');
    cancelEdit();
    refetchInstances();
  }, [editPhone, editCloserId, editSdrId, cancelEdit, refetchInstances]);

  return {
    instances, loading, teamMembers, refetchInstances,
    // Create
    showCreate, setShowCreate, newName, setNewName, newPhone, setNewPhone,
    newCloserId, setNewCloserId, newSdrId, setNewSdrId, creating, handleCreateInstance,
    // Edit
    editingId, editPhone, setEditPhone, editCloserId, setEditCloserId,
    editSdrId, setEditSdrId, saving, startEdit, cancelEdit, handleSaveEdit,
    // Actions
    handleSetWebhook, handleReconfigureAllWebhooks, handleReconnectAll,
    handleCopyWebhookUrl, handleDelete,
  };
}
