import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { questions } from '@/data/dna-questions';
import { sdrQuestions } from '@/data/sdr-questions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { ArrowLeft, Brain, Loader2, Send, User, Bot, Download, FileSpreadsheet, BarChart3, FileDown } from 'lucide-react';
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
  test_type?: string;
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
  const [exportingPdf, setExportingPdf] = useState(false);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const analysisRef = useRef<HTMLDivElement>(null);
  const dashboardRef = useRef<HTMLDivElement>(null);

  const testType = (submission as any)?.test_type || 'closer';
  const isSdr = testType === 'sdr';
  const activeQuestions = isSdr ? sdrQuestions : questions;

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
    if (sub) setSubmission(sub as any as Submission);
    if (ans) setAnswers(ans as Answer[]);
    if (msgs && (msgs as any[]).length > 0) setChatMessages(msgs as unknown as ChatMessage[]);
    setLoading(false);
  };

  const runAiAnalysis = async () => {
    if (!submission || answers.length === 0) return;
    setAnalyzingAi(true);
    try {
      const formattedAnswers = answers.map(a => {
        const q = activeQuestions.find(q => q.id === a.question_id);
        return `Q${a.question_id} (Bloco ${q?.block || '?'} - ${q?.blockTitle || '?'}): ${q?.text || '?'}\nResposta: ${a.answer}`;
      }).join('\n\n');

      const edgeFn = isSdr ? 'analyze-sdr-test' : 'analyze-test';
      const { data, error } = await supabase.functions.invoke(edgeFn, {
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
      const q = activeQuestions.find(q => q.id === a.question_id);
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

  const exportPdf = async () => {
    if (!submission) return;
    setExportingPdf(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      
      // Create a temporary container for the PDF content
      const container = document.createElement('div');
      container.style.cssText = 'position:absolute;left:-9999px;top:0;width:800px;background:#fff;color:#111;padding:40px;font-family:system-ui,sans-serif;';
      
      const name = submission.respondent_name || 'Vendedor';
      const date = submission.completed_at ? new Date(submission.completed_at).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
      const typeLabel = isSdr ? 'SDR de Prospecção' : 'Closer de Vendas';
      
      // Header
      let html = `
        <div style="text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #e5e7eb;">
          <h1 style="font-size:22px;font-weight:700;margin:0 0 6px;">Diagnóstico Comportamental — ${typeLabel}</h1>
          <p style="font-size:14px;color:#6b7280;margin:0;">${name} · ${date}</p>
        </div>
      `;
      
      // Dashboard data section
      if (dashboardData) {
        const d = dashboardData;
        const profileType = isSdr ? (d.sdr_type || 'SDR') : (d.closer_type || d.selling_style);
        const scoreLabel = isSdr ? 'Resiliência' : 'Negociação';
        const scoreVal = isSdr ? (d.resilience_score || 0) : (d.negotiation_score || 0);
        
        html += `
          <div style="display:flex;gap:12px;margin-bottom:24px;flex-wrap:wrap;">
            <div style="flex:1;min-width:170px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
              <p style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Perfil</p>
              <p style="font-size:14px;font-weight:700;margin:0;">${profileType}</p>
              ${d.tendency ? `<p style="font-size:10px;color:#6b7280;margin:4px 0 0;">${d.tendency}</p>` : ''}
            </div>
            <div style="flex:1;min-width:170px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
              <p style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Super Poder</p>
              <p style="font-size:14px;font-weight:700;margin:0;">${d.super_power || '—'}</p>
            </div>
            <div style="flex:1;min-width:170px;border:1px solid #e5e7eb;border-radius:10px;padding:14px;">
              <p style="font-size:10px;color:#9ca3af;text-transform:uppercase;margin:0 0 4px;">Recuperação</p>
              <p style="font-size:14px;font-weight:700;margin:0;">${d.recovery_time || '—'}</p>
            </div>
          </div>
        `;
        
        // Scores
        html += `
          <div style="border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:24px;">
            <h3 style="font-size:13px;font-weight:600;margin:0 0 12px;">Scores</h3>
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
              <div><span style="font-size:10px;color:#9ca3af;">Maturidade</span><br/><strong style="font-size:18px;">${d.maturity_level}/10</strong></div>
              <div><span style="font-size:10px;color:#9ca3af;">Execução</span><br/><strong style="font-size:18px;">${d.execution_level || 0}/10</strong></div>
              <div><span style="font-size:10px;color:#9ca3af;">${scoreLabel}</span><br/><strong style="font-size:18px;">${scoreVal}%</strong></div>
              <div><span style="font-size:10px;color:#9ca3af;">D</span><br/><strong>${d.disc?.D || 0}%</strong></div>
              <div><span style="font-size:10px;color:#9ca3af;">I</span><br/><strong>${d.disc?.I || 0}%</strong></div>
              <div><span style="font-size:10px;color:#9ca3af;">S</span><br/><strong>${d.disc?.S || 0}%</strong></div>
              <div><span style="font-size:10px;color:#9ca3af;">C</span><br/><strong>${d.disc?.C || 0}%</strong></div>
            </div>
          </div>
        `;
        
        // Tag sections helper
        const renderTags = (title: string, items: string[] | undefined, color: string) => {
          if (!items || items.length === 0) return '';
          return `
            <div style="margin-bottom:16px;">
              <h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:${color};">${title}</h3>
              <div style="display:flex;flex-wrap:wrap;gap:6px;">
                ${items.map(item => `<span style="padding:4px 10px;font-size:11px;border:1px solid #e5e7eb;border-radius:6px;background:#f9fafb;">${item}</span>`).join('')}
              </div>
            </div>
          `;
        };
        
        html += renderTags('✅ Pontos Fortes', d.strengths, '#16a34a');
        html += renderTags('⚠️ Pontos Fracos', d.weaknesses, '#dc2626');
        html += renderTags('🏆 Forças & Virtudes', d.virtues, '#7c3aed');
        html += renderTags('💡 Habilidades', d.skills, '#2563eb');
        html += renderTags('🔒 Travas Técnicas', d.technical_blocks, '#d97706');
        html += renderTags('❤️ Travas Emocionais', d.emotional_blocks, '#dc2626');
        if (isSdr) html += renderTags('🔍 Travas de Prospecção', d.prospecting_blocks, '#ea580c');
        html += renderTags('👁 Pontos de Atenção', d.attention_points, '#d97706');
        
        // Emotional vices
        if (d.emotional_vices && d.emotional_vices.length > 0) {
          html += `<div style="margin-bottom:16px;"><h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#ea580c;">🔥 Vícios Emocionais (Principal: ${d.principal_vice})</h3>`;
          d.emotional_vices.forEach((v: any) => {
            const barColor = v.score >= 7 ? '#ef4444' : v.score >= 4 ? '#f59e0b' : '#22c55e';
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="width:140px;font-size:11px;">${v.name}</span><div style="flex:1;height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;"><div style="height:100%;width:${v.score * 10}%;background:${barColor};border-radius:5px;"></div></div><span style="font-size:11px;width:30px;text-align:right;">${v.score}/10</span></div>`;
          });
          html += `</div>`;
        }
        
        // Sales risk stages
        if (d.sales_risk_stages && d.sales_risk_stages.length > 0) {
          html += `<div style="margin-bottom:16px;"><h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#dc2626;">🎯 Mapa de Risco</h3>`;
          d.sales_risk_stages.forEach((s: any) => {
            const barColor = s.risk >= 70 ? '#ef4444' : s.risk >= 40 ? '#f59e0b' : '#22c55e';
            const critical = s.stage === d.critical_stage ? ' ⚠ CRÍTICO' : '';
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;"><span style="width:120px;font-size:11px;">${s.stage}</span><div style="flex:1;height:10px;background:#f3f4f6;border-radius:5px;overflow:hidden;"><div style="height:100%;width:${s.risk}%;background:${barColor};border-radius:5px;"></div></div><span style="font-size:11px;width:60px;text-align:right;">${s.risk}%${critical}</span></div>`;
          });
          html += `</div>`;
        }
        
        // Action plan
        if (d.action_plan && d.action_plan.length > 0) {
          html += `<div style="margin-bottom:16px;"><h3 style="font-size:12px;font-weight:600;margin:0 0 8px;color:#059669;">🚀 Como Potencializar</h3>`;
          d.action_plan.forEach((a: string, i: number) => {
            html += `<div style="display:flex;gap:8px;margin-bottom:6px;padding:8px;background:#f0fdf4;border-radius:6px;"><span style="font-weight:700;color:#059669;font-size:12px;">${i + 1}.</span><span style="font-size:12px;">${a}</span></div>`;
          });
          html += `</div>`;
        }
      }
      
      // Narrative section
      if (narrativeText) {
        html += `
          <div style="margin-top:30px;padding-top:20px;border-top:2px solid #e5e7eb;">
            <h2 style="font-size:16px;font-weight:700;margin:0 0 16px;">Relatório Narrativo Completo</h2>
            <div style="font-size:12px;line-height:1.7;white-space:pre-wrap;">${narrativeText.replace(/#{1,3}\s/g, (m: string) => m.includes('###') ? '' : m.includes('##') ? '' : '').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br/>')}</div>
          </div>
        `;
      }
      
      container.innerHTML = html;
      document.body.appendChild(container);
      
      const fileName = `diagnostico-${(name).replace(/\s+/g, '-').toLowerCase()}-${date.replace(/\//g, '-')}.pdf`;
      
      await (html2pdf() as any).set({
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
        pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
      }).from(container).save();
      
      document.body.removeChild(container);
      toast.success('PDF exportado com sucesso!');
    } catch (err: any) {
      toast.error('Erro ao exportar PDF: ' + err.message);
    } finally {
      setExportingPdf(false);
    }
  };

  // Get unique blocks from the active questions
  const blockNumbers = [...new Set(activeQuestions.map(q => q.block))].sort();

  if (loading) return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!submission) return <div className="text-center py-12 text-muted-foreground">Submissão não encontrada.</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="w-4 h-4 mr-1" /> Voltar</Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-foreground truncate">{submission.respondent_name || 'Sem nome'}</h2>
            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSdr ? 'bg-blue-500/10 text-blue-500' : 'bg-primary/10 text-primary'}`}>
              {testType.toUpperCase()}
            </span>
          </div>
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
      <div className="flex gap-2 flex-wrap items-center">
        <Button variant={tab === 'answers' ? 'default' : 'outline'} size="sm" onClick={() => setTab('answers')}>Respostas ({answers.length})</Button>
        <Button variant={tab === 'dashboard' ? 'default' : 'outline'} size="sm" onClick={() => setTab('dashboard')} disabled={!dashboardData}><BarChart3 className="w-4 h-4 mr-1" /> Dashboard</Button>
        <Button variant={tab === 'analysis' ? 'default' : 'outline'} size="sm" onClick={() => setTab('analysis')} disabled={!narrativeText}><Brain className="w-4 h-4 mr-1" /> Análise IA</Button>
        <Button variant={tab === 'chat' ? 'default' : 'outline'} size="sm" onClick={() => setTab('chat')}><Bot className="w-4 h-4 mr-1" /> Chat IA</Button>
        {(dashboardData || narrativeText) && (
          <Button variant="outline" size="sm" onClick={exportPdf} disabled={exportingPdf} className="ml-auto">
            {exportingPdf ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <FileDown className="w-4 h-4 mr-1" />}
            Exportar PDF
          </Button>
        )}
      </div>

      {/* Dashboard Tab */}
      {tab === 'dashboard' && dashboardData && <SubmissionDashboard ref={dashboardRef} data={dashboardData} testType={testType} />}

      {/* Answers Tab */}
      {tab === 'answers' && (
        <div className="space-y-6">
          <div className="flex justify-end"><Button onClick={exportCsv} variant="outline" size="sm"><FileSpreadsheet className="w-4 h-4 mr-1" /> CSV</Button></div>
          {blockNumbers.map(block => {
            const blockAnswers = answers.filter(a => { const q = activeQuestions.find(q => q.id === a.question_id); return q?.block === block; });
            if (blockAnswers.length === 0) return null;
            const blockTitle = activeQuestions.find(q => q.block === block)?.blockTitle || '';
            return (
              <motion.div key={block} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: block * 0.05 }}>
                <h3 className="text-xs font-semibold text-primary uppercase tracking-wide mb-3">Bloco {block} — {blockTitle}</h3>
                <div className="space-y-2">
                  {blockAnswers.map(a => {
                    const q = activeQuestions.find(q => q.id === a.question_id);
                    return (
                      <div key={a.question_id} className="bg-card border border-border rounded-xl p-4">
                        <p className="text-xs text-muted-foreground mb-1">{a.question_id}. {q?.text}</p>
                        <p className="text-sm text-foreground font-medium">
                          {q?.type === 'scale' ? `${a.answer} / ${q.scaleMax}` : q?.type === 'multiple-choice' ? q.options?.find(o => o.value === a.answer)?.label || a.answer : a.answer}
                        </p>
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
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">
              {isSdr ? 'Diagnóstico DISC — SDR de Prospecção' : 'Diagnóstico Comportamental e de Performance'}
            </h2>
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
                  {(isSdr
                    ? ['Qual o perfil DISC?', 'Classificação do SDR?', 'Pontos fortes na prospecção?']
                    : ['Qual o perfil DISC?', 'Principais pontos de travamento?', 'Que tipo de liderança funciona?']
                  ).map(s => (
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
