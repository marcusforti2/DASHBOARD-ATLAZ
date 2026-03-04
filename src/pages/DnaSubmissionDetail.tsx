import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { questions } from '@/data/dna-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Loader2, Send, User, Bot, Download, FileSpreadsheet, BarChart3 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import SubmissionDashboard from '@/components/dna/SubmissionDashboard';

interface Submission {
  id: string;
  respondent_name: string | null;
  respondent_email: string | null;
  respondent_phone: string | null;
  status: string;
  completed_at: string | null;
  created_at: string;
  ai_analysis: any;
}

interface Answer {
  question_id: number;
  answer: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface SubmissionDetailProps {
  submissionId: string;
  onBack: () => void;
}

export default function DnaSubmissionDetail({ submissionId, onBack }: SubmissionDetailProps) {
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingAi, setAnalyzingAi] = useState(false);
  const [tab, setTab] = useState<'answers' | 'dashboard' | 'analysis' | 'chat'>('answers');

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const aiAnalysis = submission?.ai_analysis;
  const isNewFormat = aiAnalysis && typeof aiAnalysis === 'object' && 'narrative' in (aiAnalysis as any);
  const narrativeText = isNewFormat ? (aiAnalysis as any).narrative : (typeof aiAnalysis === 'string' ? aiAnalysis : aiAnalysis ? JSON.stringify(aiAnalysis, null, 2) : null);
  const dashboardData = isNewFormat ? (aiAnalysis as any).dashboard : null;

  useEffect(() => { loadData(); }, [submissionId]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatMessages]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: sub }, { data: ans }, { data: msgs }] = await Promise.all([
      supabase.from('test_submissions').select('*').eq('id', submissionId).single(),
      supabase.from('test_answers').select('question_id, answer').eq('submission_id', submissionId).order('question_id'),
      supabase.from('dna_chat_messages').select('role, content').eq('submission_id', submissionId).order('created_at'),
    ]);
    if (sub) setSubmission(sub as Submission);
    if (ans) setAnswers(ans as Answer[]);
    if (msgs && (msgs as any[]).length > 0) setChatMessages(msgs as unknown as ChatMessage[]);
    setLoading(false);
  };

  const runAiAnalysis = async () => {
    if (!submission || answers.length === 0) return;
    setAnalyzingAi(true);
    try {
      const formattedAnswers = answers.map(a => {
        const q = questions.find(q => q.id === a.question_id);
        return `Pergunta ${a.question_id} (Bloco ${q?.block || '?'} - ${q?.blockTitle || '?'}): ${q?.text || '?'}\nResposta: ${a.answer}`;
      }).join('\n\n');

      const { data, error } = await supabase.functions.invoke('analyze-test', {
        body: { submissionId: submission.id, answers: formattedAnswers },
      });
      if (error) throw error;

      const analysisObj = data.analysis;
      await supabase.from('test_submissions').update({ ai_analysis: analysisObj }).eq('id', submission.id);
      setSubmission(prev => prev ? { ...prev, ai_analysis: analysisObj } : prev);
      setTab('dashboard');
      toast.success('Análise concluída!');
    } catch (err: any) {
      toast.error(err.message);
    } finally { setAnalyzingAi(false); }
  };

  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatLoading || !submission) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);

    try {
      await supabase.from('dna_chat_messages').insert({ submission_id: submission.id, role: 'user', content: userMsg.content });
      const { data, error } = await supabase.functions.invoke('chat-submission', {
        body: { submissionId: submission.id, messages: [...chatMessages, userMsg] },
      });
      if (error) throw error;
      const assistantMsg: ChatMessage = { role: 'assistant', content: data.reply };
      setChatMessages(prev => [...prev, assistantMsg]);
      await supabase.from('dna_chat_messages').insert({ submission_id: submission.id, role: 'assistant', content: data.reply });
    } catch (err: any) { toast.error(err.message); }
    finally { setChatLoading(false); }
  };

  const exportCsv = () => {
    if (!submission || answers.length === 0) return;
    const BOM = '\uFEFF';
    const header = 'Bloco;Título do Bloco;Nº Pergunta;Pergunta;Resposta\n';
    const rows = answers.map(a => {
      const q = questions.find(q => q.id === a.question_id);
      const answerText = q?.type === 'multiple-choice' ? q.options?.find(o => o.value === a.answer)?.label || a.answer : a.answer;
      const clean = (s: string) => `"${(s || '').replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      return `${q?.block || ''};${clean(q?.blockTitle || '')};${a.question_id};${clean(q?.text || '')};${clean(answerText)}`;
    }).join('\n');
    const blob = new Blob([BOM + header + rows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `respostas-${(submission.respondent_name || 'vendedor').replace(/\s+/g, '-').toLowerCase()}.csv`; link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!submission) return <div className="text-center py-12 text-muted-foreground">Submissão não encontrada.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-foreground truncate">{submission.respondent_name || 'Sem nome'}</h2>
          <p className="text-xs text-muted-foreground">{submission.respondent_email} {submission.respondent_phone && `· ${submission.respondent_phone}`}</p>
        </div>
        {submission.status === 'completed' && (
          <Button onClick={runAiAnalysis} disabled={analyzingAi} size="sm">
            {analyzingAi ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Brain className="w-4 h-4 mr-1" />}
            {submission.ai_analysis ? 'Regerar' : 'Gerar Análise IA'}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <Button variant={tab === 'answers' ? 'default' : 'outline'} size="sm" onClick={() => setTab('answers')}>Respostas ({answers.length})</Button>
        <Button variant={tab === 'dashboard' ? 'default' : 'outline'} size="sm" onClick={() => setTab('dashboard')} disabled={!dashboardData}><BarChart3 className="w-4 h-4 mr-1" /> Dashboard</Button>
        <Button variant={tab === 'analysis' ? 'default' : 'outline'} size="sm" onClick={() => setTab('analysis')} disabled={!narrativeText}><Brain className="w-4 h-4 mr-1" /> Análise IA</Button>
        <Button variant={tab === 'chat' ? 'default' : 'outline'} size="sm" onClick={() => setTab('chat')}><Bot className="w-4 h-4 mr-1" /> Chat IA</Button>
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && dashboardData && <SubmissionDashboard data={dashboardData} />}

      {/* Answers Tab */}
      {tab === 'answers' && (
        <div className="space-y-6">
          <div className="flex justify-end"><Button onClick={exportCsv} variant="outline" size="sm"><FileSpreadsheet className="w-4 h-4 mr-1" /> CSV</Button></div>
          {[1, 2, 3, 4, 5, 6, 7].map(block => {
            const blockAnswers = answers.filter(a => { const q = questions.find(q => q.id === a.question_id); return q?.block === block; });
            if (blockAnswers.length === 0) return null;
            const blockTitle = questions.find(q => q.block === block)?.blockTitle || '';
            return (
              <motion.div key={block} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: block * 0.05 }}>
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Bloco {block} — {blockTitle}</h3>
                <div className="space-y-2">
                  {blockAnswers.map(a => {
                    const q = questions.find(q => q.id === a.question_id);
                    return (
                      <div key={a.question_id} className="bg-card border border-border rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">{a.question_id}. {q?.text}</p>
                        <p className="text-sm text-foreground font-medium">{q?.type === 'multiple-choice' ? q.options?.find(o => o.value === a.answer)?.label || a.answer : a.answer}</p>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Analysis Tab */}
      {tab === 'analysis' && narrativeText && (
        <div ref={analysisRef} className="bg-card border border-border rounded-xl p-6 sm:p-10">
          <div className="text-center mb-8 pb-6 border-b border-border">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Diagnóstico Comportamental e de Performance</h2>
            <p className="text-sm text-muted-foreground mt-2">{submission.respondent_name || 'Vendedor'}</p>
          </div>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{narrativeText}</ReactMarkdown>
          </div>
        </div>
      )}

      {/* Chat Tab */}
      {tab === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-340px)]">
          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
            {chatMessages.length === 0 && (
              <div className="text-center py-12 space-y-3">
                <Bot className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground text-sm">Pergunte sobre o perfil de <strong className="text-foreground">{submission.respondent_name}</strong>.</p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {['Qual o perfil DISC?', 'Principais pontos de travamento?', 'Que tipo de liderança funciona?'].map(s => (
                    <Button key={s} variant="outline" size="sm" className="text-xs" onClick={() => setChatInput(s)}>{s}</Button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {msg.role === 'assistant' && <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-primary" /></div>}
                <div className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card border border-border text-foreground'}`}>
                  {msg.role === 'assistant' ? <div className="prose prose-sm max-w-none dark:prose-invert"><ReactMarkdown>{msg.content}</ReactMarkdown></div> : msg.content}
                </div>
                {msg.role === 'user' && <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center flex-shrink-0"><User className="w-4 h-4 text-accent-foreground" /></div>}
              </div>
            ))}
            {chatLoading && (
              <div className="flex gap-3"><div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0"><Bot className="w-4 h-4 text-primary" /></div><div className="bg-card border border-border rounded-xl px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div></div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div className="border-t border-border pt-4 flex gap-2">
            <Input value={chatInput} onChange={(e) => setChatInput(e.target.value)} placeholder="Pergunte sobre este vendedor..." className="bg-card" onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendChatMessage()} />
            <Button onClick={sendChatMessage} disabled={chatLoading || !chatInput.trim()}><Send className="w-4 h-4" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
