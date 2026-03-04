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

const SDR_KEYS = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada"];
const CLOSER_KEYS = ["lig_realizada", "reuniao_agendada", "reuniao_realizada"];

interface KpiGridProps {
  totals: Record<string, number>;
  goals: Record<string, number> | null;
  previousTotals?: Record<string, number>;
  onCardClick?: (metricKey: string) => void;
  compact?: boolean;
}

export function KpiGrid({ totals, goals, previousTotals, onCardClick, compact = false }: KpiGridProps) {
  if (compact) {
    return (
      <div className="flex gap-3 items-stretch">
        {/* SDR Panel */}
        <div className="flex-1 rounded-xl p-2.5 bg-[hsl(var(--panel-sdr))] border border-[hsl(217,40%,18%)] border-l-[3px] border-l-[hsl(var(--panel-sdr-accent))]">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[8px] font-bold uppercase tracking-widest text-primary-foreground bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">SDR</span>
            <div className="flex-1 h-px bg-primary/20" />
          </div>
          <div className="grid grid-cols-7 gap-1.5">
            {SDR_KEYS.map(key => (
              <CompactCard key={key} metricKey={key} val={totals[key] || 0} goal={goals ? (goals as any)[key] || 0 : 0} onCardClick={onCardClick} variant="sdr" />
            ))}
          </div>
        </div>

        {/* Closer Panel */}
        <div className="rounded-xl p-2.5 bg-[hsl(var(--panel-closer))] border border-[hsl(280,30%,18%)] border-l-[3px] border-l-[hsl(var(--panel-closer-accent))]" style={{ flex: '0 0 auto', width: '30%' }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[8px] font-bold uppercase tracking-widest text-[hsl(280,65%,80%)] bg-[hsl(280,65%,60%/0.15)] px-2 py-0.5 rounded-full border border-[hsl(280,65%,60%/0.3)]">CLOSER</span>
            <div className="flex-1 h-px bg-[hsl(280,65%,60%/0.2)]" />
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {CLOSER_KEYS.map(key => (
              <CompactCard key={key} metricKey={key} val={totals[key] || 0} goal={goals ? (goals as any)[key] || 0 : 0} onCardClick={onCardClick} variant="closer" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Non-compact layout
  return (
    <div className="flex flex-col gap-4">
      {/* SDR Panel */}
      <div className="rounded-xl p-4 bg-[hsl(var(--panel-sdr))] border border-[hsl(217,40%,18%)] border-l-[3px] border-l-[hsl(var(--panel-sdr-accent))]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-primary-foreground bg-primary/20 px-2.5 py-0.5 rounded-full border border-primary/30">Métricas SDR</span>
          <div className="flex-1 h-px bg-primary/20" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
          {SDR_KEYS.map(key => (
            <FullCard key={key} metricKey={key} val={totals[key] || 0} goal={goals ? (goals as any)[key] || 0 : 0} prevVal={previousTotals?.[key] || 0} onCardClick={onCardClick} />
          ))}
        </div>
      </div>

      {/* Closer Panel */}
      <div className="rounded-xl p-4 bg-[hsl(var(--panel-closer))] border border-[hsl(280,30%,18%)] border-l-[3px] border-l-[hsl(var(--panel-closer-accent))]">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-bold uppercase tracking-widest text-[hsl(280,65%,80%)] bg-[hsl(280,65%,60%/0.15)] px-2.5 py-0.5 rounded-full border border-[hsl(280,65%,60%/0.3)]">Métricas Closer</span>
          <div className="flex-1 h-px bg-[hsl(280,65%,60%/0.2)]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {CLOSER_KEYS.map(key => (
            <FullCard key={key} metricKey={key} val={totals[key] || 0} goal={goals ? (goals as any)[key] || 0 : 0} prevVal={previousTotals?.[key] || 0} onCardClick={onCardClick} variant="closer" />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ---- Compact ring card ---- */
function CompactCard({ metricKey, val, goal, onCardClick, variant = "sdr" }: { metricKey: string; val: number; goal: number; onCardClick?: (k: string) => void; variant?: "sdr" | "closer" }) {
  const ringSize = 68;
  const strokeWidth = 4.5;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
  const isGood = pct >= 80;
  const isMid = pct >= 40;

  const getColor = () => {
    if (variant === "closer") {
      return { class: isGood ? "text-[hsl(280,65%,65%)]" : isMid ? "text-[hsl(280,50%,50%)]" : "text-[hsl(280,40%,40%)]", stroke: isGood ? "hsl(280,65%,65%)" : isMid ? "hsl(280,50%,50%)" : "hsl(280,40%,40%)" };
    }
    return { class: isGood ? "text-accent" : isMid ? "text-[hsl(38,92%,50%)]" : "text-destructive", stroke: isGood ? "hsl(var(--accent))" : isMid ? "hsl(38,92%,50%)" : "hsl(var(--destructive))" };
  };

  const { class: colorClass, stroke: strokeColor } = getColor();
  const dashOffset = circumference - (Math.min(pct, 100) / 100) * circumference;
  const isZero = val === 0 && goal === 0;

  return (
    <div onClick={() => onCardClick?.(metricKey)} className={cn("group flex flex-col items-center gap-0.5", onCardClick && "cursor-pointer", isZero && "opacity-40")}>
      <span className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight text-center truncate w-full">
        {SHORT_LABELS[metricKey]}
      </span>
      <div className="aspect-square w-full rounded-lg border border-border bg-card flex items-center justify-center hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_15px_-5px_hsl(var(--primary)/0.15)] hover:scale-110 hover:z-10 relative overflow-hidden" style={{ transitionDelay: '70ms' }}>
        {goal > 0 ? (
          <div className="relative flex items-center justify-center w-[90%] h-[90%]">
            <svg viewBox={`0 0 ${ringSize} ${ringSize}`} className="-rotate-90 w-full h-full">
              <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke="hsl(var(--secondary))" strokeWidth={strokeWidth} />
              <circle cx={ringSize / 2} cy={ringSize / 2} r={radius} fill="none" stroke={strokeColor} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-700" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="flex items-baseline gap-px">
                <span className="text-[15px] font-black tabular-nums text-card-foreground leading-none">{val.toLocaleString("pt-BR")}</span>
                <span className="text-[10px] font-medium text-muted-foreground leading-none">/{goal.toLocaleString("pt-BR")}</span>
              </div>
              <span className={cn("text-[9px] font-bold tabular-nums leading-none mt-0.5", colorClass)}>{pct}%</span>
            </div>
          </div>
        ) : (
          <span className="text-xl font-black tabular-nums text-card-foreground leading-none">{val.toLocaleString("pt-BR")}</span>
        )}
      </div>
    </div>
  );
}

/* ---- Full-size card ---- */
function FullCard({ metricKey, val, goal, prevVal, onCardClick, variant = "sdr" }: { metricKey: string; val: number; goal: number; prevVal: number; onCardClick?: (k: string) => void; variant?: "sdr" | "closer" }) {
  const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
  const isGood = pct >= 80;
  const isMid = pct >= 40;
  const trendPct = prevVal > 0 ? Math.round(((val - prevVal) / prevVal) * 100) : 0;
  const trendUp = trendPct > 0;
  const trendDown = trendPct < 0;

  const barColor = variant === "closer"
    ? (isGood ? "bg-[hsl(280,65%,65%)]" : isMid ? "bg-[hsl(280,50%,50%)]" : "bg-[hsl(280,40%,40%)]")
    : (isGood ? "bg-accent" : isMid ? "bg-[hsl(38,92%,50%)]" : "bg-destructive");

  const pctColor = variant === "closer"
    ? (isGood ? "text-[hsl(280,65%,65%)]" : isMid ? "text-[hsl(280,50%,50%)]" : "text-[hsl(280,40%,40%)]")
    : (isGood ? "text-accent" : isMid ? "text-[hsl(38,92%,50%)]" : "text-destructive");

  return (
    <div onClick={() => onCardClick?.(metricKey)} className={cn("group rounded-xl border border-border bg-card p-4 flex flex-col gap-2 hover:border-primary/30 transition-all duration-300 hover:shadow-[0_0_20px_-5px_hsl(var(--primary)/0.15)] hover:scale-105 hover:z-10", onCardClick && "cursor-pointer")} style={{ transitionDelay: '70ms' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{METRIC_LABELS[metricKey]}</span>
        <span className="text-muted-foreground opacity-50 group-hover:opacity-100 transition-opacity">{ICONS[metricKey]}</span>
      </div>
      <div className="flex items-end gap-1.5">
        <span className="text-2xl font-bold tabular-nums text-card-foreground leading-none">{val.toLocaleString("pt-BR")}</span>
        {goal > 0 && <span className="text-[10px] text-muted-foreground mb-0.5">/ {goal.toLocaleString("pt-BR")}</span>}
      </div>
      {prevVal > 0 && (
        <div className={cn("flex items-center gap-1 text-[10px] font-semibold", trendUp ? "text-accent" : trendDown ? "text-destructive" : "text-muted-foreground")}>
          {trendUp ? <TrendingUp size={10} /> : trendDown ? <TrendingDown size={10} /> : <Minus size={10} />}
          <span>{trendUp ? "+" : ""}{trendPct}% vs anterior</span>
        </div>
      )}
      {goal > 0 && (
        <>
          <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className={cn("h-full rounded-full transition-all duration-700", barColor)} style={{ width: `${Math.min(pct, 100)}%` }} />
          </div>
          <span className={cn("text-[10px] font-bold tabular-nums", pctColor)}>{pct}%</span>
        </>
      )}
    </div>
  );
}
