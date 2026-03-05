import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { questions, MIN_CHARS } from '@/data/dna-questions';
import { sdrQuestions, SDR_MIN_CHARS } from '@/data/sdr-questions';
import { QuestionCard } from '@/components/dna/QuestionCard';
import { TestProgress } from '@/components/dna/TestProgress';
import { ChevronLeft, ChevronRight, Brain, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Stage = 'loading' | 'invalid' | 'intake' | 'test' | 'complete';

export default function PublicTestPage() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>('loading');
  const [linkId, setLinkId] = useState<string>('');
  const [testType, setTestType] = useState<'closer' | 'sdr'>('closer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [direction, setDirection] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submissionId, setSubmissionId] = useState<string>('');

  const activeQuestions = testType === 'sdr' ? sdrQuestions : questions;
  const totalQuestions = activeQuestions.length;

  useEffect(() => { validateToken(); }, [token]);

  const validateToken = async () => {
    if (!token) { setStage('invalid'); return; }
    const { data } = await supabase
      .from('test_links')
      .select('id, is_active, test_type')
      .eq('token', token)
      .eq('is_active', true)
      .single();

    if (data) {
      setLinkId(data.id);
      setTestType((data as any).test_type === 'sdr' ? 'sdr' : 'closer');
      setStage('intake');
    } else {
      setStage('invalid');
    }
  };

  const startTest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('test_submissions')
        .insert({
          test_link_id: linkId,
          respondent_name: name.trim(),
          respondent_email: email.trim(),
          respondent_phone: phone.trim(),
          status: 'in_progress',
          test_type: testType,
        } as any)
        .select('id')
        .single();
      if (error) throw error;
      setSubmissionId(data.id);
      setStage('test');
    } catch (err: any) {
      toast.error(err.message);
    } finally { setSubmitting(false); }
  };

  const handleAnswer = (questionId: number, value: string) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
    const q = activeQuestions.find(q => q.id === questionId);
    if (q && q.type !== 'open-text') {
      if (currentIndex < totalQuestions - 1) { setDirection(1); setCurrentIndex(prev => prev + 1); }
      else { submitAnswers(); }
    }
  };

  const goNext = () => {
    if (currentIndex < totalQuestions - 1) { setDirection(1); setCurrentIndex(prev => prev + 1); }
    else if (answeredCount === totalQuestions) { submitAnswers(); }
  };

  const submitAnswers = async () => {
    setSubmitting(true);
    try {
      const answerRows = Object.entries(answers).map(([questionId, answer]) => ({
        submission_id: submissionId, question_id: parseInt(questionId), answer,
      }));
      const { error: ansError } = await supabase.from('test_answers').insert(answerRows);
      if (ansError) throw ansError;
      await supabase.from('test_submissions').update({ status: 'completed', completed_at: new Date().toISOString() }).eq('id', submissionId);
      setStage('complete');
    } catch (err: any) { toast.error(err.message); }
    finally { setSubmitting(false); }
  };

  const question = activeQuestions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const currentAnswer = answers[question?.id];
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const goPrev = () => { if (currentIndex > 0) { setDirection(-1); setCurrentIndex(prev => prev - 1); } };

  const isSdr = testType === 'sdr';
  const testTitle = isSdr ? 'SDR DNA Decoder' : 'Sales DNA Decoder';
  const testSubtitle = isSdr ? 'Avaliação Comportamental para SDR de Prospecção' : 'Avaliação Comportamental e de Performance';
  const testDuration = isSdr ? '~20 minutos' : '~25 minutos';
  const testQuestionCount = isSdr ? '80 perguntas' : '120 perguntas';
  const minChars = isSdr ? SDR_MIN_CHARS : MIN_CHARS;

  if (stage === 'loading') return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (stage === 'invalid') return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center space-y-4"><Brain className="w-12 h-12 text-muted-foreground mx-auto" /><h1 className="text-xl font-bold text-foreground">Link inválido ou expirado</h1><p className="text-muted-foreground text-sm">Este link não é válido. Solicite um novo link ao responsável.</p></div>
    </div>
  );

  if (stage === 'complete') return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <motion.div className="text-center max-w-md space-y-6" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}>
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}>
          <div className="w-20 h-20 bg-accent rounded-full flex items-center justify-center mx-auto"><Brain className="w-10 h-10 text-primary" /></div>
        </motion.div>
        <div className="space-y-2"><h1 className="text-3xl font-bold text-foreground">Teste Concluído!</h1><p className="text-muted-foreground text-lg">Obrigado, {name.split(' ')[0]}!</p></div>
        <p className="text-muted-foreground text-sm leading-relaxed">Suas respostas foram registradas com sucesso. Em breve, nossos especialistas entrarão em contato para a <strong className="text-foreground">devolutiva</strong> da sua avaliação.</p>
      </motion.div>
    </div>
  );

  if (stage === 'intake') return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-10">
      <motion.div className="w-full max-w-md space-y-8" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-accent rounded-2xl"><Brain className="w-7 h-7 text-primary" /></div>
          <h1 className="text-2xl font-bold text-foreground">{testTitle}</h1>
          <p className="text-sm text-muted-foreground">{testSubtitle}</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-5 space-y-4">
          <h3 className="font-semibold text-sm text-foreground">Antes de começar</h3>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3"><span className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent-foreground mt-0.5">1</span><span>Reserve <strong className="text-foreground">{testDuration}</strong> sem interrupções.</span></li>
            <li className="flex items-start gap-3"><span className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent-foreground mt-0.5">2</span><span>Responda <strong className="text-foreground">como você realmente age</strong>.</span></li>
            <li className="flex items-start gap-3"><span className="w-6 h-6 bg-accent rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-accent-foreground mt-0.5">3</span><span><strong className="text-foreground">Seja honesto.</strong> Quanto mais sincero, melhor.</span></li>
          </ul>
        </div>
        <form onSubmit={startTest} className="space-y-4">
          <div className="space-y-1.5"><label className="text-sm font-medium text-foreground">Nome completo</label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo" required className="bg-card" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-foreground">E-mail</label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="seu@email.com" required className="bg-card" /></div>
          <div className="space-y-1.5"><label className="text-sm font-medium text-foreground">Telefone</label><Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(11) 99999-9999" required className="bg-card" /></div>
          <Button type="submit" disabled={submitting} className="w-full py-5">{submitting ? 'Aguarde...' : 'Iniciar Teste'}</Button>
        </form>
        <p className="text-center text-xs text-muted-foreground">{testQuestionCount} · {testDuration}</p>
      </motion.div>
    </div>
  );

  // test stage
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <TestProgress current={currentIndex} total={totalQuestions} answered={answeredCount} blockTitle={question.blockTitle} blockSubtitle={question.blockSubtitle} block={question.block} />
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/50">
        <span className="text-xs text-muted-foreground truncate">{name}</span>
        {isSdr && <span className="text-xs font-medium text-primary">DISC SDR</span>}
      </div>
      <div className="flex-1 flex items-center justify-center px-4 py-6 sm:py-10">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div key={question.id} custom={direction} initial={{ opacity: 0, x: direction * 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -60 }} transition={{ duration: 0.3, ease: 'easeInOut' }}>
              <QuestionCard question={question} answer={currentAnswer} onAnswer={(value) => handleAnswer(question.id, value)} questionNumber={currentIndex + 1} />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="sticky bottom-0 bg-background/80 backdrop-blur-lg border-t border-border">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={goPrev} disabled={currentIndex === 0} className="text-muted-foreground"><ChevronLeft className="w-4 h-4 mr-1" /> Anterior</Button>
          <span className="text-sm text-muted-foreground font-medium">{currentIndex + 1} / {totalQuestions}</span>
          {question.type === 'open-text' ? (
            <Button onClick={goNext} disabled={!currentAnswer || (currentAnswer.length < minChars) || submitting}>
              {submitting ? 'Salvando...' : isLastQuestion ? 'Finalizar' : 'Próxima'}
              {!isLastQuestion && !submitting && <ChevronRight className="w-4 h-4 ml-1" />}
            </Button>
          ) : (
            isLastQuestion && currentAnswer ? (
              <Button onClick={() => submitAnswers()} disabled={submitting}>
                {submitting ? 'Salvando...' : 'Finalizar'}
              </Button>
            ) : <div className="w-[88px]" />
          )}
        </div>
      </div>
    </div>
  );
}
