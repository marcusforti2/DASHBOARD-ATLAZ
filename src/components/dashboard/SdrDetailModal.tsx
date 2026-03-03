import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METRIC_LABELS, METRIC_KEYS, DbDailyMetric, DbTeamMember, sumMetrics, getMemberAvatar } from "@/lib/db";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CalendarRange, Calendar as CalendarIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface WeekInfo {
  weekNumber: number;
  startDate: string;
  endDate: string;
  label: string;
}

interface SdrDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: DbTeamMember | null;
  memberIndex: number;
  allMetrics: DbDailyMetric[]; // all metrics for the month (unfiltered)
  weeksOfMonth: WeekInfo[];
  monthLabel?: string;
  /** Goals per metric for the member, keyed by period */
  getGoalsForPeriod: (period: "month" | "week" | "day", weekIdx: number, date: Date) => Record<string, number> | null;
}

type Period = "month" | "week" | "day";

export function SdrDetailModal({
  open,
  onOpenChange,
  member,
  memberIndex,
  allMetrics,
  weeksOfMonth,
  monthLabel,
  getGoalsForPeriod,
}: SdrDetailModalProps) {
  const [period, setPeriod] = useState<Period>("day");
  const [weekIdx, setWeekIdx] = useState<number>(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const idx = weeksOfMonth.findIndex(w => today >= w.startDate && today <= w.endDate);
    return idx >= 0 ? idx : 0;
  });
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

  const avatar = member ? getMemberAvatar(member, memberIndex) : "";

  // Filter metrics for this member
  const memberMetrics = useMemo(() => {
    if (!member) return [];
    return allMetrics.filter(d => d.member_id === member.id);
  }, [allMetrics, member?.id]);

  // Period-filtered metrics
  const filteredMetrics = useMemo(() => {
    if (period === "month") return memberMetrics;
    if (period === "week" && weeksOfMonth[weekIdx]) {
      const w = weeksOfMonth[weekIdx];
      return memberMetrics.filter(d => d.date >= w.startDate && d.date <= w.endDate);
    }
    return memberMetrics.filter(d => d.date === selectedDate);
  }, [memberMetrics, period, weekIdx, weeksOfMonth, selectedDate]);

  const totals = useMemo(() => sumMetrics(filteredMetrics), [filteredMetrics]);
  const goals = useMemo(
    () => getGoalsForPeriod(period, weekIdx, new Date(selectedDate)),
    [getGoalsForPeriod, period, weekIdx, selectedDate]
  );
  const grandTotal = METRIC_KEYS.reduce((s, k) => s + (totals[k] || 0), 0);

  // Daily breakdown for the selected period
  const dailyBreakdown = useMemo(() => {
    if (period === "day") return [];
    const dates = [...new Set(filteredMetrics.map(d => d.date))].sort();
    return dates.map(date => {
      const entry = filteredMetrics.find(d => d.date === date);
      const dayTotal = entry ? METRIC_KEYS.reduce((s, k) => s + ((entry as any)[k] || 0), 0) : 0;
      return { date, entry, dayTotal };
    });
  }, [filteredMetrics, period]);

  const periodLabel =
    period === "month" ? monthLabel :
    period === "week" && weeksOfMonth[weekIdx] ? `Semana ${weeksOfMonth[weekIdx].weekNumber} — ${weeksOfMonth[weekIdx].label}` :
    format(new Date(selectedDate), "EEEE, dd 'de' MMMM", { locale: ptBR });

  // Dates available for day picker
  const availableDates = useMemo(() => {
    return [...new Set(memberMetrics.map(d => d.date))].sort();
  }, [memberMetrics]);

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border p-0 overflow-hidden gap-0">
        {/* Header with avatar */}
        <div className="px-5 pt-5 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-sm font-bold text-card-foreground">
              <img
                src={avatar}
                alt={member.name}
                className="w-10 h-10 rounded-xl object-cover border-2 border-primary/30"
              />
              <div className="min-w-0">
                <span className="block truncate text-base">{member.name}</span>
                <span className="text-[10px] font-medium text-muted-foreground capitalize">{periodLabel}</span>
              </div>
              <span className="ml-auto text-2xl font-black tabular-nums text-card-foreground">{grandTotal}</span>
            </DialogTitle>
          </DialogHeader>

          {/* Period filter */}
          <div className="flex items-center gap-1.5 mt-3">
            {([
              { key: "day" as Period, label: "Dia", icon: CalendarDays },
              { key: "week" as Period, label: "Semana", icon: CalendarRange },
              { key: "month" as Period, label: "Mês", icon: CalendarIcon },
            ]).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors",
                  period === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                <Icon size={11} /> {label}
              </button>
            ))}

            {/* Week selector */}
            {period === "week" && (
              <select
                value={weekIdx}
                onChange={e => setWeekIdx(Number(e.target.value))}
                className="ml-1.5 appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-2.5 py-1.5 pr-6 rounded-lg border border-border cursor-pointer outline-none"
              >
                {weeksOfMonth.map((w, i) => (
                  <option key={i} value={i}>Sem {w.weekNumber}</option>
                ))}
              </select>
            )}

            {/* Day selector */}
            {period === "day" && (
              <select
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="ml-1.5 appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-2.5 py-1.5 pr-6 rounded-lg border border-border cursor-pointer outline-none"
              >
                {availableDates.map(d => (
                  <option key={d} value={d}>
                    {format(new Date(d), "dd/MM (EEE)", { locale: ptBR })}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Metrics grid */}
        <div className="px-5 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {METRIC_KEYS.map((k, idx) => {
              const val = totals[k] || 0;
              const goal = goals?.[k] || 0;
              const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
              const isGood = pct >= 80;
              const isMid = pct >= 40;

              return (
                <div
                  key={k}
                  className={cn(
                    "rounded-lg border px-3 py-2.5 transition-all animate-fade-in opacity-0 fill-mode-forwards",
                    val > 0 ? "border-border bg-secondary/30" : "border-border/40 bg-secondary/10 opacity-50"
                  )}
                  style={{ animationDelay: `${idx * 40}ms` }}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                      {METRIC_LABELS[k]}
                    </span>
                    {goal > 0 && (
                      <span className={cn(
                        "text-[9px] font-bold px-1 py-px rounded tabular-nums",
                        isGood ? "bg-accent/15 text-accent" :
                        isMid ? "bg-primary/15 text-primary" :
                        "bg-destructive/15 text-destructive"
                      )}>
                        {pct}%
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className={cn(
                      "text-lg font-black tabular-nums leading-none",
                      val > 0 ? "text-card-foreground" : "text-muted-foreground/40"
                    )}>
                      {val}
                    </span>
                    {goal > 0 && (
                      <span className="text-[10px] text-muted-foreground">/ {goal}</span>
                    )}
                  </div>
                  {goal > 0 && (
                    <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mt-1.5">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-500",
                          isGood ? "bg-accent" : isMid ? "bg-primary" : "bg-destructive"
                        )}
                        style={{ width: `${Math.min(pct, 100)}%` }}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Daily breakdown table (for week/month) */}
          {dailyBreakdown.length > 0 && (
            <div className="mt-2">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Dia a dia</span>
              <div className="mt-1.5 max-h-[180px] overflow-y-auto rounded-lg border border-border">
                <table className="w-full text-[10px]">
                  <thead className="sticky top-0 bg-card">
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold">Data</th>
                      {METRIC_KEYS.map(k => (
                        <th key={k} className="text-right py-1.5 px-1 text-muted-foreground font-semibold whitespace-nowrap">
                          {METRIC_LABELS[k].substring(0, 5)}
                        </th>
                      ))}
                      <th className="text-right py-1.5 px-2 text-muted-foreground font-semibold">Tot</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyBreakdown.map(({ date, entry, dayTotal }) => (
                      <tr key={date} className="border-b border-border/30 hover:bg-secondary/20">
                        <td className="py-1.5 px-2 text-card-foreground font-mono whitespace-nowrap">
                          {format(new Date(date), "dd/MM EEE", { locale: ptBR })}
                        </td>
                        {METRIC_KEYS.map(k => {
                          const v = entry ? (entry as any)[k] || 0 : 0;
                          return (
                            <td key={k} className={cn(
                              "text-right py-1.5 px-1 tabular-nums",
                              v > 0 ? "text-card-foreground" : "text-muted-foreground/30"
                            )}>
                              {v}
                            </td>
                          );
                        })}
                        <td className="text-right py-1.5 px-2 tabular-nums font-bold text-card-foreground">{dayTotal}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
