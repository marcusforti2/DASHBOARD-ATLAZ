import { useState } from "react";
import { ChevronLeft, FileCheck, ArrowRight, Rocket, Target, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SalesScriptProcess } from "./SalesScriptProcess";
import { FadeIn } from "./FadeIn";

interface ProcessesHubProps {
  onBack: () => void;
}

interface ProcessItem {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  accentColor: string;
  component: React.ComponentType<{ onBack: () => void }>;
}

const PROCESSES: ProcessItem[] = [
  {
    id: "sales-script",
    title: "Script de Vendas",
    description: "Playbook completo para fechar vendas de alto ticket — da preparação ao pós-pagamento.",
    icon: Target,
    accentColor: "primary",
    component: SalesScriptProcess,
  },
  // Adicione mais processos aqui no futuro
];

export function ProcessesHub({ onBack }: ProcessesHubProps) {
  const [activeProcess, setActiveProcess] = useState<string | null>(null);

  const active = PROCESSES.find(p => p.id === activeProcess);

  if (active) {
    const Component = active.component;
    return <Component onBack={() => setActiveProcess(null)} />;
  }

  return (
    <div className="space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft size={14} /> Voltar à Central
      </button>

      <div className="flex items-center gap-2 mb-2">
        <FileCheck size={18} className="text-accent" />
        <h2 className="text-sm font-bold text-foreground">Processos Validados</h2>
        <Badge variant="outline" className="text-[9px]">{PROCESSES.length}</Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PROCESSES.map((process, idx) => {
          const Icon = process.icon;
          return (
            <FadeIn key={process.id} delay={idx * 0.05}>
              <button
                onClick={() => setActiveProcess(process.id)}
                className="group relative overflow-hidden rounded-xl border border-border bg-card hover:border-primary/40 transition-all text-left w-full"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-primary/15 transition-all duration-300">
                      <Icon size={22} className="text-primary" />
                    </div>
                    <ArrowRight size={16} className="text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 mt-2" />
                  </div>
                  <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors mb-1.5">
                    {process.title}
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-relaxed">
                    {process.description}
                  </p>
                </div>
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-primary/50 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            </FadeIn>
          );
        })}
      </div>
    </div>
  );
}
