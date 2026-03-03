import { useState, useMemo, useEffect } from "react";
import { useMonths, useDailyMetrics, useWeeklyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, sumMetrics, getWorkingDaysCount } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Target, TrendingUp, CheckCircle2, Loader2, Plus, Flame,
  Zap, Trophy, Calendar, ArrowUpRight, Save
} from "lucide-react";

const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

// Icons for each metric to make it more visual
const METRIC_ICONS: Record<string, string> = {
  conexoes: "🔗", conexoes_aceitas: "✅", abordagens: "💬", inmail: "📩", follow_up: "🔄",
  numero: "📞", lig_agendada: "📅", lig_realizada: "☎️", reuniao_agendada: "🗓️", reuniao_realizada: "🤝",
};

interface CloserDailyDashboardProps {
  teamMemberId: string;
  memberName: string;
}

export function CloserDailyDashboard({ teamMemberId, memberName }: CloserDailyDashboardProps) {
  const { data: months } = useMonths();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);

  const { data: dailyMetrics, isLoading: metricsLoading } = useDailyMetrics(currentMonth?.id);
  const { data: weeklyGoals } = useWeeklyGoals(currentMonth?.id, teamMemberId);

  // Find current week goal
  const currentWeekGoal = useMemo(() => {
    if (!weeklyGoals?.length) return null;
    return weeklyGoals.find(w => {
      if (!w.start_date || !w.end_date) return false;
      return todayStr >= w.start_date && todayStr <= w.end_date;
    }) || weeklyGoals[0];
  }, [weeklyGoals, todayStr]);

  // Daily goal = weekly / working days
  const dailyGoals = useMemo(() => {
    if (!currentWeekGoal) return null;
    const wdCount = getWorkingDaysCount((currentWeekGoal as any).working_days);
    return METRIC_KEYS.reduce((acc, k) => {
      acc[k] = Math.ceil((currentWeekGoal as any)[k] / wdCount);
      return acc;
    }, {} as Record<string, number>);
  }, [currentWeekGoal]);

  // Today's metrics
  const todayMetrics = useMemo(() => {
    if (!dailyMetrics) return null;
    const entries = dailyMetrics.filter(d => d.date === todayStr && d.member_id === teamMemberId);
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, todayStr, teamMemberId]);

  // Week metrics
  const weekMetrics = useMemo(() => {
    if (!dailyMetrics || !currentWeekGoal?.start_date || !currentWeekGoal?.end_date) return null;
    const entries = dailyMetrics.filter(d =>
      d.member_id === teamMemberId &&
      d.date >= currentWeekGoal.start_date! &&
      d.date <= currentWeekGoal.end_date!
    );
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, currentWeekGoal, teamMemberId]);

  // Overall day completion %
  const dayCompletion = useMemo(() => {
    if (!dailyGoals || !todayMetrics) return 0;
    const totalGoal = METRIC_KEYS.reduce((s, k) => s + (dailyGoals[k] || 0), 0);
    const totalActual = METRIC_KEYS.reduce((s, k) => s + (todayMetrics[k] || 0), 0);
    return totalGoal > 0 ? Math.min(Math.round((totalActual / totalGoal) * 100), 100) : 0;
  }, [dailyGoals, todayMetrics]);

  const achievedCount = useMemo(() => {
    if (!dailyGoals || !todayMetrics) return 0;
    return METRIC_KEYS.filter(k => dailyGoals[k] > 0 && (todayMetrics[k] || 0) >= dailyGoals[k]).length;
  }, [dailyGoals, todayMetrics]);

  if (metricsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const hasDataToday = !!todayMetrics;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Hero Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <h2 className="text-xl font-black text-card-foreground mt-1">
              Olá, {memberName.split(" ")[0]} 👋
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {hasDataToday
                ? `${achievedCount} de ${METRIC_KEYS.filter(k => (dailyGoals?.[k] || 0) > 0).length} metas batidas hoje`
                : "Nenhum dado inserido hoje — comece agora!"
              }
            </p>
          </div>

          {/* Circular progress */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={dayCompletion >= 100 ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - dayCompletion / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-black tabular-nums", dayCompletion >= 100 ? "text-accent" : "text-primary")}>
                {dayCompletion}%
              </span>
              {dayCompletion >= 100 && <Flame size={12} className="text-accent" />}
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <DataEntryDialog
          teamMemberId={teamMemberId}
          todayStr={todayStr}
          currentMonthId={currentMonth?.id}
          todayMetrics={todayMetrics}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["daily-metrics", currentMonth?.id] })}
        />
      </div>

      {/* Daily Metric Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Progresso do Dia</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {METRIC_KEYS.map(k => {
            const goal = dailyGoals?.[k] || 0;
            const actual = todayMetrics?.[k] || 0;
            const pct = goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0;
            const achieved = goal > 0 && actual >= goal;

            return (
              <div
                key={k}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  achieved
                    ? "border-accent/30 bg-accent/5"
                    : "border-border bg-card hover:bg-card/80"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base">{METRIC_ICONS[k]}</span>
                  {achieved && <CheckCircle2 size={12} className="text-accent" />}
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {METRIC_LABELS[k]}
                </p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className={cn("text-xl font-black tabular-nums", achieved ? "text-accent" : "text-card-foreground")}>
                    {actual}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/{goal}</span>
                </div>
                <Progress
                  value={pct}
                  className={cn("h-1 mt-2", achieved ? "[&>div]:bg-accent" : "")}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Weekly Summary */}
      {currentWeekGoal && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-chart-4" />
              <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">
                Semana {currentWeekGoal.week_number}
              </h3>
            </div>
            {currentWeekGoal.start_date && currentWeekGoal.end_date && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Calendar size={10} />
                {format(new Date(currentWeekGoal.start_date + "T12:00:00"), "dd/MM")} — {format(new Date(currentWeekGoal.end_date + "T12:00:00"), "dd/MM")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {METRIC_KEYS.map(k => {
              const goal = (currentWeekGoal as any)[k] || 0;
              const actual = weekMetrics?.[k] || 0;
              const pct = goal > 0 ? Math.round((actual / goal) * 100) : 0;
              const achieved = pct >= 100;

              return (
                <div key={k} className="rounded-lg bg-secondary/40 p-2.5 text-center">
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{METRIC_LABELS[k]}</p>
                  <p className={cn("text-sm font-black tabular-nums mt-1", achieved ? "text-accent" : "text-card-foreground")}>
                    {actual}<span className="text-[9px] text-muted-foreground font-normal">/{goal}</span>
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {achieved ? (
                      <CheckCircle2 size={9} className="text-accent" />
                    ) : pct > 0 ? (
                      <ArrowUpRight size={9} className="text-primary" />
                    ) : null}
                    <span className={cn("text-[9px] font-bold", achieved ? "text-accent" : pct >= 50 ? "text-primary" : "text-muted-foreground")}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== Data Entry Dialog ========== */

function DataEntryDialog({
  teamMemberId,
  todayStr,
  currentMonthId,
  todayMetrics,
  onSaved,
}: {
  teamMemberId: string;
  todayStr: string;
  currentMonthId?: string;
  todayMetrics: Record<string, number> | null;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, number>>(() =>
    METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>)
  );
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  // Load existing data when dialog opens
  useEffect(() => {
    if (!open || !currentMonthId) return;
    supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", todayStr)
      .eq("month_id", currentMonthId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          const vals: Record<string, number> = {};
          METRIC_KEYS.forEach(k => { vals[k] = (data as any)[k] || 0; });
          setValues(vals);
        } else {
          setExistingId(null);
          setValues(METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>));
        }
      });
  }, [open, currentMonthId, teamMemberId, todayStr]);

  const handleSave = async () => {
    if (!currentMonthId) {
      toast.error("Mês não cadastrado. Peça ao gestor.");
      return;
    }
    setLoading(true);

    const dateObj = new Date(todayStr + "T12:00:00");
    const dayName = DAY_NAMES[dateObj.getDay()];

    const payload = {
      ...values,
      member_id: teamMemberId,
      month_id: currentMonthId,
      date: todayStr,
      day_of_week: dayName,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("daily_metrics").update(payload).eq("id", existingId));
    } else {
      ({ error } = await supabase.from("daily_metrics").insert(payload));
    }

    if (error) {
      toast.error("Erro: " + error.message);
    } else {
      toast.success(existingId ? "Dados atualizados! 🎉" : "Dados salvos! 🚀");
      onSaved();
      setOpen(false);
    }
    setLoading(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={cn(
          "mt-4 w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all",
          todayMetrics
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
        )}>
          {todayMetrics ? (
            <>
              <CheckCircle2 size={16} /> Atualizar dados de hoje
            </>
          ) : (
            <>
              <Plus size={16} /> Cadastrar dados do dia
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
            <Calendar size={14} className="text-primary" />
            {format(new Date(todayStr + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 py-2">
          {METRIC_KEYS.map(k => (
            <div key={k}>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <span>{METRIC_ICONS[k]}</span> {METRIC_LABELS[k]}
              </label>
              <input
                type="number"
                min={0}
                value={values[k]}
                onChange={e => setValues(v => ({ ...v, [k]: parseInt(e.target.value) || 0 }))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground tabular-nums focus:ring-2 focus:ring-primary/50 outline-none transition-all"
              />
            </div>
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={loading || !currentMonthId}
          className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          {existingId ? "Atualizar" : "Salvar"}
        </button>
      </DialogContent>
    </Dialog>
  );
}
