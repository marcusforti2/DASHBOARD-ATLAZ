import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  FileText, Download, Brain, Eye, Loader2, Link2, Plus, Copy, Check, Pencil, Trash2, MessageSquare, User,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { questions } from '@/data/dna-questions';
import { sdrQuestions } from '@/data/sdr-questions';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface TestLink {
  id: string;
  token: string;
  label: string;
  is_active: boolean;
  created_at: string;
  test_type: string;
  member_id: string | null;
}

interface TeamMember {
  id: string;
  name: string;
  member_role: string;
  active: boolean;
}

interface WhatsAppContact {
  phone: string;
  team_member_id: string | null;
}

interface Submission {
  id: string;
  status: string;
  completed_at: string | null;
  created_at: string;
  ai_analysis: any;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  member_id: string | null;
  test_link_id: string | null;
  test_type: string;
}

interface DnaAdminDashboardProps {
  onViewSubmission: (id: string) => void;
}

export default function DnaAdminDashboard({ onViewSubmission }: DnaAdminDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [testLinks, setTestLinks] = useState<TestLink[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [whatsappContacts, setWhatsappContacts] = useState<WhatsAppContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, { question_id: number; answer: string }[]>>({});
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkType, setNewLinkType] = useState<'closer' | 'sdr'>('closer');
  const [selectedMemberId, setSelectedMemberId] = useState<string>('free');
  const [creatingLink, setCreatingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'links' | 'submissions'>('links');
  const [editingLink, setEditingLink] = useState<TestLink | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'closer' | 'sdr'>('all');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: subs }, { data: links }, { data: members }, { data: contacts }] = await Promise.all([
      supabase.from('test_submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('test_links').select('*').order('created_at', { ascending: false }),
      supabase.from('team_members').select('*').eq('active', true).order('name'),
      supabase.from('whatsapp_contacts').select('phone, team_member_id').eq('active', true),
    ]);
    setSubmissions((subs as any as Submission[]) || []);
    setTestLinks((links as any as TestLink[]) || []);
    setTeamMembers((members as TeamMember[]) || []);
    setWhatsappContacts((contacts as WhatsAppContact[]) || []);
    setLoading(false);
  };

  const sendWhatsAppNotification = async (phone: string, memberName: string, testType: string, testUrl: string) => {
    const typeLabel = testType === 'sdr' ? 'SDR' : 'Closer';
    const message = `🧬 *Sales DNA Decoder — Teste Comportamental ${typeLabel}*\n\nOlá, ${memberName}! 👋\n\nVocê foi selecionado(a) para realizar o *Mapeamento Comportamental ${typeLabel}*.\n\n📋 *O que é?*\nUm teste de 120 perguntas que analisa seu perfil comportamental, pontos fortes, áreas de desenvolvimento e estilo de atuação profissional.\n\n⏱ *Duração estimada:* 15-25 minutos\n\n📌 *Dicas importantes:*\n• Responda com sinceridade — não existem respostas certas ou erradas\n• Reserve um momento tranquilo, sem interrupções\n• Leia cada pergunta com atenção antes de responder\n• O teste salva seu progresso automaticamente\n\n🔗 *Acesse seu teste aqui:*\n${testUrl}\n\n✅ Ao finalizar, sua análise será gerada automaticamente com insights personalizados.\n\nBoa sorte! 🚀`;

    try {
      await supabase.functions.invoke('send-whatsapp', {
        body: { phone, message },
      });
      toast.success(`WhatsApp enviado para ${memberName}!`);
    } catch (err) {
      console.error('WhatsApp send error:', err);
      toast.error('Link criado, mas não foi possível enviar o WhatsApp.');
    }
  };

  const createLink = async () => {
    setCreatingLink(true);
    const memberId = selectedMemberId === 'free' ? null : selectedMemberId;
    const member = memberId ? teamMembers.find(m => m.id === memberId) : null;
    const label = newLinkLabel.trim() || (member ? member.name : 'Sem rótulo');

    const { data, error } = await supabase.from('test_links').insert({
      label,
      test_type: newLinkType,
      member_id: memberId,
    } as any).select().single();

    if (error) {
      toast.error(error.message);
    } else if (data) {
      const newLink = data as any as TestLink;
      setTestLinks(prev => [newLink, ...prev]);
      setNewLinkLabel('');
      setSelectedMemberId('free');
      toast.success('Link criado!');

      // Auto-send WhatsApp if member has a contact
      if (memberId && member) {
        const contact = whatsappContacts.find(c => c.team_member_id === memberId);
        if (contact) {
          const testUrl = `${window.location.origin}/t/${newLink.token}`;
          await sendWhatsAppNotification(contact.phone, member.name, newLinkType, testUrl);
        }
      }
    }
    setCreatingLink(false);
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/t/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const updateLink = async () => {
    if (!editingLink) return;
    const { error } = await supabase.from('test_links').update({ label: editLabel.trim() || 'Sem rótulo' }).eq('id', editingLink.id);
    if (error) { toast.error(error.message); }
    else { setTestLinks(prev => prev.map(l => l.id === editingLink.id ? { ...l, label: editLabel.trim() || 'Sem rótulo' } : l)); toast.success('Atualizado!'); }
    setEditingLink(null);
  };

  const deleteLink = async (id: string) => {
    const { error } = await supabase.from('test_links').delete().eq('id', id);
    if (error) { toast.error(error.message); }
    else { setTestLinks(prev => prev.filter(l => l.id !== id)); toast.success('Excluído!'); }
    setDeletingLinkId(null);
  };

  const filteredSubmissions = filterType === 'all' ? submissions : submissions.filter(s => (s.test_type || 'closer') === filterType);
  const filteredLinks = filterType === 'all' ? testLinks : testLinks.filter(l => (l.test_type || 'closer') === filterType);

  const exportCsv = () => {
    if (filteredSubmissions.length === 0) return;
    const isExportSdr = filterType === 'sdr';
    const activeQuestions = isExportSdr ? sdrQuestions : questions;
    const allQuestionIds = activeQuestions.map(q => q.id);
    const headers = ['Nome', 'Email', 'Telefone', 'Tipo', 'Data', 'Status', ...allQuestionIds.map(id => `Q${id}`)];
    const rows = filteredSubmissions.map(sub => {
      const subAnswers = answers[sub.id] || [];
      const answerMap: Record<number, string> = {};
      subAnswers.forEach(a => { answerMap[a.question_id] = a.answer; });
      return [sub.respondent_name || '', sub.respondent_email || '', sub.respondent_phone || '', sub.test_type || 'closer', sub.completed_at ? new Date(sub.completed_at).toLocaleDateString('pt-BR') : '', sub.status, ...allQuestionIds.map(id => `"${(answerMap[id] || '').replace(/"/g, '""')}"`)];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dna-${filterType}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const loadAllAnswersForExport = async () => {
    const ids = filteredSubmissions.map(s => s.id);
    if (ids.length === 0) return;
    const { data } = await supabase.from('test_answers').select('submission_id, question_id, answer').in('submission_id', ids).order('question_id');
    if (data) {
      const grouped: Record<string, { question_id: number; answer: string }[]> = {};
      data.forEach((row: any) => { if (!grouped[row.submission_id]) grouped[row.submission_id] = []; grouped[row.submission_id].push({ question_id: row.question_id, answer: row.answer }); });
      setAnswers(prev => ({ ...prev, ...grouped }));
    }
    setTimeout(exportCsv, 200);
  };

  const closerSubs = submissions.filter(s => (s.test_type || 'closer') === 'closer');
  const sdrSubs = submissions.filter(s => (s.test_type || 'closer') === 'sdr');

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Links Criados', value: testLinks.length, icon: Link2 },
          { label: 'Total de Testes', value: submissions.length, icon: FileText },
          { label: 'Closer', value: closerSubs.filter(s => s.status === 'completed').length, icon: FileText },
          { label: 'SDR', value: sdrSubs.filter(s => s.status === 'completed').length, icon: FileText },
          { label: 'Com Análise IA', value: submissions.filter(s => s.ai_analysis).length, icon: Brain },
        ].map((stat, i) => (
          <motion.div key={stat.label} className="bg-card border border-border rounded-xl p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <stat.icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs + Filter */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === 'links' ? 'default' : 'outline'} size="sm" onClick={() => setTab('links')}><Link2 className="w-4 h-4 mr-1" /> Links</Button>
        <Button variant={tab === 'submissions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('submissions')}><FileText className="w-4 h-4 mr-1" /> Submissões</Button>
        <div className="flex-1" />
        <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
          <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="closer">Closer</SelectItem>
            <SelectItem value="sdr">SDR</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={loadAllAnswersForExport}><Download className="w-4 h-4 mr-1" /> CSV</Button>
      </div>

      {tab === 'links' && (
        <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Destinatário" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="free">
                  <span className="flex items-center gap-1.5"><Link2 className="w-3.5 h-3.5" /> Link Livre</span>
                </SelectItem>
                {teamMembers.map(m => {
                  const hasWhatsApp = whatsappContacts.some(c => c.team_member_id === m.id);
                  return (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5" />
                        {m.name}
                        <span className={`text-[10px] px-1 rounded ${m.member_role === 'sdr' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
                          {m.member_role.toUpperCase()}
                        </span>
                        {hasWhatsApp && <MessageSquare className="w-3 h-3 text-green-500" />}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={newLinkType} onValueChange={(v: any) => setNewLinkType(v)}>
              <SelectTrigger className="w-[120px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="closer">Closer</SelectItem>
                <SelectItem value="sdr">SDR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2">
            <Input value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Rótulo do link (opcional — usa o nome do membro se vazio)" className="bg-card flex-1" />
            <Button onClick={createLink} disabled={creatingLink} className="shrink-0">
              {creatingLink ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Plus className="w-4 h-4 mr-1" />}
              Criar
            </Button>
          </div>
          {selectedMemberId !== 'free' && whatsappContacts.some(c => c.team_member_id === selectedMemberId) && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              WhatsApp será enviado automaticamente ao criar o link
            </p>
          )}
          {selectedMemberId !== 'free' && !whatsappContacts.some(c => c.team_member_id === selectedMemberId) && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5" />
              Membro sem WhatsApp cadastrado — link será criado sem envio
            </p>
          )}
        </div>
          {filteredLinks.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center"><p className="text-muted-foreground">Nenhum link criado ainda.</p></div>
          ) : (
            <div className="space-y-2">
              {filteredLinks.map(link => (
                <div key={link.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground text-sm">{link.label}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${(link.test_type || 'closer') === 'sdr' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
                        {(link.test_type || 'closer').toUpperCase()}
                      </span>
                      {link.member_id ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground flex items-center gap-1">
                          <User className="w-3 h-3" />
                          {teamMembers.find(m => m.id === link.member_id)?.name || 'Membro'}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">Livre</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{window.location.origin}/t/{link.token}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingLink(link); setEditLabel(link.label); }}><Pencil className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeletingLinkId(link.id)} className="text-destructive hover:text-destructive"><Trash2 className="w-4 h-4" /></Button>
                    <Button variant="outline" size="sm" onClick={() => copyLink(link.token)}>{copiedToken === link.token ? <Check className="w-4 h-4 text-primary" /> : <Copy className="w-4 h-4" />}</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'submissions' && (
        <div className="space-y-3">
          {filteredSubmissions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center"><p className="text-muted-foreground">Nenhuma submissão ainda.</p></div>
          ) : filteredSubmissions.map(sub => (
            <motion.div key={sub.id} className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => onViewSubmission(sub.id)}>
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground truncate">{sub.respondent_name || 'Sem nome'}</p>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${(sub.test_type || 'closer') === 'sdr' ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
                      {(sub.test_type || 'closer').toUpperCase()}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{sub.respondent_email} {sub.respondent_phone && `· ${sub.respondent_phone}`} · {sub.completed_at ? new Date(sub.completed_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Em progresso'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-1 rounded-full ${sub.status === 'completed' ? 'bg-accent/20 text-accent' : 'bg-secondary text-secondary-foreground'}`}>{sub.status === 'completed' ? 'Completo' : 'Em progresso'}</span>
                  {sub.ai_analysis && <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">IA ✓</span>}
                  <Eye className="w-4 h-4 text-muted-foreground" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editingLink} onOpenChange={(open) => !open && setEditingLink(null)}>
        <DialogContent><DialogHeader><DialogTitle>Editar Link</DialogTitle></DialogHeader>
          <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} placeholder="Rótulo do link" />
          <DialogFooter><Button variant="outline" onClick={() => setEditingLink(null)}>Cancelar</Button><Button onClick={updateLink}>Salvar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={!!deletingLinkId} onOpenChange={(open) => !open && setDeletingLinkId(null)}>
        <DialogContent><DialogHeader><DialogTitle>Excluir Link</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Tem certeza? Esta ação não pode ser desfeita.</p>
          <DialogFooter><Button variant="outline" onClick={() => setDeletingLinkId(null)}>Cancelar</Button><Button variant="destructive" onClick={() => deletingLinkId && deleteLink(deletingLinkId)}>Excluir</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
