import { useState, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METRIC_LABELS, METRIC_KEYS, DbDailyMetric, DbTeamMember, sumMetrics, getMemberAvatar } from "@/lib/db";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, CalendarRange, Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";

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
  allMetrics: DbDailyMetric[];
  weeksOfMonth: WeekInfo[];
  monthLabel?: string;
  initialDate?: string; // yyyy-MM-dd to sync with parent
  getGoalsForPeriod: (period: "month" | "week" | "day", weekIdx: number, date: Date) => Record<string, number> | null;
}

type Period = "month" | "week" | "day";

const PERIOD_OPTIONS: { key: Period; label: string; icon: typeof CalendarDays }[] = [
  { key: "day", label: "Dia", icon: CalendarDays },
  { key: "week", label: "Semana", icon: CalendarRange },
  { key: "month", label: "Mês", icon: CalendarIcon },
];

export function SdrDetailModal({
  open,
  onOpenChange,
  member,
  memberIndex,
  allMetrics,
  weeksOfMonth,
  monthLabel,
  initialDate,
  getGoalsForPeriod,
}: SdrDetailModalProps) {
  const initDate = initialDate || format(new Date(), "yyyy-MM-dd");

  const [period, setPeriod] = useState<Period>("day");
  const [weekIdx, setWeekIdx] = useState<number>(() => {
    const idx = weeksOfMonth.findIndex(w => initDate >= w.startDate && initDate <= w.endDate);
    return idx >= 0 ? idx : 0;
  });
  const [selectedDate, setSelectedDate] = useState<string>(initDate);

  const avatar = member ? getMemberAvatar(member, memberIndex) : "";

  const memberMetrics = useMemo(() => {
    if (!member) return [];
    return allMetrics.filter(d => d.member_id === member.id);
  }, [allMetrics, member?.id]);

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
    () => getGoalsForPeriod(period, weekIdx, new Date(selectedDate + "T12:00:00")),
    [getGoalsForPeriod, period, weekIdx, selectedDate]
  );
  const grandTotal = METRIC_KEYS.reduce((s, k) => s + (totals[k] || 0), 0);

  const availableDates = useMemo(() => {
    return [...new Set(memberMetrics.map(d => d.date))].sort();
  }, [memberMetrics]);

  // Navigation helpers
  const navigateDay = useCallback((dir: 1 | -1) => {
    const idx = availableDates.indexOf(selectedDate);
    const next = idx + dir;
    if (next >= 0 && next < availableDates.length) setSelectedDate(availableDates[next]);
  }, [availableDates, selectedDate]);

  const navigateWeek = useCallback((dir: 1 | -1) => {
    const next = weekIdx + dir;
    if (next >= 0 && next < weeksOfMonth.length) setWeekIdx(next);
  }, [weekIdx, weeksOfMonth.length]);

  // Daily breakdown for week/month
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
    period === "week" && weeksOfMonth[weekIdx] ? `Sem ${weeksOfMonth[weekIdx].weekNumber} · ${weeksOfMonth[weekIdx].label}` :
    format(new Date(selectedDate + "T12:00:00"), "EEE, dd/MM", { locale: ptBR });

  if (!member) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-card border-border p-0 overflow-hidden gap-0">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-sm font-bold text-card-foreground">
              <img
                src={avatar}
                alt={member.name}
                className="w-9 h-9 rounded-lg object-cover border border-primary/30 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold">{member.name}</span>
                <span className="text-[10px] text-muted-foreground capitalize">{periodLabel}</span>
              </div>
              <div className="text-right shrink-0">
                <span className="block text-xl font-black tabular-nums leading-none">{grandTotal}</span>
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">total</span>
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Period tabs + navigation */}
          <div className="flex items-center gap-1 mt-2.5">
            {PERIOD_OPTIONS.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setPeriod(key)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1 text-[9px] rounded-md font-bold uppercase tracking-wider transition-colors",
                  period === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/60 text-muted-foreground hover:text-card-foreground"
                )}
              >
                <Icon size={10} /> {label}
              </button>
            ))}

            <div className="flex-1" />

            {/* Period-specific nav */}
            {period === "day" && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => navigateDay(-1)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ChevronLeft size={12} /></button>
                <select
                  value={selectedDate}
                  onChange={e => setSelectedDate(e.target.value)}
                  className="appearance-none bg-secondary/60 text-card-foreground text-[9px] font-semibold px-1.5 py-1 rounded-md border-none outline-none cursor-pointer"
                >
                  {availableDates.map(d => (
                    <option key={d} value={d}>{format(new Date(d + "T12:00:00"), "dd/MM (EEE)", { locale: ptBR })}</option>
                  ))}
                </select>
                <button onClick={() => navigateDay(1)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ChevronRight size={12} /></button>
              </div>
            )}
            {period === "week" && (
              <div className="flex items-center gap-0.5">
                <button onClick={() => navigateWeek(-1)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ChevronLeft size={12} /></button>
                <select
                  value={weekIdx}
                  onChange={e => setWeekIdx(Number(e.target.value))}
                  className="appearance-none bg-secondary/60 text-card-foreground text-[9px] font-semibold px-1.5 py-1 rounded-md border-none outline-none cursor-pointer"
                >
                  {weeksOfMonth.map((w, i) => (
                    <option key={i} value={i}>Sem {w.weekNumber}</option>
                  ))}
                </select>
                <button onClick={() => navigateWeek(1)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><ChevronRight size={12} /></button>
              </div>
            )}
          </div>
        </div>

        {/* Metrics — compact table-style */}
        <div className="px-4 py-3">
          <div className="rounded-lg border border-border overflow-hidden">
            {METRIC_KEYS.map((k, idx) => {
              const val = totals[k] || 0;
              const goal = goals?.[k] || 0;
              const pct = goal > 0 ? Math.round((val / goal) * 100) : 0;
              const isGood = pct >= 80;
              const isMid = pct >= 40;
              const hasData = val > 0 || goal > 0;

              return (
                <div
                  key={k}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5",
                    idx < METRIC_KEYS.length - 1 && "border-b border-border/40",
                    !hasData && "opacity-30"
                  )}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground w-24 truncate uppercase tracking-wider">
                    {METRIC_LABELS[k]}
                  </span>
                  <div className="flex-1 flex items-center gap-2 min-w-0">
                    {/* Mini progress bar */}
                    {goal > 0 && (
                      <div className="flex-1 h-1 rounded-full bg-secondary/60 overflow-hidden max-w-[80px]">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            isGood ? "bg-accent" : isMid ? "bg-[hsl(38,92%,50%)]" : "bg-destructive"
                          )}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={cn(
                      "text-sm font-bold tabular-nums",
                      val > 0 ? "text-card-foreground" : "text-muted-foreground/40"
                    )}>
                      {val}
                    </span>
                    {goal > 0 && (
                      <>
                        <span className="text-[9px] text-muted-foreground">/{goal}</span>
                        <span className={cn(
                          "text-[8px] font-bold px-1 py-px rounded tabular-nums min-w-[28px] text-center",
                          isGood ? "bg-accent/15 text-accent" :
                          isMid ? "bg-[hsl(38,92%,50%)]/15 text-[hsl(38,92%,50%)]" :
                          "bg-destructive/15 text-destructive"
                        )}>
                          {pct}%
                        </span>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Daily breakdown (week/month only) */}
        {dailyBreakdown.length > 0 && (
          <div className="px-4 pb-3">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">Dia a dia</span>
            <div className="mt-1 max-h-[150px] overflow-y-auto rounded-lg border border-border">
              <table className="w-full text-[9px]">
                <thead className="sticky top-0 bg-card z-10">
                  <tr className="border-b border-border">
                    <th className="text-left py-1 px-2 text-muted-foreground font-semibold">Data</th>
                    {METRIC_KEYS.map(k => (
                      <th key={k} className="text-right py-1 px-0.5 text-muted-foreground font-semibold">
                        {METRIC_LABELS[k].substring(0, 3)}
                      </th>
                    ))}
                    <th className="text-right py-1 px-2 text-muted-foreground font-semibold">∑</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.map(({ date, entry, dayTotal }) => (
                    <tr key={date} className="border-b border-border/20 hover:bg-secondary/20">
                      <td className="py-1 px-2 text-card-foreground font-mono whitespace-nowrap">
                        {format(new Date(date + "T12:00:00"), "dd/MM", { locale: ptBR })}
                      </td>
                      {METRIC_KEYS.map(k => {
                        const v = entry ? (entry as any)[k] || 0 : 0;
                        return (
                          <td key={k} className={cn(
                            "text-right py-1 px-0.5 tabular-nums",
                            v > 0 ? "text-card-foreground" : "text-muted-foreground/20"
                          )}>
                            {v}
                          </td>
                        );
                      })}
                      <td className="text-right py-1 px-2 tabular-nums font-bold text-card-foreground">{dayTotal}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
