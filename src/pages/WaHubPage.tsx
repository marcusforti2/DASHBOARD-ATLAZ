import { useState } from 'react';
import { useWaConversations, useWaInstances } from '@/hooks/use-wa-hub';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Eye, Users, Loader2, MessageSquare, Wifi, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createInstance } from '@/lib/evolutionApi';
import { WaConversationList } from '@/components/wa-hub/WaConversationList';
import { WaChatView } from '@/components/wa-hub/WaChatView';
import { WaDashboard } from '@/components/wa-hub/WaDashboard';
import { WaInstancePanel } from '@/components/wa-hub/WaInstancePanel';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function WaHubPage() {
  const [tab, setTab] = useState<'chat' | 'dashboard' | 'instances'>('chat');
  const [instanceFilter, setInstanceFilter] = useState<string | null>(null);
  const { conversations, loading } = useWaConversations(instanceFilter);
  const { instances, refetch: refetchInstances } = useWaInstances();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // Create instance form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newCloserId, setNewCloserId] = useState<string>('none');
  const [creating, setCreating] = useState(false);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string }[]>([]);

  // Load team members for closer assignment
  useState(() => {
    supabase.from('team_members').select('id, name').eq('active', true).then(({ data }) => {
      setTeamMembers(data ?? []);
    });
  });

  const handleCreateInstance = async () => {
    const name = newName.trim();
    if (!name) { toast.error('Nome da instância obrigatório'); return; }
    const instanceName = name.startsWith('wpp_') ? name : `wpp_${name.toLowerCase().replace(/\s+/g, '_')}`;
    
    try {
      setCreating(true);
      
      // Try creating on Evolution API first (may fail if no API configured)
      try {
        await createInstance(instanceName);
      } catch {
        // Continue — just register locally
      }

      // Register in database
      const { error } = await supabase.from('wa_instances').insert({
        instance_name: instanceName,
        phone: newPhone.trim() || null,
        closer_id: newCloserId !== 'none' ? newCloserId : null,
        is_connected: false,
      });
      if (error) throw error;

      toast.success(`Instância "${instanceName}" criada!`);
      setNewName('');
      setNewPhone('');
      setNewCloserId('none');
      setShowCreate(false);
      refetchInstances();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar instância');
    } finally {
      setCreating(false);
    }
  };

  const selectedConv = conversations.find(c => c.id === selectedId);
  const totalConvs = conversations.length;
  const activeCount = conversations.filter(c => c.status === 'active').length;

  const handleSend = async (text: string) => {
    if (!selectedConv) return;
    const inst = instances.find(i => i.id === selectedConv.instance_id);
    if (!inst) { toast.error('Instância não encontrada'); return; }
    try {
      const { error } = await supabase.functions.invoke('evolution-api', {
        body: {
          action: 'sendText',
          instanceName: inst.instance_name,
          data: { number: selectedConv.contact.phone, text },
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
      throw err;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-lg font-bold text-foreground">WhatsApp Hub</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Visão Total</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">{totalConvs} conversas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-xs text-muted-foreground">{activeCount} ativas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{instances.length} instâncias</span>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="chat" className="text-xs gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Conversas
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="instances" className="text-xs gap-1.5">
            <Wifi className="w-3.5 h-3.5" /> Instâncias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <div className="flex rounded-xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
            <WaConversationList
              conversations={conversations}
              instances={instances}
              loading={loading}
              selectedId={selectedId}
              onSelect={setSelectedId}
              instanceFilter={instanceFilter}
              onInstanceFilter={setInstanceFilter}
            />

            {selectedConv ? (
              <WaChatView
                conversation={selectedConv}
                onBack={() => setSelectedId(null)}
                onSend={handleSend}
              />
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
                  <p className="text-[10px] text-muted-foreground mt-1">As mensagens do WhatsApp aparecem em tempo real</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <WaDashboard />
        </TabsContent>

        <TabsContent value="instances" className="mt-4">
          <div className="space-y-4">
            {/* Create instance button / form */}
            {!showCreate ? (
              <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
                <Plus className="w-4 h-4" /> Nova Instância
              </Button>
            ) : (
              <div className="rounded-xl bg-card border border-border p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">Criar Nova Instância</h3>
                  <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Nome da Instância *</label>
                    <Input
                      placeholder="Ex: closer_joao"
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Telefone (opcional)</label>
                    <Input
                      placeholder="5511999999999"
                      value={newPhone}
                      onChange={e => setNewPhone(e.target.value)}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Vincular ao Closer</label>
                    <Select value={newCloserId} onValueChange={setNewCloserId}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {teamMembers.map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button onClick={handleCreateInstance} disabled={creating} className="gap-2">
                  {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Criar Instância
                </Button>
              </div>
            )}

            {/* Instance list */}
            {instances.length === 0 && !showCreate ? (
              <div className="rounded-xl bg-card border border-border p-8 text-center">
                <Wifi className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma instância configurada</p>
                <p className="text-[10px] text-muted-foreground mt-1">Clique em "Nova Instância" para começar</p>
              </div>
            ) : (
              instances.map(inst => {
                const displayName = inst.instance_name
                  .replace(/^wpp_/i, '')
                  .replace(/^\w/, c => c.toUpperCase());
                const assignedMember = teamMembers.find(m => m.id === inst.closer_id);
                return (
                  <div key={inst.id} className="rounded-xl bg-card border border-border p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <Wifi className={`w-4 h-4 ${inst.is_connected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-semibold text-foreground">{displayName}</span>
                      {inst.phone && <span className="text-xs text-muted-foreground">· {inst.phone}</span>}
                      {assignedMember && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                          {assignedMember.name}
                        </span>
                      )}
                    </div>
                    <WaInstancePanel instanceName={inst.instance_name} closerName={displayName} />
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
