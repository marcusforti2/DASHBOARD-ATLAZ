import { cn } from "@/lib/utils";
import { METRIC_LABELS } from "@/lib/db";
import { Link, UserCheck, MessageSquare, Mail, Target, Phone, PhoneCall, Calendar, CalendarCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";

const ICONS: Record<string, React.ReactNode> = {
  conexoes: <Link size={13} />,
  conexoes_aceitas: <UserCheck size={13} />,
  abordagens: <MessageSquare size={13} />,
  inmail: <Mail size={13} />,
  follow_up: <Target size={13} />,
  numero: <Phone size={13} />,
  lig_agendada: <PhoneCall size={13} />,
  lig_realizada: <PhoneCall size={13} />,
  reuniao_agendada: <Calendar size={13} />,
  reuniao_realizada: <CalendarCheck size={13} />,
};

// Short labels for compact mode
const SHORT_LABELS: Record<string, string> = {
  conexoes: "Conexões",
  conexoes_aceitas: "Aceitas",
  abordagens: "Abordagens",
  inmail: "InMail",
  follow_up: "Follow Up",
  numero: "Número",
  lig_agendada: "Lig. Agend.",
  lig_realizada: "Lig. Realiz.",
  reuniao_agendada: "Reun. Agend.",
  reuniao_realizada: "Reun. Realiz.",
};

interface KpiGridProps {
  totals: Record<string, number>;
  goals: Record<string, number> | null;
  previousTotals?: Record<string, number>;
  onCardClick?: (metricKey: string) => void;
  compact?: boolean;
}

export function KpiGrid({ totals, goals, previousTotals, onCardClick, compact = false }: KpiGridProps) {
  const keys = Object.keys(METRIC_LABELS);

  if (compact) {
    const ringSize = 38;
    const strokeWidth = 3;
    const radius = (ringSize - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    return (
      <div className="grid grid-cols-5 lg:grid-cols-10 gap-1.5">
        {keys.map(key => {
          const val = totals[key] || 0;
          const goal = goals ? (goals as any)[key] || 0 : 0;
          const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
          const isGood = pct >= 80;
          const isMid = pct >= 40;
          const colorClass = isGood ? "text-accent" : isMid ? "text-[hsl(38,92%,50%)]" : "text-destructive";
          const strokeColor = isGood ? "hsl(var(--accent))" : isMid ? "hsl(38,92%,50%)" : "hsl(var(--destructive))";
          const dashOffset = circumference - (Math.min(pct, 100) / 100) * circumference;

          const prevVal = previousTotals?.[key] || 0;
          const trendPct = prevVal > 0 ? Math.round(((val - prevVal) / prevVal) * 100) : 0;
          const trendUp = trendPct > 0;
          const trendDown = trendPct < 0;

          return (
            <div
              key={key}
              onClick={() => onCardClick?.(key)}
              className={cn(
                "group rounded-lg border border-border bg-card p-2 flex flex-col items-center text-center gap-0.5 hover:border-primary/30 transition-all hover:shadow-[0_0_15px_-5px_hsl(var(--primary)/0.15)]",
                onCardClick && "cursor-pointer"
              )}
            >
              <span className="text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity">
                {ICONS[key]}
              </span>
              <span className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                {SHORT_LABELS[key]}
              </span>

              {goal > 0 ? (
                <>
                  <div className="relative flex items-center justify-center" style={{ width: ringSize, height: ringSize }}>
                    <svg width={ringSize} height={ringSize} className="-rotate-90">
                      <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} />
                      <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-700" />
                    </svg>
                    <div className="absolute flex items-baseline gap-px">
                      <span className="text-[11px] font-black tabular-nums text-card-foreground leading-none">
                        {val.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[7px] font-semibold text-muted-foreground leading-none">/{goal.toLocaleString("pt-BR")}</span>
                    </div>
                  </div>
                  <span className={cn("text-[8px] font-bold tabular-nums leading-none", colorClass)}>
                    {pct}%
                  </span>
                </>
              ) : (
                <span className="text-lg font-black tabular-nums text-card-foreground leading-none my-1">
                  {val.toLocaleString("pt-BR")}
                </span>
              )}

            </div>
          );
        })}
      </div>
    );
  }

  // Original non-compact layout
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {keys.map(key => {
        const val = totals[key] || 0;
        const goal = goals ? (goals as any)[key] || 0 : 0;
        const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
        const isGood = pct >= 80;
        const isMid = pct >= 40;

        const prevVal = previousTotals?.[key] || 0;
        const trendPct = prevVal > 0 ? Math.round(((val - prevVal) / prevVal) * 100) : 0;
        const trendUp = trendPct > 0;
        const trendDown = trendPct < 0;

        return (
          <div key={key} onClick={() => onCardClick?.(key)} className={cn("group rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-all hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.15)]", onCardClick && "cursor-pointer")}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                {METRIC_LABELS[key]}
              </span>
              <span className="text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">
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

            {previousTotals && prevVal > 0 && (
              <div className={cn(
                "flex items-center gap-1 text-[10px] font-semibold",
                trendUp ? "text-accent" : trendDown ? "text-destructive" : "text-muted-foreground"
              )}>
                {trendUp ? <TrendingUp size={10} /> : trendDown ? <TrendingDown size={10} /> : <Minus size={10} />}
                <span>{trendUp ? "+" : ""}{trendPct}% vs anterior</span>
              </div>
            )}

            {goal > 0 && (
              <>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
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