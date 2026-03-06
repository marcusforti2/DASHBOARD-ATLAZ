import { useState, useMemo } from "react";
import { useMonths, useDailyMetrics, useWeeklyGoals, useMonthlyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, METRIC_LABELS, sumMetrics, getWorkingDaysCount } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Target, Zap, Trophy, Calendar, Flame, Loader2 } from "lucide-react";
import { MetricCard } from "./MetricCard";
import { LeadEntrySheet } from "./LeadEntrySheet";
import { LeadHistoryPanel } from "./LeadHistoryPanel";

const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

interface CloserDailyDashboardProps {
  teamMemberId: string;
  memberName: string;
  memberRole?: string;
}

export function CloserDailyDashboard({ teamMemberId, memberName, memberRole = "sdr" }: CloserDailyDashboardProps) {
  const roles = (memberRole || "sdr").split(",").map(r => r.trim());
  const hasDualRole = roles.includes("sdr") && roles.includes("closer");
  const [activeRoleTab, setActiveRoleTab] = useState<"sdr" | "closer">(roles.includes("sdr") ? "sdr" : "closer");

  const roleMetrics = hasDualRole
    ? (activeRoleTab === "closer" ? CLOSER_METRIC_KEYS as readonly string[] : SDR_METRIC_KEYS as readonly string[])
    : (roles.includes("closer") ? CLOSER_METRIC_KEYS as readonly string[] : SDR_METRIC_KEYS as readonly string[]);

  const { data: months } = useMonths();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);

  const { data: dailyMetrics, isLoading: metricsLoading } = useDailyMetrics(currentMonth?.id);
  const { data: weeklyGoals } = useWeeklyGoals(currentMonth?.id, teamMemberId);
  const { data: monthlyGoal } = useMonthlyGoals(currentMonth?.id, teamMemberId);

  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const [leadSheetOpen, setLeadSheetOpen] = useState(false);
  const [leadSheetMetric, setLeadSheetMetric] = useState("numero");

  const currentWeekGoal = useMemo(() => {
    if (!weeklyGoals?.length) return null;
    return weeklyGoals.find(w => {
      if (!w.start_date || !w.end_date) return false;
      return todayStr >= w.start_date && todayStr <= w.end_date;
    }) || weeklyGoals[0];
  }, [weeklyGoals, todayStr]);

  const dailyGoals = useMemo(() => {
    if (!currentWeekGoal) return null;
    const wdCount = getWorkingDaysCount((currentWeekGoal as any).working_days);
    return roleMetrics.reduce((acc, k) => {
      acc[k] = Math.ceil((currentWeekGoal as any)[k] / wdCount);
      return acc;
    }, {} as Record<string, number>);
  }, [currentWeekGoal, roleMetrics]);

  const todayMetrics = useMemo(() => {
    if (!dailyMetrics) return null;
    const entries = dailyMetrics.filter(d => d.date === todayStr && d.member_id === teamMemberId);
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, todayStr, teamMemberId]);

  const weekMetrics = useMemo(() => {
    if (!dailyMetrics || !currentWeekGoal?.start_date || !currentWeekGoal?.end_date) return null;
    const entries = dailyMetrics.filter(d =>
      d.member_id === teamMemberId && d.date >= currentWeekGoal.start_date! && d.date <= currentWeekGoal.end_date!
    );
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, currentWeekGoal, teamMemberId]);

  const monthMetrics = useMemo(() => {
    if (!dailyMetrics) return null;
    const entries = dailyMetrics.filter(d => d.member_id === teamMemberId);
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, teamMemberId]);

  const currentGoals = useMemo(() => {
    if (viewMode === "day") return dailyGoals;
    if (viewMode === "week" && currentWeekGoal) {
      return roleMetrics.reduce((acc, k) => { acc[k] = (currentWeekGoal as any)[k] || 0; return acc; }, {} as Record<string, number>);
    }
    if (viewMode === "month" && monthlyGoal) {
      return roleMetrics.reduce((acc, k) => { acc[k] = (monthlyGoal as any)[k] || 0; return acc; }, {} as Record<string, number>);
    }
    return null;
  }, [viewMode, dailyGoals, currentWeekGoal, monthlyGoal, roleMetrics]);

  const currentActuals = useMemo(() => {
    if (viewMode === "day") return todayMetrics;
    if (viewMode === "week") return weekMetrics;
    return monthMetrics;
  }, [viewMode, todayMetrics, weekMetrics, monthMetrics]);

  const completion = useMemo(() => {
    if (!currentGoals || !currentActuals) return 0;
    const totalGoal = roleMetrics.reduce((s, k) => s + (currentGoals[k] || 0), 0);
    const totalActual = roleMetrics.reduce((s, k) => s + (currentActuals[k] || 0), 0);
    return totalGoal > 0 ? Math.min(Math.round((totalActual / totalGoal) * 100), 100) : 0;
  }, [currentGoals, currentActuals, roleMetrics]);

  const achievedCount = useMemo(() => {
    if (!currentGoals || !currentActuals) return 0;
    return roleMetrics.filter(k => currentGoals[k] > 0 && (currentActuals[k] || 0) >= currentGoals[k]).length;
  }, [currentGoals, currentActuals, roleMetrics]);

  const VIEW_LABELS: Record<string, string> = { day: "Dia", week: "Semana", month: "Mês" };

  const periodLabel = useMemo(() => {
    if (viewMode === "day") return format(today, "EEEE, dd 'de' MMMM", { locale: ptBR });
    if (viewMode === "week" && currentWeekGoal?.start_date && currentWeekGoal?.end_date) {
      return `Semana ${currentWeekGoal.week_number} — ${format(new Date(currentWeekGoal.start_date + "T12:00:00"), "dd/MM")} a ${format(new Date(currentWeekGoal.end_date + "T12:00:00"), "dd/MM")}`;
    }
    if (viewMode === "month" && currentMonth) return currentMonth.label;
    return "";
  }, [viewMode, today, currentWeekGoal, currentMonth]);

  const invalidateMetrics = () => queryClient.invalidateQueries({ queryKey: ["daily-metrics", currentMonth?.id] });

  // ── Increment handler (direct tap on card) ──
  const handleIncrement = async (metricKey: string, qty: number) => {
    if (!currentMonth?.id) return;
    const dateObj = new Date(todayStr + "T12:00:00");
    const dayName = DAY_NAMES[dateObj.getDay()];

    // Create audit trail entries
    const auditInserts = Array.from({ length: qty }, () => ({
      member_id: teamMemberId,
      date: todayStr,
      lead_name: METRIC_LABELS[metricKey] || metricKey,
      whatsapp: "",
      social_link: "",
      metric_type: metricKey,
      source: "manual",
    }));
    await supabase.from("lead_entries").insert(auditInserts);

    // Update daily_metrics
    const { data: existing } = await supabase
      .from("daily_metrics").select("*")
      .eq("member_id", teamMemberId).eq("date", todayStr).eq("month_id", currentMonth.id)
      .maybeSingle();

    if (existing) {
      const currentVal = (existing as any)[metricKey] || 0;
      await supabase.from("daily_metrics").update({ [metricKey]: currentVal + qty }).eq("id", existing.id);
    } else {
      const payload: any = { member_id: teamMemberId, month_id: currentMonth.id, date: todayStr, day_of_week: dayName };
      METRIC_KEYS.forEach(k => { payload[k] = 0; });
      payload[metricKey] = qty;
      await supabase.from("daily_metrics").insert(payload);
    }

    toast.success(`+${qty} ${METRIC_LABELS[metricKey]} 🚀`);
    invalidateMetrics();
  };

  // ── Decrement handler (supports qty) ──
  const handleDecrement = async (metricKey: string, qty: number = 1) => {
    if (!currentMonth?.id) return;

    const { data: metric } = await supabase
      .from("daily_metrics").select("*")
      .eq("member_id", teamMemberId).eq("date", todayStr)
      .maybeSingle();

    if (metric) {
      const val = (metric as any)[metricKey] || 0;
      const newVal = Math.max(0, val - qty);
      await supabase.from("daily_metrics").update({ [metricKey]: newVal }).eq("id", metric.id);
    }

    // Remove latest N lead_entries
    const { data: entries } = await supabase
      .from("lead_entries").select("id")
      .eq("member_id", teamMemberId).eq("date", todayStr).eq("metric_type", metricKey)
      .order("created_at", { ascending: false }).limit(qty);

    if (entries?.length) {
      await supabase.from("lead_entries").delete().in("id", entries.map(e => e.id));
    }

    toast(`-${qty} ${METRIC_LABELS[metricKey]} removido(s)`, { description: "Métrica e registros ajustados" });
    invalidateMetrics();
  };

  const handleOpenLeadSheet = (metricKey: string) => {
    setLeadSheetMetric(metricKey);
    setLeadSheetOpen(true);
  };

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
                ? `${achievedCount} de ${roleMetrics.filter(k => (currentGoals?.[k] || 0) > 0).length} metas batidas ${viewMode === "day" ? "hoje" : viewMode === "week" ? "na semana" : "no mês"}`
                : "Toque nos cards abaixo para registrar — rápido e direto!"
              }
            </p>
          </div>

          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={completion >= 100 ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - completion / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-black tabular-nums", completion >= 100 ? "text-accent" : "text-primary")}>
                {completion}%
              </span>
              {completion >= 100 && <Flame size={12} className="text-accent" />}
            </div>
          </div>
        </div>
      </div>

      {/* Role Tab for Dual Role */}
      {hasDualRole && (
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
          <button
            onClick={() => setActiveRoleTab("sdr")}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeRoleTab === "sdr"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Zap size={12} /> SDR · Prospecção
          </button>
          <button
            onClick={() => setActiveRoleTab("closer")}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeRoleTab === "closer"
                ? "bg-[hsl(280,65%,60%)] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Trophy size={12} /> Closer · Fechamento
          </button>
        </div>
      )}

      {/* Period Filter + Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Progresso</h3>
            <span className="text-[8px] text-muted-foreground/60 bg-secondary/60 px-2 py-0.5 rounded-full">
              tap para registrar
            </span>
          </div>
          <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <p className="text-[9px] text-muted-foreground mb-2.5 flex items-center gap-1">
          <Calendar size={10} />
          {periodLabel}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {roleMetrics.map(k => (
            <MetricCard
              key={k}
              metricKey={k}
              actual={currentActuals?.[k] || 0}
              goal={currentGoals?.[k] || 0}
              onIncrement={handleIncrement}
              onDecrement={handleDecrement}
              onOpenLeadSheet={handleOpenLeadSheet}
            />
          ))}
        </div>
      </div>

      {/* Lead History */}
      <LeadHistoryPanel teamMemberId={teamMemberId} />

      {/* Lead Entry Sheet (for "numero" metric) */}
      {currentMonth?.id && (
        <LeadEntrySheet
          open={leadSheetOpen}
          onOpenChange={setLeadSheetOpen}
          teamMemberId={teamMemberId}
          metricKey={leadSheetMetric}
          todayStr={todayStr}
          currentMonthId={currentMonth.id}
          roleMetrics={roleMetrics}
          onSaved={invalidateMetrics}
          onDecrement={handleDecrement}
          currentActual={currentActuals?.[leadSheetMetric] || 0}
        />
      )}
    </div>
  );
}
