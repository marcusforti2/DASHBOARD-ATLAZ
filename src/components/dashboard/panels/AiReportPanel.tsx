import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { saveAiReport } from "@/lib/db";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface AiReportPanelProps {
  monthId: string;
  monthLabel: string;
  metrics: Record<string, number>;
  goals: Record<string, number> | null;
  members: string[];
  existingReports: Array<{ id: string; content: string; generated_at: string; report_type: string }>;
  onReportGenerated: () => void;
}

export function AiReportPanel({ monthId, monthLabel, metrics, goals, members, existingReports, onReportGenerated }: AiReportPanelProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [streamContent, setStreamContent] = useState("");
  const [showHistory, setShowHistory] = useState(false);

  const generateReport = useCallback(async () => {
    setIsGenerating(true);
    setStreamContent("");

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-metrics`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ metrics, goals, members, month_label: monthLabel }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao gerar relatório");
        setIsGenerating(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              setStreamContent(fullContent);
            }
          } catch {}
        }
      }

      if (fullContent) {
        await saveAiReport(monthId, fullContent);
        onReportGenerated();
        toast.success("Relatório salvo com sucesso!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar relatório de IA");
    } finally {
      setIsGenerating(false);
    }
  }, [monthId, monthLabel, metrics, goals, members, onReportGenerated]);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Relatório IA</h3>
        </div>
        <div className="flex gap-2">
          {existingReports.length > 0 && (
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {showHistory ? "Ocultar" : `Histórico (${existingReports.length})`}
            </button>
          )}
          <button
            onClick={generateReport}
            disabled={isGenerating}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {isGenerating ? "Gerando..." : "Gerar Análise"}
          </button>
        </div>
      </div>

      {(streamContent || isGenerating) && (
        <div className="rounded-lg bg-secondary/50 p-4 max-h-96 overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
            {streamContent || "Analisando métricas..."}
          </div>
        </div>
      )}

      {showHistory && existingReports.map(report => (
        <div key={report.id} className="rounded-lg bg-secondary/30 p-4 max-h-64 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] text-muted-foreground">
              {new Date(report.generated_at).toLocaleString("pt-BR")}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase">{report.report_type}</span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
            {report.content}
          </div>
        </div>
      ))}
    </div>
  );
}
