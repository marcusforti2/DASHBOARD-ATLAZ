import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useWaConversations, useWaInstances, useWaMessages, WaConversation, WaInstance } from '@/hooks/use-wa-hub';
import { useWaTags, useWaContactTags } from '@/hooks/use-wa-tags';
import { WaConversationList } from './WaConversationList';
import WaChatView from './WaChatView';
import { WaLeadProfilePanel } from './WaLeadProfilePanel';
import { WaAiTools } from './WaAiTools';
import { WaCrmView } from './WaCrmView';
import { toast } from 'sonner';
import { sendMedia, sendAudio } from '@/lib/evolutionApi';
import {
  MessageSquare, BarChart3, Tag, Shield, Bell, Loader2, Clock, CheckCircle2, TrendingUp, AlertTriangle,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface Props {
  teamMemberId: string;
  memberName: string;
  memberRole: string; // "sdr" | "closer" | "sdr,closer"
}

export function WaUserPanel({ teamMemberId, memberName, memberRole }: Props) {
  const [tab, setTab] = useState<'chat' | 'pipeline' | 'reminders'>('chat');
  const { conversations, loading } = useWaConversations(null);
  const { instances } = useWaInstances();
  const { tags, createTag, deleteTag } = useWaTags();
  const { getTagsForContact, addTag, removeTag } = useWaContactTags();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const { messages, loading: messagesLoading, addOptimistic } = useWaMessages(selectedId);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; member_role: string }[]>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [remindersLoading, setRemindersLoading] = useState(true);

  useEffect(() => {
    supabase.from('team_members').select('id, name, member_role').eq('active', true).then(({ data }) => {
      setTeamMembers(data ?? []);
    });
  }, []);

  // Filter conversations assigned to this member's instances
  const myInstances = useMemo(() => {
    return instances.filter(i =>
      i.sdr_id === teamMemberId || i.closer_id === teamMemberId
    );
  }, [instances, teamMemberId]);

  const myConversations = useMemo(() => {
    const myInstanceIds = new Set(myInstances.map(i => i.id));
    return conversations.filter(c =>
      myInstanceIds.has(c.instance_id) || c.assigned_to === teamMemberId
    );
  }, [conversations, myInstances, teamMemberId]);

  const selectedConv = myConversations.find(c => c.id === selectedId);

  // Load reminders
  useEffect(() => {
    const fetchReminders = async () => {
      setRemindersLoading(true);
      const { data } = await supabase
        .from('wa_follow_up_reminders')
        .select('*, contact:wa_contacts!contact_id(name, phone)')
        .eq('created_by', teamMemberId)
        .eq('completed', false)
        .order('remind_at', { ascending: true });
      setReminders(data ?? []);
      setRemindersLoading(false);
    };
    fetchReminders();
  }, [teamMemberId]);

  const getSelectedInstance = () => {
    if (!selectedConv) return null;
    return instances.find(i => i.id === selectedConv.instance_id) || null;
  };

  const handleSend = async (text: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    const { error } = await supabase.functions.invoke('evolution-api', {
      body: {
        action: 'sendText',
        instanceName: inst.instance_name,
        data: { number: selectedConv.contact.phone, text },
      },
    });
    if (error) throw error;
  };

  const handleSendMedia = async (mediaType: string, mediaUrl: string, caption?: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    await sendMedia(inst.instance_name, selectedConv.contact.phone, mediaType as any, mediaUrl, caption);
  };

  const handleSendAudio = async (audioUrl: string) => {
    if (!selectedConv) return;
    const inst = getSelectedInstance();
    if (!inst) { toast.error('Instância não encontrada'); return; }
    await sendAudio(inst.instance_name, selectedConv.contact.phone, audioUrl);
  };

  const handleCompleteReminder = async (id: string) => {
    await supabase.from('wa_follow_up_reminders').update({
      completed: true,
      completed_at: new Date().toISOString(),
    } as any).eq('id', id);
    setReminders(prev => prev.filter(r => r.id !== id));
    toast.success('Lembrete concluído!');
  };

  const roles = memberRole.split(',').map(r => r.trim());
  const roleLabel = roles.length > 1 ? 'SDR + Closer' : roles[0]?.toUpperCase() || 'SDR';

  // KPIs
  const totalConvs = myConversations.length;
  const activeConvs = myConversations.filter(c => c.status === 'active').length;
  const unreadCount = myConversations.reduce((sum, c) => sum + c.unread_count, 0);
  const pendingReminders = reminders.filter(r => new Date(r.remind_at) <= new Date()).length;

  const stages = ['novo', 'qualificado', 'proposta', 'negociacao', 'fechado'];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary" />
          <span className="text-lg font-bold text-foreground">Meu WhatsApp</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{roleLabel}</span>
        </div>
        <div className="ml-auto flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">{totalConvs} conversas</span>
          </div>
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
              <span className="text-xs text-destructive font-medium">{unreadCount} não lidas</span>
            </div>
          )}
          {pendingReminders > 0 && (
            <div className="flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs text-amber-500 font-medium">{pendingReminders} lembretes</span>
            </div>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Conversas ativas', value: activeConvs, icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Não lidas', value: unreadCount, icon: AlertTriangle, color: unreadCount > 0 ? 'text-destructive' : 'text-muted-foreground', bg: unreadCount > 0 ? 'bg-destructive/10' : 'bg-muted' },
          { label: 'Lembretes pendentes', value: pendingReminders, icon: Clock, color: pendingReminders > 0 ? 'text-amber-500' : 'text-muted-foreground', bg: pendingReminders > 0 ? 'bg-amber-500/10' : 'bg-muted' },
          { label: 'Instâncias', value: myInstances.length, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
        ].map((stat, i) => (
          <div key={stat.label} className={`p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all duration-200 animate-card-enter stagger-${i + 1}`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-7 h-7 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-xl font-bold text-foreground">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={v => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="chat" className="text-xs gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> Conversas
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="text-xs gap-1.5">
            <Tag className="w-3.5 h-3.5" /> Pipeline
          </TabsTrigger>
          <TabsTrigger value="reminders" className="text-xs gap-1.5">
            <Bell className="w-3.5 h-3.5" /> Lembretes
            {pendingReminders > 0 && (
              <span className="ml-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center">
                {pendingReminders}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-4">
          <div className="flex rounded-xl border border-border bg-card overflow-hidden" style={{ height: 'calc(100vh - 340px)' }}>
            <WaConversationList
              conversations={myConversations}
              instances={myInstances}
              loading={loading}
              selectedId={selectedId}
              onSelect={setSelectedId}
              instanceFilter={null}
              onInstanceFilter={() => {}}
              title="Minhas Conversas"
              tags={tags}
              getTagsForContact={cid => getTagsForContact(cid)}
              onAddTag={addTag}
              onRemoveTag={removeTag}
            />

            {selectedConv ? (
              <>
                <WaChatView
                  conversation={selectedConv}
                  messages={messages}
                  messagesLoading={messagesLoading}
                  onBack={() => setSelectedId(null)}
                  onSend={async (text) => {
                    addOptimistic({ text });
                    await handleSend(text);
                  }}
                  onSendMedia={handleSendMedia}
                  onSendAudio={handleSendAudio}
                  tags={tags}
                  assignedTagIds={getTagsForContact(selectedConv.contact.id).map(t => t.tag_id)}
                  onAddTag={addTag}
                  onRemoveTag={removeTag}
                  onToggleProfile={() => setShowProfile(!showProfile)}
                  showProfileButton
                />

                {showProfile && (
                  <WaLeadProfilePanel
                    conversation={selectedConv}
                    messages={messages}
                    tags={tags}
                    assignedTagIds={getTagsForContact(selectedConv.contact.id).map(t => t.tag_id)}
                    onAddTag={addTag}
                    onRemoveTag={removeTag}
                    teamMembers={teamMembers}
                    onClose={() => setShowProfile(false)}
                    onTransfer={async (toMemberId, toRole, note) => {
                      const { data: profile } = await supabase.from('profiles').select('team_member_id').eq('id', (await supabase.auth.getUser()).data.user?.id || '').single();
                      await supabase.from('wa_transfer_logs').insert({
                        conversation_id: selectedConv.id,
                        from_member_id: profile?.team_member_id || null,
                        to_member_id: toMemberId,
                        from_role: memberRole.split(',')[0],
                        to_role: toRole,
                        note,
                      } as any);
                      await supabase.from('wa_conversations').update({
                        assigned_to: toMemberId,
                        assigned_role: toRole,
                      } as any).eq('id', selectedConv.id);
                      toast.success('Conversa transferida!');
                    }}
                  />
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Suas conversas do WhatsApp aparecem aqui</p>
                </div>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="mt-4">
          <WaCrmView
            conversations={myConversations}
            tags={tags}
            getTagsForContact={(contactId) => getTagsForContact(contactId)}
            onAddTag={addTag}
            onRemoveTag={removeTag}
            onCreateTag={createTag}
            onDeleteTag={deleteTag}
          />
        </TabsContent>

        <TabsContent value="reminders" className="mt-4">
          <div className="rounded-xl bg-card border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-500" /> Meus Lembretes de Follow-up
            </h3>

            {remindersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : reminders.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum lembrete pendente 🎉</p>
            ) : (
              <div className="space-y-2">
                {reminders.map(r => {
                  const isPast = new Date(r.remind_at) <= new Date();
                  return (
                    <div key={r.id} className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-200 hover:scale-[1.01] ${isPast ? 'border-amber-500/50 bg-amber-500/5' : 'border-border bg-secondary/30'}`}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {(r as any).contact?.name || 'Contato'}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate">{r.note || 'Sem nota'}</p>
                        <p className={`text-[10px] font-medium ${isPast ? 'text-amber-500' : 'text-muted-foreground'}`}>
                          {isPast ? '⏰ ' : '📅 '}
                          {new Date(r.remind_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <button
                        onClick={() => handleCompleteReminder(r.id)}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        title="Marcar como concluído"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
