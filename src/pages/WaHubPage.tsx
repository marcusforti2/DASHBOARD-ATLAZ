import { useState } from 'react';
import { useWaConversations, useWaMessages } from '@/hooks/use-wa-hub';
import { useWaTags, useWaContactTags } from '@/hooks/use-wa-tags';
import { useWaInstanceManager } from '@/hooks/use-wa-instance-manager';
import { supabase } from '@/integrations/supabase/client';
import { Shield, Eye, Users, MessageSquare, Wifi, Plus, Trash2, Pencil, Check, X, UserPlus, Link2, Copy, Tag, Bot, ExternalLink, Brain, RefreshCw, Loader2 } from 'lucide-react';
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

export default function WaHubPage() {
  const [tab, setTab] = useState<'chat' | 'dashboard' | 'instances' | 'crm' | 'ai-sdr' | 'pipedrive' | 'ai-prompts'>('chat');
  const [instanceFilter, setInstanceFilter] = useState<string | null>(null);
  const { conversations, loading, refetch: refetchConversations } = useWaConversations(instanceFilter);
  const { tags, createTag, deleteTag } = useWaTags();
  const { getTagsForContact, addTag, removeTag } = useWaContactTags();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const { messages: selectedMessages, loading: messagesLoading, addOptimistic } = useWaMessages(selectedId);

  const mgr = useWaInstanceManager();
  const { instances, teamMembers, refetchInstances } = mgr;

  const selectedConv = conversations.find(c => c.id === selectedId);
  const totalConvs = conversations.length;
  const activeCount = conversations.filter(c => c.status === 'active').length;

  const getSelectedInstance = () => {
    if (!selectedConv) return null;
    return instances.find(i => i.id === selectedConv.instance_id) || null;
  };

  const handleSend = async (text: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    try {
      const { error } = await supabase.functions.invoke('evolution-api', {
        body: { action: 'sendText', instanceName: inst.instance_name, data: { number: selectedConv.contact.phone, text } },
      });
      if (error) throw error;
    } catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro ao enviar'); throw err; }
  };

  const handleSendMedia = async (mediaType: string, mediaUrl: string, caption?: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    try { await sendMedia(inst.instance_name, selectedConv.contact.phone, mediaType as any, mediaUrl, caption); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro ao enviar mídia'); throw err; }
  };

  const handleSendAudio = async (audioUrl: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    try { await sendAudio(inst.instance_name, selectedConv.contact.phone, audioUrl); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro ao enviar áudio'); throw err; }
  };

  const handleSendSticker = async (imageUrl: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    try { await sendSticker(inst.instance_name, selectedConv.contact.phone, imageUrl); toast.success('Figurinha enviada!'); }
    catch (err: unknown) { toast.error(err instanceof Error ? err.message : 'Erro ao enviar figurinha'); throw err; }
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
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
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
            {instances.filter(i => i.is_connected).length > 0 && (
              <span className="ml-1 text-[9px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-bold">
                {instances.filter(i => i.is_connected).length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <div className="flex rounded-xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 220px)' }}>
            <WaConversationList
              conversations={conversations} instances={instances} loading={loading}
              selectedId={selectedId} onSelect={(id) => setSelectedId(id)}
              instanceFilter={instanceFilter} onInstanceFilter={setInstanceFilter}
              tags={tags} getTagsForContact={(cid) => getTagsForContact(cid)}
              onAddTag={addTag} onRemoveTag={removeTag}
            />
            {selectedConv ? (
              <>
                <WaChatView
                  conversation={selectedConv} messages={selectedMessages} messagesLoading={messagesLoading}
                  onBack={() => setSelectedId(null)}
                  onSend={async (text) => { addOptimistic({ text }); await handleSend(text); }}
                  onSendMedia={handleSendMedia} onSendAudio={handleSendAudio} onSendSticker={handleSendSticker}
                  tags={tags} assignedTagIds={getTagsForContact(selectedConv.contact.id).map(t => t.tag_id)}
                  onAddTag={addTag} onRemoveTag={removeTag}
                  onToggleProfile={() => setShowProfile(!showProfile)} showProfileButton
                />
                {showProfile && (
                  <WaLeadProfilePanel
                    conversation={selectedConv} messages={selectedMessages}
                    tags={tags} assignedTagIds={getTagsForContact(selectedConv.contact.id).map(t => t.tag_id)}
                    onAddTag={addTag} onRemoveTag={removeTag} teamMembers={teamMembers}
                    onClose={() => setShowProfile(false)}
                    onTransfer={async (toMemberId, toRole, note) => {
                      const { data: profile } = await supabase.from('profiles').select('team_member_id').eq('id', (await supabase.auth.getUser()).data.user?.id || '').single();
                      await supabase.from('wa_transfer_logs').insert({
                        conversation_id: selectedConv.id, from_member_id: profile?.team_member_id || null,
                        to_member_id: toMemberId, from_role: selectedConv.assigned_role || 'sdr', to_role: toRole, note,
                      } as any);
                      await supabase.from('wa_conversations').update({ assigned_to: toMemberId, assigned_role: toRole } as any).eq('id', selectedConv.id);
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
                  <p className="text-[10px] text-muted-foreground mt-1">As mensagens do WhatsApp aparecem em tempo real</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="dashboard" className="mt-4">
          <WaDashboard />
        </TabsContent>

        <TabsContent value="crm" className="mt-4">
          <WaCrmView conversations={conversations} tags={tags}
            getTagsForContact={(contactId) => getTagsForContact(contactId)}
            onAddTag={addTag} onRemoveTag={removeTag} onCreateTag={createTag} onDeleteTag={deleteTag}
          />
        </TabsContent>

        <TabsContent value="ai-sdr" className="mt-4">
          <AiSdrSummaryCard instances={instances as any} teamMembers={teamMembers} onNavigate={() => {
            window.dispatchEvent(new CustomEvent('navigate-admin', { detail: 'ai-sdr' }));
          }} />
        </TabsContent>

        <TabsContent value="ai-prompts" className="mt-4">
          <AiPromptsTab />
        </TabsContent>

        <TabsContent value="pipedrive" className="mt-4">
          <PipedriveTab />
        </TabsContent>

        <TabsContent value="instances" className="mt-4">
          <InstancesTab mgr={mgr} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Instances Tab (extracted inline) ── */
function InstancesTab({ mgr }: { mgr: ReturnType<typeof useWaInstanceManager> }) {
  const {
    instances, teamMembers, refetchInstances,
    showCreate, setShowCreate, newName, setNewName, newPhone, setNewPhone,
    newCloserId, setNewCloserId, newSdrId, setNewSdrId, creating, handleCreateInstance,
    editingId, editPhone, setEditPhone, editCloserId, setEditCloserId,
    editSdrId, setEditSdrId, saving, startEdit, cancelEdit, handleSaveEdit,
    handleSetWebhook, handleReconfigureAllWebhooks, handleReconnectAll,
    handleCopyWebhookUrl, handleDelete,
  } = mgr;

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

      {showCreate && (
        <div className="rounded-xl bg-card border border-border p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Criar Nova Instância</h3>
            <button onClick={() => setShowCreate(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Nome da Instância *</label>
              <Input placeholder="Ex: closer_joao" value={newName} onChange={e => setNewName(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Telefone (opcional)</label>
              <Input placeholder="5511999999999" value={newPhone} onChange={e => setNewPhone(e.target.value)} className="h-9 text-sm" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">SDR responsável</label>
              <Select value={newSdrId} onValueChange={setNewSdrId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {teamMembers.filter(m => m.member_role.includes('sdr')).map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Closer responsável</label>
              <Select value={newCloserId} onValueChange={setNewCloserId}>
                <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {teamMembers.filter(m => m.member_role.includes('closer')).map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
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

      {instances.length === 0 && !showCreate ? (
        <div className="rounded-xl bg-card border border-border p-8 text-center">
          <Wifi className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma instância configurada</p>
          <p className="text-[10px] text-muted-foreground mt-1">Clique em "Nova Instância" para começar</p>
        </div>
      ) : (
        instances.map(inst => {
          const displayName = inst.instance_name.replace(/^wpp_/i, '').replace(/^\w/, (c: string) => c.toUpperCase());
          const assignedCloser = teamMembers.find(m => m.id === inst.closer_id);
          const assignedSdr = teamMembers.find(m => m.id === (inst as any).sdr_id);
          const isEditing = editingId === inst.id;

          return (
            <div key={inst.id} className="rounded-xl bg-card border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Wifi className={`w-4 h-4 ${inst.is_connected ? 'text-primary' : 'text-muted-foreground'}`} />
                <span className="text-sm font-semibold text-foreground">{displayName}</span>
                <span className="text-[10px] font-mono text-muted-foreground">({inst.instance_name})</span>
                {!isEditing && (
                  <>
                    {inst.phone && <span className="text-xs text-muted-foreground">· {inst.phone}</span>}
                    {assignedSdr ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent text-accent-foreground font-medium flex items-center gap-1">
                        <Users className="w-3 h-3" /> SDR: {assignedSdr.name}
                      </span>
                    ) : <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Sem SDR</span>}
                    {assignedCloser ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium flex items-center gap-1">
                        <UserPlus className="w-3 h-3" /> Closer: {assignedCloser.name}
                      </span>
                    ) : <span className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Sem Closer</span>}
                  </>
                )}
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
              {isEditing && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pl-6">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Telefone</label>
                    <Input value={editPhone} onChange={e => setEditPhone(e.target.value)} placeholder="5511999999999" className="h-8 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">SDR responsável</label>
                    <Select value={editSdrId} onValueChange={setEditSdrId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {teamMembers.filter(m => m.member_role.includes('sdr')).map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Closer responsável</label>
                    <Select value={editCloserId} onValueChange={setEditCloserId}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Nenhum" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhum</SelectItem>
                        {teamMembers.filter(m => m.member_role.includes('closer')).map(m => (<SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
              <AiSdrConfigPanel instanceId={inst.id} instanceName={inst.instance_name} aiSdrEnabled={inst.ai_sdr_enabled || false} aiSdrConfig={inst.ai_sdr_config || {}} onUpdate={refetchInstances} />
              <WaInstancePanel instanceName={inst.instance_name} closerName={displayName} instanceId={inst.id} />
            </div>
          );
        })
      )}
    </div>
  );
}
