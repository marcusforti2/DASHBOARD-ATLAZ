import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { useMonths, useTeamMembers, useMonthlyGoals, useWeeklyGoals, useDailyMetrics, useAiReports } from "@/hooks/use-metrics";
import { sumMetrics, goalToMetrics, METRIC_LABELS, SHORT_TABLE_LABELS, METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, DbDailyMetric, DbTeamMember, getWorkingDaysCount, getMemberAvatar } from "@/lib/db";
import { getWeeksOfMonth } from "@/lib/calendar-utils";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { WeeklyComparisonChart } from "@/components/dashboard/WeeklyComparisonChart";
import { PersonPerformanceChart } from "@/components/dashboard/PersonPerformanceChart";
import { CloserRanking, RoleRanking } from "@/components/dashboard/CloserRanking";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { MetricDetailModal } from "@/components/dashboard/MetricDetailModal";
import { SdrDetailModal } from "@/components/dashboard/SdrDetailModal";
import { CollapsiblePanel } from "@/components/dashboard/CollapsiblePanel";
import { KpiPanelFilters } from "@/components/dashboard/KpiPanelFilters";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Filter, X, CalendarDays, CalendarRange, Calendar as CalendarIcon, Users, Maximize, Minimize } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const CHART_METRICS = ["follow_up", "conexoes", "reuniao_realizada", "lig_realizada"];

interface AdminDashboardProps {
  onSignOut: () => void;
  userName: string;
  selectedMonthId?: string;
  selectedMemberId?: string | null;
}

export default function AdminDashboard({ onSignOut, userName, selectedMonthId: externalMonthId, selectedMemberId: externalMemberId }: AdminDashboardProps) {
  const queryClient = useQueryClient();
  const { data: months, isLoading: monthsLoading } = useMonths();
  const { data: members } = useTeamMembers();
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>(externalMonthId);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(externalMemberId || null);
  const [selectedChartMetric, setSelectedChartMetric] = useState("follow_up");

  // Panel 1 - Month (fixed to month)
  // Panel 2 - Week states — default to current week
  const [weekPanelWeekIdx, setWeekPanelWeekIdx] = useState<number>(-1); // -1 = not yet initialized
  
  // Panel 3 - All SDRs states
  const [allSdrPeriod, setAllSdrPeriod] = useState<"month" | "week" | "day">("day");
  const [allSdrDate, setAllSdrDate] = useState<Date>(new Date());
  const [allSdrWeekIdx, setAllSdrWeekIdx] = useState<number>(0);

  // Advanced filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string | null>(null);
  const [minMetricFilter, setMinMetricFilter] = useState<{ key: string; value: number } | null>(null);
  const [metricModalKey, setMetricModalKey] = useState<string | null>(null);
  const [metricModalSource, setMetricModalSource] = useState<"month" | "week" | "general">("general");
  const [sdrModalMemberId, setSdrModalMemberId] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dashRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      dashRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Default to current month (year + month match) or fallback to first
  const currentMonthFallbackId = useMemo(() => {
    if (!months || months.length === 0) return undefined;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;
    const match = months.find(m => m.year === currentYear && m.month === currentMonth);
    return match?.id || months[0]?.id;
  }, [months]);

  const activeMonthId = selectedMonthId || currentMonthFallbackId;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  const weeksOfMonth = useMemo(() => {
    if (!activeMonth) return [];
    return getWeeksOfMonth(activeMonth.year, activeMonth.month);
  }, [activeMonth]);

  // Find current week index
  const currentWeekIdx = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return weeksOfMonth.findIndex(w => today >= w.startDate && today <= w.endDate);
  }, [weeksOfMonth]);

  // Auto-initialize week panel to current week
  const effectiveWeekIdx = weekPanelWeekIdx === -1 ? (currentWeekIdx >= 0 ? currentWeekIdx : 0) : weekPanelWeekIdx;

  // Previous month for trends
  const activeMonthIdx = months?.findIndex(m => m.id === activeMonthId) ?? -1;
  const previousMonthId = activeMonthIdx >= 0 && months?.[activeMonthIdx + 1]?.id;

  const { data: goals } = useMonthlyGoals(activeMonthId, selectedMemberId);
  const { data: teamGoals } = useMonthlyGoals(activeMonthId, null); // team-level goals for All SDRs panel
  const { data: weeklyGoals } = useWeeklyGoals(activeMonthId, selectedMemberId);
  const { data: teamWeeklyGoals } = useWeeklyGoals(activeMonthId, null); // team-level weekly goals
  const { data: dailyMetrics } = useDailyMetrics(activeMonthId);
  const { data: previousMetrics } = useDailyMetrics(previousMonthId || undefined);
  const { data: aiReports } = useAiReports(activeMonthId);

  // Base filtered by member
  const memberFilteredMetrics = useMemo(() => {
    if (!dailyMetrics) return [];
    let result = [...dailyMetrics];
    if (selectedMemberId) result = result.filter(d => d.member_id === selectedMemberId);
    if (dateFrom) result = result.filter(d => d.date >= dateFrom);
    if (dateTo) result = result.filter(d => d.date <= dateTo);
    if (selectedDayOfWeek) result = result.filter(d => d.day_of_week === selectedDayOfWeek);
    if (minMetricFilter) result = result.filter(d => (d as any)[minMetricFilter.key] >= minMetricFilter.value);
    return result;
  }, [dailyMetrics, selectedMemberId, dateFrom, dateTo, selectedDayOfWeek, minMetricFilter]);

  // Panel 1: Month totals
  const monthTotals = useMemo(() => {
    return memberFilteredMetrics.length > 0 ? sumMetrics(memberFilteredMetrics) : {};
  }, [memberFilteredMetrics]);

  // Panel 2: Week totals & goals
  const weekFilteredMetrics = useMemo(() => {
    if (!weeksOfMonth[effectiveWeekIdx]) return [];
    const week = weeksOfMonth[effectiveWeekIdx];
    return memberFilteredMetrics.filter(d => d.date >= week.startDate && d.date <= week.endDate);
  }, [memberFilteredMetrics, weeksOfMonth, effectiveWeekIdx]);
  const weekTotals = useMemo(() => weekFilteredMetrics.length > 0 ? sumMetrics(weekFilteredMetrics) : {}, [weekFilteredMetrics]);

  // Weekly goals for selected week
  const weekGoals = useMemo(() => {
    if (!weeklyGoals || !weeksOfMonth[effectiveWeekIdx]) return null;
    const weekNum = weeksOfMonth[effectiveWeekIdx].weekNumber;
    const wg = weeklyGoals.find(w => w.week_number === weekNum);
    return wg ? goalToMetrics(wg as any) : null;
  }, [weeklyGoals, weeksOfMonth, effectiveWeekIdx]);

  // Panel 3: All SDRs (ignore member filter, apply own period)
  const allSdrMetrics = useMemo(() => {
    if (!dailyMetrics) return [];
    let result = [...dailyMetrics];
    if (allSdrPeriod === "day") {
      const dayStr = format(allSdrDate, "yyyy-MM-dd");
      result = result.filter(d => d.date === dayStr);
    } else if (allSdrPeriod === "week" && weeksOfMonth[allSdrWeekIdx]) {
      const week = weeksOfMonth[allSdrWeekIdx];
      result = result.filter(d => d.date >= week.startDate && d.date <= week.endDate);
    }
    return result;
  }, [dailyMetrics, allSdrPeriod, allSdrDate, allSdrWeekIdx, weeksOfMonth]);

  // All SDRs per-member breakdown — split by role
  const sdrMembersList = useMemo(() => members?.filter(m => m.member_role === "sdr") || [], [members]);
  const closerMembersList = useMemo(() => members?.filter(m => m.member_role === "closer") || [], [members]);

  const allSdrByRole = useMemo(() => {
    const mapMembers = (list: DbTeamMember[], keys: readonly string[]) =>
      list.map(m => ({
        ...m,
        totals: sumMetrics(allSdrMetrics, m.id),
        grandTotal: keys.reduce((s, k) => s + (sumMetrics(allSdrMetrics, m.id)[k] || 0), 0),
      })).sort((a, b) => b.grandTotal - a.grandTotal);
    return {
      sdrs: mapMembers(sdrMembersList, SDR_METRIC_KEYS),
      closers: mapMembers(closerMembersList, CLOSER_METRIC_KEYS),
    };
  }, [sdrMembersList, closerMembersList, allSdrMetrics]);
  const allSdrTotals = useMemo(() => allSdrMetrics.length > 0 ? sumMetrics(allSdrMetrics) : {}, [allSdrMetrics]);

  // All SDRs goals based on period
  const allSdrGoals = useMemo((): Record<string, number> | null => {
    if (allSdrPeriod === "month") {
      return goalToMetrics(teamGoals);
    }
    if (allSdrPeriod === "week") {
      if (!teamWeeklyGoals || !weeksOfMonth[allSdrWeekIdx]) return null;
      const weekNum = weeksOfMonth[allSdrWeekIdx].weekNumber;
      const wg = teamWeeklyGoals.find(w => w.week_number === weekNum);
      return wg ? goalToMetrics(wg as any) : null;
    }
    if (allSdrPeriod === "day") {
      // Daily goal = find the week that contains this day, then divide by working days
      const dayStr = format(allSdrDate, "yyyy-MM-dd");
      const weekIdx = weeksOfMonth.findIndex(w => dayStr >= w.startDate && dayStr <= w.endDate);
      if (weekIdx < 0 || !teamWeeklyGoals) return null;
      const weekNum = weeksOfMonth[weekIdx].weekNumber;
      const wg = teamWeeklyGoals.find(w => w.week_number === weekNum);
      if (!wg) return null;
      const wgMetrics = goalToMetrics(wg as any);
      if (!wgMetrics) return null;
      const wdCount = getWorkingDaysCount((wg as any).working_days);
      return METRIC_KEYS.reduce((acc, k) => {
        acc[k] = Math.round((wgMetrics[k] || 0) / wdCount);
        return acc;
      }, {} as Record<string, number>);
    }
    return null;
  }, [allSdrPeriod, teamGoals, teamWeeklyGoals, weeksOfMonth, allSdrWeekIdx, allSdrDate]);

  const previousTotals = previousMetrics && previousMetrics.length > 0 ? sumMetrics(previousMetrics) : undefined;
  const hasActiveFilters = dateFrom || dateTo || selectedDayOfWeek || minMetricFilter;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedDayOfWeek(null);
    setMinMetricFilter(null);
  };

  if (monthsLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div ref={dashRef} className={cn("space-y-5", isFullscreen && "bg-background p-6 overflow-auto h-screen")}>
      {/* Top bar removed — filters now managed via sidebar */}

      {/* === 3 COLLAPSIBLE KPI PANELS === */}

      {/* Panel 1: Visão Geral — Equipe */}
      <CollapsiblePanel
        title="Visão Geral — Equipe"
        subtitle={
          allSdrPeriod === "month" ? activeMonth?.label :
          allSdrPeriod === "week" && weeksOfMonth[allSdrWeekIdx] ? `Semana ${weeksOfMonth[allSdrWeekIdx].weekNumber}` :
          format(allSdrDate, "dd/MM/yyyy", { locale: ptBR })
        }
        icon={<Users size={15} className="text-[hsl(45,93%,47%)]" />}
        accentColor="bg-[hsl(45,93%,47%)]/15"
        defaultOpen={true}
        headerActions={
          <KpiPanelFilters
            periodFilter={allSdrPeriod}
            onPeriodChange={setAllSdrPeriod}
            selectedDate={allSdrDate}
            onDateChange={setAllSdrDate}
            selectedWeekIdx={allSdrWeekIdx}
            onWeekChange={setAllSdrWeekIdx}
            weeksOfMonth={weeksOfMonth}
          />
        }
      >
        <div className="space-y-4">
          {/* Overall totals */}
          <KpiGrid totals={allSdrTotals} goals={allSdrGoals} onCardClick={(key) => { setMetricModalKey(key); setMetricModalSource("general"); }} compact />

          {/* Row 1: SDR table (left) + SDR ranking (right) */}
          {allSdrByRole.sdrs.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="lg:flex-1 min-w-0 rounded-xl p-3 bg-[hsl(var(--panel-sdr))] border border-[hsl(217,40%,18%)] border-l-[3px] border-l-[hsl(var(--panel-sdr-accent))]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-primary-foreground bg-primary/20 px-2 py-0.5 rounded-full border border-primary/30">SDR</span>
                  <div className="flex-1 h-px bg-primary/20" />
                </div>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-[hsl(217,70%,70%)] font-semibold uppercase tracking-wider">SDR</th>
                      {SDR_METRIC_KEYS.map(k => (
                        <th key={k} className="text-right py-1.5 text-[hsl(217,70%,70%)] font-semibold uppercase tracking-wider whitespace-nowrap px-1">
                          {SHORT_TABLE_LABELS[k]}
                        </th>
                      ))}
                      <th className="text-right py-1.5 text-[hsl(217,70%,70%)] font-semibold uppercase tracking-wider px-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSdrByRole.sdrs.map((member, idx) => {
                      const memberGoal = allSdrGoals && sdrMembersList.length > 0
                        ? Object.fromEntries(SDR_METRIC_KEYS.map(k => [k, Math.max(1, Math.round((allSdrGoals[k] || 0) / sdrMembersList.length))]))
                        : null;
                      return (
                        <tr key={member.id} onClick={() => setSdrModalMemberId(member.id)} className={cn(
                          "border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer",
                          idx === 0 && "bg-[hsl(45,93%,47%)]/5"
                        )}>
                          <td className="py-1.5 text-card-foreground whitespace-nowrap font-semibold">
                            <div className="flex items-center gap-1.5">
                              <img src={getMemberAvatar(member, idx)} alt={member.name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-border" />
                              <span className="text-[10px]">{member.name}</span>
                            </div>
                          </td>
                          {SDR_METRIC_KEYS.map(k => {
                            const val = member.totals[k] || 0;
                            const goal = memberGoal?.[k] || 0;
                            const pct = goal > 0 ? (val / goal) * 100 : 0;
                            const colorClass = goal > 0
                              ? pct >= 80 ? "text-[hsl(142,70%,50%)]" : pct >= 40 ? "text-[hsl(45,93%,47%)]" : "text-[hsl(0,70%,55%)]"
                              : val > 0 ? "text-card-foreground" : "text-muted-foreground/30";
                            return (
                              <td key={k} className={cn("text-right py-1.5 tabular-nums px-1", colorClass)}>
                                {goal > 0 ? <><span className="font-bold">{val}</span><span className="text-muted-foreground/60">/{goal}</span></> : val}
                              </td>
                            );
                          })}
                          <td className="text-right py-1.5 tabular-nums px-1 font-bold text-card-foreground">{member.grandTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="lg:w-[280px] lg:shrink-0">
                <RoleRanking title="Ranking SDRs" members={sdrMembersList} dailyMetrics={allSdrMetrics} metricKeys={[...SDR_METRIC_KEYS]} variant="sdr" compact />
              </div>
            </div>
          )}

          {/* Row 2: Closer table (left) + Closer ranking (right) */}
          {allSdrByRole.closers.length > 0 && (
            <div className="flex flex-col lg:flex-row gap-3">
              <div className="lg:flex-1 min-w-0 rounded-xl p-3 bg-[hsl(var(--panel-closer))] border border-[hsl(280,30%,18%)] border-l-[3px] border-l-[hsl(var(--panel-closer-accent))]">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[hsl(280,65%,80%)] bg-[hsl(280,65%,60%/0.15)] px-2 py-0.5 rounded-full border border-[hsl(280,65%,60%/0.3)]">CLOSER</span>
                  <div className="flex-1 h-px bg-[hsl(280,65%,60%/0.2)]" />
                </div>
                <table className="w-full text-[9px]">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-1.5 text-[hsl(280,65%,70%)] font-semibold uppercase tracking-wider">Closer</th>
                      {CLOSER_METRIC_KEYS.map(k => (
                        <th key={k} className="text-right py-1.5 text-[hsl(280,65%,70%)] font-semibold uppercase tracking-wider whitespace-nowrap px-1">
                          {SHORT_TABLE_LABELS[k]}
                        </th>
                      ))}
                      <th className="text-right py-1.5 text-[hsl(280,65%,70%)] font-semibold uppercase tracking-wider px-1">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allSdrByRole.closers.map((member, idx) => {
                      const memberGoal = allSdrGoals && closerMembersList.length > 0
                        ? Object.fromEntries(CLOSER_METRIC_KEYS.map(k => [k, Math.max(1, Math.round((allSdrGoals[k] || 0) / closerMembersList.length))]))
                        : null;
                      return (
                        <tr key={member.id} onClick={() => setSdrModalMemberId(member.id)} className={cn(
                          "border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer",
                          idx === 0 && "bg-[hsl(45,93%,47%)]/5"
                        )}>
                          <td className="py-1.5 text-card-foreground whitespace-nowrap font-semibold">
                            <div className="flex items-center gap-1.5">
                              <img src={getMemberAvatar(member, idx)} alt={member.name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-border" />
                              <span className="text-[10px]">{member.name}</span>
                            </div>
                          </td>
                          {CLOSER_METRIC_KEYS.map(k => {
                            const val = member.totals[k] || 0;
                            const goal = memberGoal?.[k] || 0;
                            const pct = goal > 0 ? (val / goal) * 100 : 0;
                            const colorClass = goal > 0
                              ? pct >= 80 ? "text-[hsl(142,70%,50%)]" : pct >= 40 ? "text-[hsl(45,93%,47%)]" : "text-[hsl(0,70%,55%)]"
                              : val > 0 ? "text-card-foreground" : "text-muted-foreground/30";
                            return (
                              <td key={k} className={cn("text-right py-1.5 tabular-nums px-1", colorClass)}>
                                {goal > 0 ? <><span className="font-bold">{val}</span><span className="text-muted-foreground/60">/{goal}</span></> : val}
                              </td>
                            );
                          })}
                          <td className="text-right py-1.5 tabular-nums px-1 font-bold text-card-foreground">{member.grandTotal}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="lg:w-[280px] lg:shrink-0">
                <RoleRanking title="Ranking Closers" members={closerMembersList} dailyMetrics={allSdrMetrics} metricKeys={[...CLOSER_METRIC_KEYS]} variant="closer" compact />
              </div>
            </div>
          )}
        </div>
      </CollapsiblePanel>

      {/* Filters Panel */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-xs font-semibold text-card-foreground uppercase tracking-wider"
          >
            <Filter size={14} className="text-primary" />
            Filtros Avançados
            <ChevronDown size={12} className={`transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-[10px] text-destructive hover:text-destructive/80">
              <X size={10} /> Limpar filtros
            </button>
          )}
        </div>
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 mt-3 border-t border-border">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data Início</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Data Fim</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Dia da Semana</label>
              <select value={selectedDayOfWeek || ""} onChange={e => setSelectedDayOfWeek(e.target.value || null)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-2.5 py-1.5 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none appearance-none">
                <option value="">Todos</option>
                {["Seg", "Ter", "Qua", "Qui", "Sex"].map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Métrica Mínima</label>
              <div className="mt-1 flex gap-1">
                <select
                  value={minMetricFilter?.key || ""}
                  onChange={e => setMinMetricFilter(e.target.value ? { key: e.target.value, value: minMetricFilter?.value || 1 } : null)}
                  className="flex-1 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-secondary-foreground outline-none appearance-none"
                >
                  <option value="">—</option>
                  {METRIC_KEYS.map(k => <option key={k} value={k}>{METRIC_LABELS[k]}</option>)}
                </select>
                {minMetricFilter && (
                  <input type="number" min={1} value={minMetricFilter.value}
                    onChange={e => setMinMetricFilter({ ...minMetricFilter, value: parseInt(e.target.value) || 1 })}
                    className="w-14 rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-secondary-foreground outline-none" />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4">
        <div>
          <div className="flex items-center gap-1 mb-3">
            {CHART_METRICS.map(m => (
              <button
                key={m}
                onClick={() => setSelectedChartMetric(m)}
                className={`px-2.5 py-1 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-colors ${
                  selectedChartMetric === m ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {METRIC_LABELS[m]}
              </button>
            ))}
          </div>
          {weeklyGoals && (
            <WeeklyComparisonChart
              weeklyGoals={weeklyGoals}
              metric={selectedChartMetric}
              dailyMetrics={memberFilteredMetrics}
            />
          )}
        </div>
      </div>

      {/* Person Performance */}
      {dailyMetrics && members && (
        <PersonPerformanceChart dailyMetrics={dailyMetrics} members={members} />
      )}


      {/* AI Report */}
      {activeMonthId && activeMonth && (
        <AiReportPanel
          monthId={activeMonthId}
          monthLabel={activeMonth.label}
          metrics={monthTotals}
          goals={goalToMetrics(goals)}
          members={members?.map(m => m.name) || []}
          existingReports={aiReports || []}
          onReportGenerated={() => queryClient.invalidateQueries({ queryKey: ["ai-reports", activeMonthId] })}
        />
      )}

      {/* Alerts */}
      {dailyMetrics && members && (
        <AlertsPanel
          dailyMetrics={memberFilteredMetrics}
          members={members}
          goals={goalToMetrics(goals)}
        />
      )}

      {/* Metric Detail Modal */}
      <MetricDetailModal
        open={!!metricModalKey}
        onOpenChange={(open) => !open && setMetricModalKey(null)}
        metricKey={metricModalKey}
        members={members || []}
        metrics={
          metricModalSource === "month" ? memberFilteredMetrics :
          metricModalSource === "week" ? weekFilteredMetrics :
          allSdrMetrics
        }
        goals={
          metricModalSource === "month" ? goalToMetrics(goals) :
          metricModalSource === "week" ? weekGoals :
          allSdrGoals
        }
        periodLabel={
          metricModalSource === "month" ? activeMonth?.label || "" :
          metricModalSource === "week" && weeksOfMonth[effectiveWeekIdx]
            ? `Semana ${weeksOfMonth[effectiveWeekIdx].weekNumber} — ${weeksOfMonth[effectiveWeekIdx].startDate} a ${weeksOfMonth[effectiveWeekIdx].endDate}`
            : allSdrPeriod === "month" ? activeMonth?.label :
              allSdrPeriod === "week" && weeksOfMonth[allSdrWeekIdx] ? `Semana ${weeksOfMonth[allSdrWeekIdx].weekNumber}` :
              format(allSdrDate, "dd/MM/yyyy", { locale: ptBR })
        }
      />

      {/* SDR Detail Modal */}
      <SdrDetailModal
        open={!!sdrModalMemberId}
        onOpenChange={(open) => !open && setSdrModalMemberId(null)}
        member={members?.find(m => m.id === sdrModalMemberId) || null}
        memberIndex={members?.findIndex(m => m.id === sdrModalMemberId) ?? 0}
        allMetrics={dailyMetrics || []}
        weeksOfMonth={weeksOfMonth}
        monthLabel={activeMonth?.label}
        initialDate={format(allSdrDate, "yyyy-MM-dd")}
        getGoalsForPeriod={(period, wIdx, date) => {
          if (period === "month") {
            // Find member-specific monthly goal
            return goalToMetrics(teamGoals);
          }
          if (period === "week") {
            if (!teamWeeklyGoals || !weeksOfMonth[wIdx]) return null;
            const weekNum = weeksOfMonth[wIdx].weekNumber;
            const wg = teamWeeklyGoals.find(w => w.week_number === weekNum);
            if (!wg) return null;
            const wgMetrics = goalToMetrics(wg as any);
            // Divide team goal by number of members for per-member goal
            if (!wgMetrics || !members) return wgMetrics;
            return METRIC_KEYS.reduce((acc, k) => {
              acc[k] = Math.round((wgMetrics[k] || 0) / members.length);
              return acc;
            }, {} as Record<string, number>);
          }
          if (period === "day") {
            const dayStr = format(date, "yyyy-MM-dd");
            const weekIndex = weeksOfMonth.findIndex(w => dayStr >= w.startDate && dayStr <= w.endDate);
            if (weekIndex < 0 || !teamWeeklyGoals) return null;
            const weekNum = weeksOfMonth[weekIndex].weekNumber;
            const wg = teamWeeklyGoals.find(w => w.week_number === weekNum);
            if (!wg) return null;
            const wgMetrics = goalToMetrics(wg as any);
            if (!wgMetrics || !members) return null;
            const wdCount = getWorkingDaysCount((wg as any).working_days);
            return METRIC_KEYS.reduce((acc, k) => {
              acc[k] = Math.round((wgMetrics[k] || 0) / members.length / wdCount);
              return acc;
            }, {} as Record<string, number>);
          }
          return null;
        }}
      />
    </div>
  );
}
