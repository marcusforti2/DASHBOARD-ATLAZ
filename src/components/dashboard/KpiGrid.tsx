import { cn } from "@/lib/utils";
import { METRIC_LABELS } from "@/lib/db";
import { Link, UserCheck, MessageSquare, Mail, Target, Phone, PhoneCall, Calendar, CalendarCheck } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  conexoes: <Link size={15} />,
  conexoes_aceitas: <UserCheck size={15} />,
  abordagens: <MessageSquare size={15} />,
  inmail: <Mail size={15} />,
  follow_up: <Target size={15} />,
  numero: <Phone size={15} />,
  lig_agendada: <PhoneCall size={15} />,
  lig_realizada: <PhoneCall size={15} />,
  reuniao_agendada: <Calendar size={15} />,
  reuniao_realizada: <CalendarCheck size={15} />,
};

interface KpiGridProps {
  totals: Record<string, number>;
  goals: Record<string, number> | null;
}

export function KpiGrid({ totals, goals }: KpiGridProps) {
  const keys = Object.keys(METRIC_LABELS);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {keys.map(key => {
        const val = totals[key] || 0;
        const goal = goals ? (goals as any)[key] || 0 : 0;
        const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
        const isGood = pct >= 80;
        const isMid = pct >= 40;

        return (
          <div key={key} className="group rounded-xl border border-border bg-card p-4 flex flex-col gap-2.5 hover:border-primary/30 transition-colors">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {METRIC_LABELS[key]}
              </span>
              <span className="text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity">
                {ICONS[key]}
              </span>
            </div>
            <div className="flex items-end gap-1.5">
              <span className="text-2xl font-bold tabular-nums text-card-foreground leading-none">
                {val.toLocaleString("pt-BR")}
              </span>
              {goal > 0 && (
                <span className="text-[10px] text-muted-foreground mb-0.5">/ {goal.toLocaleString("pt-BR")}</span>
              )}
            </div>
            {goal > 0 && (
              <>
                <div className="w-full h-1 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      isGood ? "bg-accent" : isMid ? "bg-[hsl(38,92%,50%)]" : "bg-destructive"
                    )}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
                <span className={cn(
                  "text-[10px] font-bold tabular-nums",
                  isGood ? "text-accent" : isMid ? "text-[hsl(38,92%,50%)]" : "text-destructive"
                )}>
                  {pct}%
                </span>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
