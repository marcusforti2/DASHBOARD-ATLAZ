import { useState } from 'react';
import { Sparkles, FileText, Heart, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WaMessage } from '@/hooks/use-wa-hub';

interface Props {
  messages: WaMessage[];
  contactName: string;
}

export function WaAiTools({ messages, contactName }: Props) {
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sentimentLoading, setSentimentLoading] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [sentiment, setSentiment] = useState<{ level: string; text: string } | null>(null);

  const buildContext = () => {
    return messages.slice(-30).map(m =>
      `${m.sender === 'agent' ? 'Agente' : contactName}: ${m.text}`
    ).join('\n');
  };

  const handleSummarize = async () => {
    if (messages.length < 3) { toast.info('Poucas mensagens para resumir'); return; }
    setSummaryLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: {
          messages: [{
            role: 'user',
            content: `Resuma esta conversa de WhatsApp comercial em 3-5 bullet points concisos. Foque nos pontos-chave: interesse do lead, objeções, próximos passos.\n\nConversa:\n${buildContext()}\n\nResumo:`
          }],
        },
      });
      if (error) throw error;
      setSummary(data?.content || data?.message || 'Sem resumo');
    } catch { toast.error('Erro ao resumir'); }
    finally { setSummaryLoading(false); }
  };

  const handleSentiment = async () => {
    if (messages.length < 3) { toast.info('Poucas mensagens para análise'); return; }
    setSentimentLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('ai-coach', {
        body: {
          messages: [{
            role: 'user',
            content: `Analise o sentimento desta conversa comercial no WhatsApp. Responda APENAS em JSON no formato: {"level": "positivo|neutro|negativo|risco", "text": "explicação curta de 1-2 frases sobre o sentimento e risco de perda"}\n\nConversa:\n${buildContext()}\n\nJSON:`
          }],
        },
      });
      if (error) throw error;
      const raw = data?.content || data?.message || '';
      try {
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          setSentiment(JSON.parse(jsonMatch[0]));
        } else {
          setSentiment({ level: 'neutro', text: raw });
        }
      } catch {
        setSentiment({ level: 'neutro', text: raw });
      }
    } catch { toast.error('Erro na análise'); }
    finally { setSentimentLoading(false); }
  };

  const getSentimentColor = (level: string) => {
    switch (level) {
      case 'positivo': return 'text-primary bg-primary/10';
      case 'negativo': case 'risco': return 'text-destructive bg-destructive/10';
      default: return 'text-yellow-600 bg-yellow-500/10';
    }
  };

  const getSentimentEmoji = (level: string) => {
    switch (level) {
      case 'positivo': return '😊';
      case 'negativo': return '😟';
      case 'risco': return '🚨';
      default: return '😐';
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        <span className="text-[10px] font-semibold text-foreground">Ferramentas IA</span>
      </div>

      <div className="flex gap-1.5">
        <button onClick={handleSummarize} disabled={summaryLoading} className="flex-1 text-[10px] py-1.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 font-medium flex items-center justify-center gap-1 disabled:opacity-50 transition-colors">
          {summaryLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />} Resumir
        </button>
        <button onClick={handleSentiment} disabled={sentimentLoading} className="flex-1 text-[10px] py-1.5 rounded-lg bg-accent text-accent-foreground hover:bg-accent/80 font-medium flex items-center justify-center gap-1 disabled:opacity-50 transition-colors">
          {sentimentLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Heart className="w-3 h-3" />} Sentimento
        </button>
      </div>

      {summary && (
        <div className="rounded-lg bg-muted/50 p-2.5 space-y-1 animate-fade-in">
          <p className="text-[10px] font-semibold text-primary flex items-center gap-1"><FileText className="w-3 h-3" /> Resumo</p>
          <p className="text-xs text-foreground whitespace-pre-wrap">{summary}</p>
          <button onClick={() => setSummary(null)} className="text-[9px] text-muted-foreground hover:text-foreground">Fechar</button>
        </div>
      )}

      {sentiment && (
        <div className={`rounded-lg p-2.5 space-y-1 animate-fade-in ${getSentimentColor(sentiment.level)}`}>
          <p className="text-[10px] font-semibold flex items-center gap-1">
            {getSentimentEmoji(sentiment.level)} Sentimento: {sentiment.level.toUpperCase()}
          </p>
          <p className="text-xs">{sentiment.text}</p>
          <button onClick={() => setSentiment(null)} className="text-[9px] opacity-70 hover:opacity-100">Fechar</button>
        </div>
      )}
    </div>
  );
}
