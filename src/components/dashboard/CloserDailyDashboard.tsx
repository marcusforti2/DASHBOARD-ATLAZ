import { useMemo } from "react";
import { useMonths, useDailyMetrics, useWeeklyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, sumMetrics } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, CheckCircle2, Loader2 } from "lucide-react";

interface CloserDailyDashboardProps {
  teamMemberId: string;
  memberName: string;
}

export function CloserDailyDashboard({ teamMemberId, memberName }: CloserDailyDashboardProps) {
  const { data: months } = useMonths();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);

  const { data: dailyMetrics, isLoading: metricsLoading } = useDailyMetrics(currentMonth?.id);
  const { data: weeklyGoals } = useWeeklyGoals(currentMonth?.id, teamMemberId);

  // Find current week goal
  const currentWeekGoal = useMemo(() => {
    if (!weeklyGoals?.length) return null;
    // Find the week that contains today
    return weeklyGoals.find(w => {
      if (!w.start_date || !w.end_date) return false;
      return todayStr >= w.start_date && todayStr <= w.end_date;
    }) || weeklyGoals[0];
  }, [weeklyGoals, todayStr]);

  // Calculate daily goal = weekly goal / business days (5)
  const dailyGoals = useMemo(() => {
    if (!currentWeekGoal) return null;
    return METRIC_KEYS.reduce((acc, k) => {
      acc[k] = Math.ceil((currentWeekGoal as any)[k] / 5);
      return acc;
    }, {} as Record<string, number>);
  }, [currentWeekGoal]);

  // Today's metrics for this closer
  const todayMetrics = useMemo(() => {
    if (!dailyMetrics) return null;
    const todayEntries = dailyMetrics.filter(d => d.date === todayStr && d.member_id === teamMemberId);
    if (!todayEntries.length) return null;
    return sumMetrics(todayEntries);
  }, [dailyMetrics, todayStr, teamMemberId]);

  // Week metrics for this closer
  const weekMetrics = useMemo(() => {
    if (!dailyMetrics || !currentWeekGoal?.start_date || !currentWeekGoal?.end_date) return null;
    const weekEntries = dailyMetrics.filter(d =>
      d.member_id === teamMemberId &&
      d.date >= currentWeekGoal.start_date! &&
      d.date <= currentWeekGoal.end_date!
    );
    if (!weekEntries.length) return null;
    return sumMetrics(weekEntries);
  }, [dailyMetrics, currentWeekGoal, teamMemberId]);

  if (metricsLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="rounded-xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-card-foreground">Olá, {memberName} 👋</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Target size={20} className="text-primary" />
          </div>
        </div>
      </div>

      {/* Daily Goals */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Metas do Dia</h3>
        </div>

        {!dailyGoals ? (
          <p className="text-xs text-muted-foreground">Nenhuma meta semanal encontrada para calcular a meta diária.</p>
        ) : (
          <div className="space-y-3">
            {METRIC_KEYS.map(k => {
              const goal = dailyGoals[k] || 0;
              const actual = todayMetrics?.[k] || 0;
              const pct = goal > 0 ? Math.min((actual / goal) * 100, 100) : 0;
              const achieved = goal > 0 && actual >= goal;

              return (
                <div key={k} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                      {METRIC_LABELS[k]}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {achieved && <CheckCircle2 size={10} className="text-accent" />}
                      <span className={`text-xs font-bold tabular-nums ${achieved ? "text-accent" : "text-card-foreground"}`}>
                        {actual}
                      </span>
                      <span className="text-[10px] text-muted-foreground">/ {goal}</span>
                    </div>
                  </div>
                  <Progress
                    value={pct}
                    className="h-2 bg-secondary"
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Weekly Summary */}
      {currentWeekGoal && weekMetrics && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">
            Resumo da Semana {currentWeekGoal.week_number}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {METRIC_KEYS.map(k => {
              const goal = (currentWeekGoal as any)[k] || 0;
              const actual = weekMetrics[k] || 0;
              const pct = goal > 0 ? Math.round((actual / goal) * 100) : 0;

              return (
                <div key={k} className="rounded-lg bg-secondary/50 p-3">
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">{METRIC_LABELS[k]}</p>
                  <div className="flex items-end justify-between mt-1">
                    <span className="text-lg font-bold text-card-foreground tabular-nums">{actual}</span>
                    <span className={`text-[10px] font-bold ${pct >= 100 ? "text-accent" : pct >= 50 ? "text-primary" : "text-muted-foreground"}`}>
                      {pct}%
                    </span>
                  </div>
                  <Progress value={Math.min(pct, 100)} className="h-1 mt-1.5 bg-secondary" />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
