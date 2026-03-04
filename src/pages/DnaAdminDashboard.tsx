import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import {
  FileText, Download, Brain, Eye, Loader2, Link2, Plus, Copy, Check, Pencil, Trash2,
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { questions } from '@/data/dna-questions';

interface TestLink {
  id: string;
  token: string;
  label: string;
  is_active: boolean;
  created_at: string;
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
}

interface DnaAdminDashboardProps {
  onViewSubmission: (id: string) => void;
}

export default function DnaAdminDashboard({ onViewSubmission }: DnaAdminDashboardProps) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [testLinks, setTestLinks] = useState<TestLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, { question_id: number; answer: string }[]>>({});
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [tab, setTab] = useState<'links' | 'submissions'>('links');
  const [editingLink, setEditingLink] = useState<TestLink | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [deletingLinkId, setDeletingLinkId] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: subs }, { data: links }] = await Promise.all([
      supabase.from('test_submissions').select('*').order('created_at', { ascending: false }),
      supabase.from('test_links').select('*').order('created_at', { ascending: false }),
    ]);
    setSubmissions((subs as Submission[]) || []);
    setTestLinks((links as TestLink[]) || []);
    setLoading(false);
  };

  const createLink = async () => {
    setCreatingLink(true);
    const { data, error } = await supabase.from('test_links').insert({ label: newLinkLabel.trim() || 'Sem rótulo' }).select().single();
    if (error) { toast.error(error.message); }
    else if (data) { setTestLinks(prev => [data as TestLink, ...prev]); setNewLinkLabel(''); toast.success('Link criado!'); }
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

  const exportCsv = () => {
    if (submissions.length === 0) return;
    const allQuestionIds = questions.map(q => q.id);
    const headers = ['Nome', 'Email', 'Telefone', 'Data', 'Status', ...allQuestionIds.map(id => `Q${id}`)];
    const rows = submissions.map(sub => {
      const subAnswers = answers[sub.id] || [];
      const answerMap: Record<number, string> = {};
      subAnswers.forEach(a => { answerMap[a.question_id] = a.answer; });
      return [sub.respondent_name || '', sub.respondent_email || '', sub.respondent_phone || '', sub.completed_at ? new Date(sub.completed_at).toLocaleDateString('pt-BR') : '', sub.status, ...allQuestionIds.map(id => `"${(answerMap[id] || '').replace(/"/g, '""')}"`)];
    });
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `dna-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const loadAllAnswersForExport = async () => {
    const ids = submissions.map(s => s.id);
    if (ids.length === 0) return;
    const { data } = await supabase.from('test_answers').select('submission_id, question_id, answer').in('submission_id', ids).order('question_id');
    if (data) {
      const grouped: Record<string, { question_id: number; answer: string }[]> = {};
      data.forEach((row: any) => { if (!grouped[row.submission_id]) grouped[row.submission_id] = []; grouped[row.submission_id].push({ question_id: row.question_id, answer: row.answer }); });
      setAnswers(prev => ({ ...prev, ...grouped }));
    }
    setTimeout(exportCsv, 200);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Links Criados', value: testLinks.length, icon: Link2 },
          { label: 'Total de Testes', value: submissions.length, icon: FileText },
          { label: 'Completos', value: submissions.filter(s => s.status === 'completed').length, icon: FileText },
          { label: 'Com Análise IA', value: submissions.filter(s => s.ai_analysis).length, icon: Brain },
        ].map((stat, i) => (
          <motion.div key={stat.label} className="bg-card border border-border rounded-xl p-4" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <stat.icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-2xl font-bold text-foreground">{stat.value}</p>
            <p className="text-xs text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button variant={tab === 'links' ? 'default' : 'outline'} size="sm" onClick={() => setTab('links')}><Link2 className="w-4 h-4 mr-1" /> Links</Button>
        <Button variant={tab === 'submissions' ? 'default' : 'outline'} size="sm" onClick={() => setTab('submissions')}><FileText className="w-4 h-4 mr-1" /> Submissões</Button>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={loadAllAnswersForExport}><Download className="w-4 h-4 mr-1" /> CSV</Button>
      </div>

      {tab === 'links' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={newLinkLabel} onChange={(e) => setNewLinkLabel(e.target.value)} placeholder="Rótulo do link (ex: João Silva...)" className="bg-card" />
            <Button onClick={createLink} disabled={creatingLink} className="shrink-0"><Plus className="w-4 h-4 mr-1" /> Criar Link</Button>
          </div>
          {testLinks.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center"><p className="text-muted-foreground">Nenhum link criado ainda.</p></div>
          ) : (
            <div className="space-y-2">
              {testLinks.map(link => (
                <div key={link.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground text-sm">{link.label}</p>
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
          {submissions.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center"><p className="text-muted-foreground">Nenhuma submissão ainda.</p></div>
          ) : submissions.map(sub => (
            <motion.div key={sub.id} className="bg-card border border-border rounded-xl overflow-hidden cursor-pointer hover:border-primary/30 transition-colors" initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => onViewSubmission(sub.id)}>
              <div className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{sub.respondent_name || 'Sem nome'}</p>
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
