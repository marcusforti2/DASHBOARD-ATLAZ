import { Smartphone, Wifi, Battery, Signal } from "lucide-react";

interface PhonePreviewProps {
  messageTemplate: string;
  automationName: string;
}

export default function PhonePreview({ messageTemplate, automationName }: PhonePreviewProps) {
  // Replace variables with sample values
  const sampleMessage = messageTemplate
    .replace(/\{\{nome\}\}/g, "João Silva")
    .replace(/\{\{data\}\}/g, new Date().toLocaleDateString("pt-BR"))
    .replace(/\{\{role\}\}/g, "SDR")
    .replace(/\{\{metricas_hoje\}\}/g, "📊 Conexões: 12 | Abordagens: 8 | Follow-ups: 5")
    .replace(/\{\{metricas_mes\}\}/g, "📈 Total mês: Conexões 180 | Abordagens 95")
    .replace(/\{\{progresso_meta\}\}/g, "🎯 Meta: 72% concluída (180/250 conexões)")
    .replace(/\{\{falta_meta\}\}/g, "⚡ Faltam 70 conexões para bater a meta!")
    .replace(/\{\{ranking\}\}/g, "🏆 Ranking: 2º lugar no time")
    .replace(/\{\{dicas_ia\}\}/g, "💡 Dica: Foque em follow-ups hoje — você tem 15 leads quentes esperando resposta!");

  const now = new Date();
  const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;

  return (
    <div className="flex flex-col items-center">
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3">Preview</p>

      {/* Phone Frame */}
      <div className="w-[280px] rounded-[2.5rem] border-2 border-border bg-background p-2 shadow-2xl">
        <div className="rounded-[2rem] overflow-hidden bg-card border border-border">
          {/* Status bar */}
          <div className="flex items-center justify-between px-5 py-2 bg-secondary/50">
            <span className="text-[9px] font-semibold text-muted-foreground">{timeStr}</span>
            <div className="flex items-center gap-1.5">
              <Signal size={10} className="text-muted-foreground" />
              <Wifi size={10} className="text-muted-foreground" />
              <Battery size={10} className="text-muted-foreground" />
            </div>
          </div>

          {/* WhatsApp header */}
          <div className="flex items-center gap-3 px-4 py-2.5 bg-[hsl(var(--primary)/0.15)] border-b border-border">
            <div className="w-8 h-8 rounded-full bg-primary/30 flex items-center justify-center">
              <Smartphone size={12} className="text-primary" />
            </div>
            <div>
              <p className="text-[11px] font-bold text-card-foreground">Sistema Canvas Pro</p>
              <p className="text-[8px] text-muted-foreground">online</p>
            </div>
          </div>

          {/* Chat area */}
          <div className="h-[380px] overflow-auto p-3 space-y-2 bg-background/50" style={{
            backgroundImage: "radial-gradient(circle at 50% 50%, hsl(var(--primary) / 0.03) 0%, transparent 70%)",
          }}>
            {/* Date badge */}
            <div className="flex justify-center mb-2">
              <span className="text-[8px] bg-secondary px-3 py-1 rounded-full text-muted-foreground">
                Hoje
              </span>
            </div>

            {/* Bot message bubble */}
            <div className="max-w-[90%]">
              <div className="bg-secondary/80 border border-border rounded-2xl rounded-tl-md px-3 py-2.5 shadow-sm">
                <p className="text-[10px] text-card-foreground whitespace-pre-wrap leading-relaxed">
                  {sampleMessage || "Configure o template da mensagem para ver o preview..."}
                </p>
                <div className="flex justify-end mt-1.5">
                  <span className="text-[7px] text-muted-foreground">{timeStr} ✓✓</span>
                </div>
              </div>
            </div>
          </div>

          {/* Input bar */}
          <div className="flex items-center gap-2 px-3 py-2 bg-secondary/30 border-t border-border">
            <div className="flex-1 rounded-full bg-secondary px-3 py-1.5">
              <span className="text-[9px] text-muted-foreground">Mensagem</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
              <Smartphone size={10} className="text-primary" />
            </div>
          </div>
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground mt-3 text-center max-w-[250px]">
        As variáveis serão substituídas pelos dados reais de cada membro ao enviar
      </p>
    </div>
  );
}
