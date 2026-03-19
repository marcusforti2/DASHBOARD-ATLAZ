import { useEffect, useMemo, useState } from 'react';

import { useWaConversations, useWaMessages } from '@/hooks/use-wa-hub';
import type { WaConversation, WaInstance } from '@/hooks/use-wa-hub';
import { useWaTags, useWaContactTags } from '@/hooks/use-wa-tags';
import { useWaInstanceManager } from '@/hooks/use-wa-instance-manager';
import { supabase } from '@/integrations/supabase/client';
import {
  Shield,
  Eye,
  Users,
  MessageSquare,
  Wifi,
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  UserPlus,
  Link2,
  Copy,
  Tag,
  Bot,
  ExternalLink,
  Brain,
  RefreshCw,
  Loader2,
  Filter,
  Phone,
} from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { sendMedia, sendAudio, sendSticker } from '@/lib/evolutionApi';
import { WaConversationList } from '@/components/wa-hub/WaConversationList';
import WaChatView from '@/components/wa-hub/WaChatView';
import { WaDashboard } from '@/components/wa-hub/WaDashboard';
import { WaInstancePanel } from '@/components/wa-hub/WaInstancePanel';
import { WaCrmView } from '@/components/wa-hub/WaCrmView';
import { WaLeadProfilePanel } from '@/components/wa-hub/WaLeadProfilePanel';
import { AiSdrConfigPanel } from '@/components/wa-hub/AiSdrConfigPanel';
import { AiSdrSummaryCard } from '@/components/wa-hub/AiSdrSummaryCard';
import { PipedriveTab } from '@/components/wa-hub/PipedriveTab';
import { AiPromptsTab } from '@/components/wa-hub/AiPromptsTab';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';

export default function WaHubPage() {
  return (
    <WaHubPageInner />
  );
}

type ConnectionFilter = 'all' | 'connected' | 'disconnected';

function WaHubPageInner() {
  const [tab, setTab] = useState<'chat' | 'dashboard' | 'instances' | 'crm' | 'ai-sdr' | 'pipedrive' | 'ai-prompts'>('chat');
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [selectedCloserId, setSelectedCloserId] = useState<string>('all');
  const [selectedSdrId, setSelectedSdrId] = useState<string>('all');
  const [connectionFilter, setConnectionFilter] = useState<ConnectionFilter>('all');
  const { conversations: allConversations, loading, refetch: refetchConversations } = useWaConversations();
  const { tags, createTag, deleteTag } = useWaTags();
  const { getTagsForContact, addTag, removeTag } = useWaContactTags();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const { messages: selectedMessages, loading: messagesLoading, addOptimistic } = useWaMessages(selectedId);

  const mgr = useWaInstanceManager();
  const { instances, teamMembers, refetchInstances } = mgr;

  const scopeBaseInstances = useMemo(() => {
    return instances.filter((inst) => {
      if (selectedCloserId !== 'all' && inst.closer_id !== selectedCloserId) return false;
      if (selectedSdrId !== 'all' && (inst.sdr_id || null) !== selectedSdrId) return false;
      if (connectionFilter === 'connected' && !inst.is_connected) return false;
      if (connectionFilter === 'disconnected' && inst.is_connected) return false;
      return true;
    });
  }, [instances, selectedCloserId, selectedSdrId, connectionFilter]);

  useEffect(() => {
    if (!selectedInstanceId) return;
    if (!scopeBaseInstances.some((inst) => inst.id === selectedInstanceId)) {
      setSelectedInstanceId(null);
    }
  }, [selectedInstanceId, scopeBaseInstances]);

  const visibleInstances = useMemo(() => {
    return selectedInstanceId
      ? scopeBaseInstances.filter((inst) => inst.id === selectedInstanceId)
      : scopeBaseInstances;
  }, [scopeBaseInstances, selectedInstanceId]);

  const visibleInstanceIds = useMemo(() => new Set(visibleInstances.map((inst) => inst.id)), [visibleInstances]);

  const conversations = useMemo(() => {
    return allConversations.filter((conv) => visibleInstanceIds.has(conv.instance_id));
  }, [allConversations, visibleInstanceIds]);

  useEffect(() => {
    if (!selectedId) return;
    if (!conversations.some((conv) => conv.id === selectedId)) {
      setSelectedId(null);
      setShowProfile(false);
    }
  }, [selectedId, conversations]);

  const selectedConv = conversations.find((c) => c.id === selectedId) || null;
  const totalConvs = conversations.length;
  const activeCount = conversations.filter((c) => c.status === 'active').length;
  const connectedCount = visibleInstances.filter((i) => i.is_connected).length;

  const getSelectedInstance = () => {
    if (!selectedConv) return null;
    return visibleInstances.find((i) => i.id === selectedConv.instance_id) || null;
  };

  const clearScopeFilters = () => {
    setSelectedInstanceId(null);
    setSelectedCloserId('all');
    setSelectedSdrId('all');
    setConnectionFilter('all');
  };

  const handleSend = async (text: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) {
      toast.error('Instância não encontrada');
      return;
    }
    try {
      const { error } = await supabase.functions.invoke('evolution-api', {
        body: { action: 'sendText', instanceName: inst.instance_name, data: { number: selectedConv.contact.phone, text } },
      });
      if (error) throw error;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar');
      throw err;
    }
  };

  const handleSendMedia = async (mediaType: string, mediaUrl: string, caption?: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) {
      toast.error('Instância não encontrada');
      return;
    }
    try {
      await sendMedia(inst.instance_name, selectedConv.contact.phone, mediaType as any, mediaUrl, caption);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar mídia');
      throw err;
    }
  };

  const handleSendAudio = async (audioUrl: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) {
      toast.error('Instância não encontrada');
      return;
    }
    try {
      await sendAudio(inst.instance_name, selectedConv.contact.phone, audioUrl);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar áudio');
      throw err;
    }
  };

  const handleSendSticker = async (imageUrl: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) {
      toast.error('Instância não encontrada');
      return;
    }
    try {
      await sendSticker(inst.instance_name, selectedConv.contact.phone, imageUrl);
      toast.success('Figurinha enviada!');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar figurinha');
      throw err;
    }
  };

  const isChatTab = tab === 'chat';

  return (
    <div className={isChatTab ? "flex flex-col h-[calc(100vh-3rem)]" : "space-y-4"}>
      <div className={`flex items-center gap-4 flex-wrap ${isChatTab ? 'px-4 py-2 shrink-0' : ''}`}
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <span className="text-lg font-bold text-foreground">WhatsApp Hub</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">Visão Total</span>
        </div>
        <div className="ml-auto flex items-center gap-4 flex-wrap">
          <HubScopeFilters
            instances={instances}
            teamMembers={teamMembers}
            selectedInstanceId={selectedInstanceId}
            selectedCloserId={selectedCloserId}
            selectedSdrId={selectedSdrId}
            connectionFilter={connectionFilter}
            scopedInstances={scopeBaseInstances}
            onInstanceChange={setSelectedInstanceId}
            onCloserChange={setSelectedCloserId}
            onSdrChange={setSelectedSdrId}
            onConnectionChange={setConnectionFilter}
            onClear={clearScopeFilters}
          />
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">{totalConvs} conversas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{visibleInstances.length} instâncias</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Wifi className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-xs text-muted-foreground">{connectedCount} conectadas</span>
          </div>
        </div>
      </div>


      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className={isChatTab ? 'flex-1 flex flex-col min-h-0' : ''}>
        <TabsList className={isChatTab ? 'mx-4 shrink-0' : ''}>
          <TabsTrigger value="chat" className="text-xs gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Conversas
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="text-xs gap-1.5">
            <Eye className="w-3.5 h-3.5" /> Dashboard
          </TabsTrigger>
          <TabsTrigger value="crm" className="text-xs gap-1.5">
            <Tag className="w-3.5 h-3.5" /> CRM
            {totalConvs > 0 && <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">{totalConvs}</span>}
          </TabsTrigger>
          <TabsTrigger value="ai-sdr" className="text-xs gap-1.5">
            <Bot className="w-3.5 h-3.5" /> SDR IA
          </TabsTrigger>
          <TabsTrigger value="ai-prompts" className="text-xs gap-1.5">
            <Brain className="w-3.5 h-3.5" /> Prompts IA
          </TabsTrigger>
          <TabsTrigger value="pipedrive" className="text-xs gap-1.5">
            <ExternalLink className="w-3.5 h-3.5" /> Pipedrive
          </TabsTrigger>
          <TabsTrigger value="instances" className="text-xs gap-1.5">
            <Wifi className="w-3.5 h-3.5" /> Instâncias
            {connectedCount > 0 && (
              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">
                {connectedCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <div className="flex rounded-xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 280px)' }}>
            <WaConversationList
              conversations={conversations}
              instances={visibleInstances}
              loading={loading}
              selectedId={selectedId}
              onSelect={(id) => setSelectedId(id)}
              instanceFilter={selectedInstanceId}
              onInstanceFilter={setSelectedInstanceId}
              tags={tags}
              getTagsForContact={(cid) => getTagsForContact(cid)}
              onAddTag={addTag}
              onRemoveTag={removeTag}
            />
            {selectedConv ? (
              <>
                <WaChatView
                  conversation={selectedConv}
                  messages={selectedMessages}
                  messagesLoading={messagesLoading}
                  onBack={() => setSelectedId(null)}
                  onSend={async (text) => {
                    addOptimistic({ text });
                    await handleSend(text);
                  }}
                  onSendMedia={handleSendMedia}
                  onSendAudio={handleSendAudio}
                  onSendSticker={handleSendSticker}
                  tags={tags}
                  assignedTagIds={getTagsForContact(selectedConv.contact.id).map((t) => t.tag_id)}
                  onAddTag={addTag}
                  onRemoveTag={removeTag}
                  onToggleProfile={() => setShowProfile(!showProfile)}
                  showProfileButton
                />
                {showProfile && (
                  <WaLeadProfilePanel
                    conversation={selectedConv}
                    messages={selectedMessages}
                    tags={tags}
                    assignedTagIds={getTagsForContact(selectedConv.contact.id).map((t) => t.tag_id)}
                    onAddTag={addTag}
                    onRemoveTag={removeTag}
                    teamMembers={teamMembers}
                    onClose={() => setShowProfile(false)}
                    onTransfer={async (toMemberId, toRole, note) => {
                      const { data: profile } = await supabase
                        .from('profiles')
                        .select('team_member_id')
                        .eq('id', (await supabase.auth.getUser()).data.user?.id || '')
                        .single();
                      await supabase.from('wa_transfer_logs').insert({
                        conversation_id: selectedConv.id,
                        from_member_id: profile?.team_member_id || null,
                        to_member_id: toMemberId,
                        from_role: selectedConv.assigned_role || 'sdr',
                        to_role: toRole,
                        note,
                      } as any);
                      await supabase
                        .from('wa_conversations')
                        .update({ assigned_to: toMemberId, assigned_role: toRole } as any)
                        .eq('id', selectedConv.id);
                      toast.success('Conversa transferida!');
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <Shield className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
                  <p className="text-[10px] text-muted-foreground mt-1">As mensagens do WhatsApp aparecem em tempo real dentro do recorte escolhido</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <WaDashboard />
        </TabsContent>

        <TabsContent value="crm" className="mt-4">
          <WaCrmView
            conversations={conversations}
            tags={tags}
            instances={visibleInstances}
            teamMembers={teamMembers}
            getTagsForContact={(contactId) => getTagsForContact(contactId)}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onCreateTag={createTag}
            onDeleteTag={deleteTag}
            onRefresh={refetchConversations}
          />
        </TabsContent>

        <TabsContent value="ai-sdr" className="mt-4">
          <AiSdrSummaryCard
            instances={visibleInstances as any}
            teamMembers={teamMembers}
            onNavigate={() => {
              window.dispatchEvent(new CustomEvent('navigate-admin', { detail: 'ai-sdr' }));
            }}
          />
        </TabsContent>

        <TabsContent value="ai-prompts" className="mt-4">
          <AiPromptsTab />
        </TabsContent>

        <TabsContent value="pipedrive" className="mt-4">
          <PipedriveTab />
        </TabsContent>

        <TabsContent value="instances" className="mt-4">
          <InstancesTab mgr={mgr} conversations={allConversations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function HubScopeFilters({
  instances,
  teamMembers,
  selectedInstanceId,
  selectedCloserId,
  selectedSdrId,
  connectionFilter,
  scopedInstances,
  onInstanceChange,
  onCloserChange,
  onSdrChange,
  onConnectionChange,
  onClear,
}: {
  instances: WaInstance[];
  teamMembers: { id: string; name: string; member_role: string }[];
  selectedInstanceId: string | null;
  selectedCloserId: string;
  selectedSdrId: string;
  connectionFilter: ConnectionFilter;
  scopedInstances: WaInstance[];
  onInstanceChange: (value: string | null) => void;
  onCloserChange: (value: string) => void;
  onSdrChange: (value: string) => void;
  onConnectionChange: (value: ConnectionFilter) => void;
  onClear: () => void;
}) {
  const closerOptions = teamMembers.filter((m) => m.member_role.includes('closer'));
  const sdrOptions = teamMembers.filter((m) => m.member_role.includes('sdr'));
  const hasActiveFilters = !!selectedInstanceId || selectedCloserId !== 'all' || selectedSdrId !== 'all' || connectionFilter !== 'all';
  const instanceOptions = selectedCloserId !== 'all' || selectedSdrId !== 'all' || connectionFilter !== 'all' ? scopedInstances : instances;

  const activeCount = [
    selectedCloserId !== 'all',
    selectedSdrId !== 'all',
    connectionFilter !== 'all',
    !!selectedInstanceId,
  ].filter(Boolean).length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs">
          <Filter className="w-3.5 h-3.5" />
          Escopo operacional
          {activeCount > 0 && (
            <Badge variant="default" className="ml-1 h-4 min-w-4 px-1 text-[9px]">
              {activeCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Escopo operacional</h3>
        </div>
        <p className="text-[10px] text-muted-foreground mb-3">
          Tudo que aparece em Conversas e CRM respeita esse filtro
        </p>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Closer</label>
            <Select value={selectedCloserId} onValueChange={onCloserChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos os closers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os closers</SelectItem>
                {closerOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">SDR</label>
            <Select value={selectedSdrId} onValueChange={onSdrChange}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos os SDRs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {sdrOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Status da instância</label>
            <Select value={connectionFilter} onValueChange={(value) => onConnectionChange(value as ConnectionFilter)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="connected">Conectadas</SelectItem>
                <SelectItem value="disconnected">Desconectadas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Instância</label>
            <Select value={selectedInstanceId ?? 'all'} onValueChange={(value) => onInstanceChange(value === 'all' ? null : value)}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas as instâncias" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instâncias</SelectItem>
                {instanceOptions.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.instance_name.replace(/^wpp_/i, '')}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" className="w-full gap-2 text-xs" onClick={onClear} disabled={!hasActiveFilters}>
            <X className="w-3.5 h-3.5" /> Limpar recorte
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function InstancesTab({
  mgr,
  conversations,
}: {
  mgr: ReturnType<typeof useWaInstanceManager>;
  conversations: WaConversation[];
}) {
  const {
    instances,
    teamMembers,
    refetchInstances,
    showCreate,
    setShowCreate,
    newName,
    setNewName,
    newPhone,
    setNewPhone,
    newCloserId,
    setNewCloserId,
    newSdrId,
    setNewSdrId,
    creating,
    handleCreateInstance,
    editingId,
    editPhone,
    setEditPhone,
    editCloserId,
    setEditCloserId,
    editSdrId,
    setEditSdrId,
    saving,
    startEdit,
    cancelEdit,
    handleSaveEdit,
    handleSetWebhook,
    handleReconfigureAllWebhooks,
    handleReconnectAll,
    handleCopyWebhookUrl,
    handleDelete,
  } = mgr;

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ConnectionFilter>('all');
  const [closerFilter, setCloserFilter] = useState<string>('all');
  const [sdrFilter, setSdrFilter] = useState<string>('all');

  const countsByInstance = useMemo(() => {
    const map = new Map<string, { total: number; active: number }>();
    for (const conv of conversations) {
      const current = map.get(conv.instance_id) || { total: 0, active: 0 };
      current.total += 1;
      if (conv.status === 'active') current.active += 1;
      map.set(conv.instance_id, current);
    }
    return map;
  }, [conversations]);

  const filteredInstances = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return [...instances]
      .filter((inst) => {
        if (normalizedSearch) {
          const haystack = `${inst.instance_name} ${inst.phone || ''}`.toLowerCase();
          if (!haystack.includes(normalizedSearch)) return false;
        }
        if (statusFilter === 'connected' && !inst.is_connected) return false;
        if (statusFilter === 'disconnected' && inst.is_connected) return false;
        if (closerFilter !== 'all' && inst.closer_id !== closerFilter) return false;
        if (sdrFilter !== 'all' && (inst.sdr_id || null) !== sdrFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.is_connected !== b.is_connected) return a.is_connected ? -1 : 1;
        return a.instance_name.localeCompare(b.instance_name, 'pt-BR');
      });
  }, [instances, search, statusFilter, closerFilter, sdrFilter]);

  const closerOptions = teamMembers.filter((m) => m.member_role.includes('closer'));
  const sdrOptions = teamMembers.filter((m) => m.member_role.includes('sdr'));

  const handleSyncAssignments = async (inst: WaInstance) => {
    const assignedTo = inst.closer_id || inst.sdr_id;
    const assignedRole = inst.closer_id ? 'closer' : inst.sdr_id ? 'sdr' : null;
    if (!assignedTo || !assignedRole) {
      toast.error('Defina um SDR ou closer antes de sincronizar as conversas dessa instância');
      return;
    }

    const total = countsByInstance.get(inst.id)?.total || 0;
    const { error } = await supabase
      .from('wa_conversations')
      .update({ assigned_to: assignedTo, assigned_role: assignedRole } as any)
      .eq('instance_id', inst.id);

    if (error) {
      toast.error('Erro ao sincronizar responsáveis da instância');
      return;
    }

    toast.success(`${total} conversa(s) sincronizadas com o responsável da instância`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {!showCreate && (
          <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-2">
            <Plus className="w-4 h-4" /> Nova Instância
          </Button>
        )}
        <Button onClick={handleReconnectAll} variant="default" className="gap-2 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Reconectar Todas
        </Button>
        <Button onClick={handleReconfigureAllWebhooks} variant="secondary" className="gap-2 text-xs">
          <Link2 className="w-3.5 h-3.5" /> Reconfigurar Webhooks
        </Button>
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Buscar instância</label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nome ou telefone"
              className="h-9 text-sm"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Status</label>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as ConnectionFilter)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="connected">Conectadas</SelectItem>
                <SelectItem value="disconnected">Desconectadas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">Closer</label>
            <Select value={closerFilter} onValueChange={setCloserFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os closers</SelectItem>
                {closerOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">SDR</label>
            <Select value={sdrFilter} onValueChange={setSdrFilter}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os SDRs</SelectItem>
                {sdrOptions.map((member) => (
                  <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Criar Nova Instância</h3>
            <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome da Instância *</label>
              <Input placeholder="Ex: closer_joao" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
              <Input placeholder="5511999999999" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SDR responsável</label>
              <Select value={newSdrId} onValueChange={setNewSdrId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {sdrOptions.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Closer responsável</label>
              <Select value={newCloserId} onValueChange={setNewCloserId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {closerOptions.map((member) => (
                    <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
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

      {filteredInstances.length === 0 && !showCreate ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center">
          <Wifi className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma instância encontrada nesse filtro</p>
          <p className="text-[10px] text-muted-foreground mt-1">Ajuste os filtros ou crie uma nova instância</p>
        </div>
      ) : (
        filteredInstances.map((inst) => {
          const displayName = inst.instance_name.replace(/^wpp_/i, '').replace(/_/g, ' ').replace(/^\w/, (c: string) => c.toUpperCase());
          const assignedCloser = teamMembers.find((m) => m.id === inst.closer_id);
          const assignedSdr = teamMembers.find((m) => m.id === (inst as any).sdr_id);
          const isEditing = editingId === inst.id;
          const counts = countsByInstance.get(inst.id) || { total: 0, active: 0 };

          return (
            <div key={inst.id} className="rounded-xl bg-card border border-border p-4 space-y-4">
              <div className="flex items-start gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Wifi className={`w-4 h-4 ${inst.is_connected ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground">{displayName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${inst.is_connected ? 'bg-emerald-500/10 text-emerald-600' : 'bg-muted text-muted-foreground'}`}>
                        {inst.is_connected ? 'Conectada' : 'Desconectada'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{inst.instance_name}</p>
                  </div>
                </div>

                <div className="ml-auto flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <Button size="sm" variant="ghost" onClick={cancelEdit} className="h-7 w-7 p-0"><X className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleSaveEdit(inst.id)} disabled={saving} className="h-7 w-7 p-0 text-primary">
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => handleSetWebhook(inst.instance_name)} title="Cadastrar Webhook" className="h-7 w-7 p-0"><Link2 className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleCopyWebhookUrl(inst.instance_name)} title="Copiar URL do Webhook" className="h-7 w-7 p-0"><Copy className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(inst)} className="h-7 w-7 p-0"><Pencil className="w-3.5 h-3.5" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(inst.id, inst.instance_name)} className="h-7 w-7 p-0 text-destructive hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <InfoTile icon={<Phone className="w-3.5 h-3.5" />} label="Telefone" value={inst.phone || 'Não informado'} />
                <InfoTile icon={<Users className="w-3.5 h-3.5" />} label="SDR responsável" value={assignedSdr?.name || 'Não vinculado'} />
                <InfoTile icon={<UserPlus className="w-3.5 h-3.5" />} label="Closer responsável" value={assignedCloser?.name || 'Não vinculado'} />
                <InfoTile icon={<MessageSquare className="w-3.5 h-3.5" />} label="Conversas" value={`${counts.total} total, ${counts.active} ativas`} />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-2" onClick={() => handleSyncAssignments(inst)}>
                  <Users className="w-3.5 h-3.5" /> Sincronizar responsáveis nas conversas
                </Button>
                <span className="text-[11px] text-muted-foreground">
                  Usa o closer da instância. Se não houver, usa o SDR.
                </span>
              </div>

              {isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
                    <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="5511999999999" className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">SDR responsável</label>
                    <Select value={editSdrId} onValueChange={setEditSdrId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {sdrOptions.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Closer responsável</label>
                    <Select value={editCloserId} onValueChange={setEditCloserId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {closerOptions.map((member) => (
                          <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <AiSdrConfigPanel
                instanceId={inst.id}
                instanceName={inst.instance_name}
                aiSdrEnabled={inst.ai_sdr_enabled || false}
                aiSdrConfig={inst.ai_sdr_config || {}}
                onUpdate={refetchInstances}
              />
              <WaInstancePanel instanceName={inst.instance_name} closerName={displayName} instanceId={inst.id} />
            </div>
          );
        })
      )}
    </div>
  );
}

function InfoTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
        {icon}
        <span>{label}</span>
      </div>
      <p className="text-sm font-medium text-foreground truncate">{value}</p>
    </div>
  );
}
