import { useState } from "react";
import {
  Phone, FileText, MessageSquare, Image, PenLine, BarChart3, Smile,
  ArrowLeft, Headphones, Target
} from "lucide-react";
import { AiChat } from "./AiChat";
import { cn } from "@/lib/utils";

interface AiToolsPanelProps {
  memberId: string;
  memberRole: string;
}

const AI_TOOLS = [
  {
    id: "chat",
    label: "Coach IA",
    description: "Converse sobre estratégias, dúvidas e performance",
    icon: MessageSquare,
    color: "from-primary/20 to-primary/5 border-primary/20",
    iconColor: "text-primary",
    placeholder: "Pergunte qualquer coisa sobre vendas, estratégia, objeções...",
    roles: ["sdr", "closer"],
  },
  {
    id: "call-analysis",
    label: "Analisar Call",
    description: "Cole a transcrição e receba análise completa",
    icon: Headphones,
    color: "from-accent/20 to-accent/5 border-accent/20",
    iconColor: "text-accent",
    placeholder: "Cole a transcrição ou descreva a ligação de vendas...",
    roles: ["closer"],
  },
  {
    id: "qualification-analysis",
    label: "Analisar Qualificação",
    description: "Avalie sua ligação de qualificação",
    icon: Target,
    color: "from-chart-4/20 to-chart-4/5 border-chart-4/20",
    iconColor: "text-chart-4",
    placeholder: "Descreva a ligação de qualificação...",
    roles: ["sdr", "closer"],
  },
  {
    id: "meeting-script",
    label: "Script de Reunião",
    description: "Crie scripts personalizados para reuniões",
    icon: FileText,
    color: "from-chart-3/20 to-chart-3/5 border-chart-3/20",
    iconColor: "text-chart-3",
    placeholder: "Descreva o prospect, empresa, dor principal...",
    roles: ["closer"],
  },
  {
    id: "linkedin-carousel",
    label: "Carrossel LinkedIn",
    description: "Crie carrosseis que geram engajamento",
    icon: Image,
    color: "from-primary/20 to-chart-3/5 border-primary/20",
    iconColor: "text-primary",
    placeholder: "Tema do carrossel, público-alvo, objetivo...",
    roles: ["sdr", "closer"],
  },
  {
    id: "linkedin-comments",
    label: "Comentários LinkedIn",
    description: "Comentários estratégicos que geram conexões",
    icon: PenLine,
    color: "from-chart-4/20 to-primary/5 border-chart-4/20",
    iconColor: "text-chart-4",
    placeholder: "Cole o post do LinkedIn que quer comentar...",
    roles: ["sdr", "closer"],
  },
  {
    id: "linkedin-posts",
    label: "Posts de Frases",
    description: "Frases impactantes para LinkedIn",
    icon: PenLine,
    color: "from-accent/20 to-chart-3/5 border-accent/20",
    iconColor: "text-accent",
    placeholder: "Tema, tom de voz, objetivo do post...",
    roles: ["sdr", "closer"],
  },
  {
    id: "sales-score",
    label: "Nota do Setor",
    description: "Análise e nota do seu desempenho",
    icon: BarChart3,
    color: "from-chart-5/20 to-chart-4/5 border-chart-5/20",
    iconColor: "text-chart-5",
    placeholder: "Peça uma análise do seu desempenho atual...",
    roles: ["sdr", "closer"],
  },
  {
    id: "followup-sticker",
    label: "Figurinhas Follow-up",
    description: "Mensagens criativas para follow-up",
    icon: Smile,
    color: "from-chart-4/20 to-accent/5 border-chart-4/20",
    iconColor: "text-chart-4",
    placeholder: "Descreva o contexto do follow-up, prospect...",
    roles: ["sdr", "closer"],
  },
];

export function AiToolsPanel({ memberId, memberRole }: AiToolsPanelProps) {
  const [activeTool, setActiveTool] = useState<string | null>(null);

  const visibleTools = AI_TOOLS.filter((t) => t.roles.includes(memberRole));
  const currentTool = visibleTools.find((t) => t.id === activeTool);

  if (currentTool) {
    return (
      <div className="h-full flex flex-col">
        <button
          onClick={() => setActiveTool(null)}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors px-4 py-3 border-b border-border"
        >
          <ArrowLeft size={14} />
          <span>Voltar às ferramentas</span>
        </button>
        <div className="flex items-center gap-2 px-4 py-2 border-b border-border bg-secondary/30">
          <currentTool.icon size={14} className={currentTool.iconColor} />
          <span className="text-xs font-bold text-foreground">{currentTool.label}</span>
        </div>
        <div className="flex-1">
          <AiChat
            memberId={memberId}
            tool={currentTool.id}
            placeholder={currentTool.placeholder}
            compact
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {visibleTools.map((tool) => (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id)}
            className={cn(
              "rounded-xl border bg-gradient-to-br p-3.5 text-left transition-all hover:scale-[1.02] hover:shadow-lg group",
              tool.color
            )}
          >
            <div className={cn("w-8 h-8 rounded-lg bg-card/50 flex items-center justify-center mb-2", tool.iconColor)}>
              <tool.icon size={16} />
            </div>
            <p className="text-[11px] font-bold text-foreground leading-tight">{tool.label}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">{tool.description}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
