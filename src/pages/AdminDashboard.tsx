import { useState, useMemo } from "react";
import { useMonths, useTeamMembers, useMonthlyGoals, useWeeklyGoals, useDailyMetrics, useAiReports } from "@/hooks/use-metrics";
import { sumMetrics, goalToMetrics, METRIC_LABELS, METRIC_KEYS, DbDailyMetric, DbTeamMember, getWorkingDaysCount } from "@/lib/db";
import { getWeeksOfMonth } from "@/lib/calendar-utils";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { WeeklyComparisonChart } from "@/components/dashboard/WeeklyComparisonChart";
import { PersonPerformanceChart } from "@/components/dashboard/PersonPerformanceChart";
import { CloserRanking } from "@/components/dashboard/CloserRanking";
import { DailyTable } from "@/components/dashboard/DailyTable";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { MetricDetailModal } from "@/components/dashboard/MetricDetailModal";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { CollapsiblePanel } from "@/components/dashboard/CollapsiblePanel";
import { KpiPanelFilters } from "@/components/dashboard/KpiPanelFilters";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Filter, X, CalendarDays, CalendarRange, Calendar as CalendarIcon, Users } from "lucide-react";
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
  const [allSdrPeriod, setAllSdrPeriod] = useState<"month" | "week" | "day">("month");
  const [allSdrDate, setAllSdrDate] = useState<Date>(new Date());
  const [allSdrWeekIdx, setAllSdrWeekIdx] = useState<number>(0);

  // Advanced filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string | null>(null);
  const [minMetricFilter, setMinMetricFilter] = useState<{ key: string; value: number } | null>(null);
  const [metricModalKey, setMetricModalKey] = useState<string | null>(null);

  const activeMonthId = selectedMonthId || months?.[0]?.id;
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

  // All SDRs per-member breakdown
  const allSdrByMember = useMemo(() => {
    if (!members) return [];
    return members.map(m => ({
      ...m,
      totals: sumMetrics(allSdrMetrics, m.id),
      grandTotal: METRIC_KEYS.reduce((s, k) => s + (sumMetrics(allSdrMetrics, m.id)[k] || 0), 0),
    })).sort((a, b) => b.grandTotal - a.grandTotal);
  }, [members, allSdrMetrics]);
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
    <div className="space-y-5">
      {/* Top bar with month & member selectors */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <select
            value={activeMonthId || ""}
            onChange={e => setSelectedMonthId(e.target.value)}
            className="appearance-none bg-secondary text-secondary-foreground text-xs font-medium px-3 py-2 pr-7 rounded-lg border border-border cursor-pointer focus:ring-1 focus:ring-primary outline-none"
          >
            {months?.map(m => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <div className="h-5 w-px bg-border" />

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setSelectedMemberId(null)}
            className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors ${
              !selectedMemberId ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            Todos
          </button>
          {members?.map(m => (
            <button
              key={m.id}
              onClick={() => setSelectedMemberId(m.id)}
              className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors ${
                selectedMemberId === m.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>
      </div>

      {/* === 3 COLLAPSIBLE KPI PANELS === */}

      {/* Panel 1: Visão Mensal */}
      <CollapsiblePanel
        title="Visão Mensal"
        subtitle={activeMonth?.label}
        icon={<CalendarIcon size={15} className="text-primary" />}
        accentColor="bg-primary/15"
        defaultOpen={true}
      >
        <KpiGrid totals={monthTotals} goals={goalToMetrics(goals)} previousTotals={previousTotals} />
      </CollapsiblePanel>

      {/* Panel 2: Visão Semanal */}
      <CollapsiblePanel
        title="Visão Semanal"
        subtitle={weeksOfMonth[effectiveWeekIdx] ? `Semana ${weeksOfMonth[effectiveWeekIdx].weekNumber} — ${weeksOfMonth[effectiveWeekIdx].label}` : ""}
        icon={<CalendarRange size={15} className="text-accent" />}
        accentColor="bg-accent/15"
        defaultOpen={true}
        headerActions={
          weeksOfMonth.length > 0 ? (
            <div className="flex items-center gap-1.5">
              {currentWeekIdx >= 0 && (
                <button
                  onClick={() => setWeekPanelWeekIdx(currentWeekIdx)}
                  className={cn(
                    "px-2.5 py-1 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-colors flex items-center gap-1",
                    effectiveWeekIdx === currentWeekIdx
                      ? "bg-accent text-accent-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  <CalendarDays size={10} /> Atual
                </button>
              )}
              <div className="relative">
                <select
                  value={effectiveWeekIdx}
                  onChange={e => setWeekPanelWeekIdx(Number(e.target.value))}
                  className="appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-2.5 py-1 pr-6 rounded-md border border-border cursor-pointer outline-none"
                >
                  {weeksOfMonth.map((w, i) => (
                    <option key={i} value={i}>Sem {w.weekNumber}</option>
                  ))}
                </select>
                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          ) : undefined
        }
      >
        <KpiGrid totals={weekTotals} goals={weekGoals} />
      </CollapsiblePanel>

      {/* Panel 3: Visão Geral — Todos os SDRs */}
      <CollapsiblePanel
        title="Visão Geral — Todos os SDRs"
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
          <KpiGrid totals={allSdrTotals} goals={allSdrGoals} onCardClick={(key) => setMetricModalKey(key)} />

          {/* Per-SDR breakdown */}
          <div className="overflow-x-auto">
            <table className="w-full text-[10px]">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-semibold uppercase tracking-wider">SDR</th>
                  {METRIC_KEYS.map(k => (
                    <th key={k} className="text-right py-2 text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap px-1.5">
                      {METRIC_LABELS[k].substring(0, 8)}
                    </th>
                  ))}
                  <th className="text-right py-2 text-muted-foreground font-semibold uppercase tracking-wider px-1.5">Total</th>
                </tr>
              </thead>
              <tbody>
                {allSdrByMember.map((member, idx) => (
                  <tr key={member.id} className={cn(
                    "border-b border-border/50 hover:bg-secondary/30 transition-colors",
                    idx === 0 && "bg-[hsl(45,93%,47%)]/5"
                  )}>
                    <td className="py-2.5 text-card-foreground whitespace-nowrap font-semibold">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0",
                          idx === 0 ? "bg-[hsl(45,93%,47%)]/20 text-[hsl(45,93%,47%)]" :
                          idx === 1 ? "bg-[hsl(210,10%,70%)]/20 text-[hsl(210,10%,70%)]" :
                          idx === 2 ? "bg-[hsl(24,60%,45%)]/20 text-[hsl(24,60%,45%)]" :
                          "bg-secondary text-muted-foreground"
                        )}>
                          {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `${idx + 1}`}
                        </div>
                        <span className="text-xs">{member.name}</span>
                      </div>
                    </td>
                    {METRIC_KEYS.map(k => {
                      const val = member.totals[k] || 0;
                      const isTop = allSdrByMember.every(r => (r.totals[k] || 0) <= val) && val > 0;
                      return (
                        <td key={k} className={cn(
                          "text-right py-2.5 tabular-nums px-1.5",
                          isTop ? "text-[hsl(45,93%,47%)] font-bold" : val > 0 ? "text-card-foreground" : "text-muted-foreground/30"
                        )}>
                          {val}
                        </td>
                      );
                    })}
                    <td className="text-right py-2.5 tabular-nums px-1.5 font-bold text-card-foreground">
                      {member.grandTotal}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
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
        {dailyMetrics && members && (
          <CloserRanking dailyMetrics={dailyMetrics} members={members} />
        )}
      </div>

      {/* Person Performance */}
      {dailyMetrics && members && (
        <PersonPerformanceChart dailyMetrics={dailyMetrics} members={members} />
      )}

      {/* Table */}
      <DailyTableSection
        filteredMetrics={memberFilteredMetrics}
        members={members || []}
        selectedMemberId={selectedMemberId}
        hasActiveFilters={!!hasActiveFilters}
        monthLabel={activeMonth?.label}
      />

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
        metrics={allSdrMetrics}
        goals={allSdrGoals}
        periodLabel={
          allSdrPeriod === "month" ? activeMonth?.label :
          allSdrPeriod === "week" && weeksOfMonth[allSdrWeekIdx] ? `Semana ${weeksOfMonth[allSdrWeekIdx].weekNumber}` :
          format(allSdrDate, "dd/MM/yyyy", { locale: ptBR })
        }
      />
    </div>
  );
}

/** Sub-component: Daily table with "Hoje" button + date picker */
function DailyTableSection({
  filteredMetrics,
  members,
  selectedMemberId,
  hasActiveFilters,
  monthLabel,
}: {
  filteredMetrics: DbDailyMetric[];
  members: DbTeamMember[];
  selectedMemberId: string | null;
  hasActiveFilters: boolean;
  monthLabel?: string;
}) {
  const [dayFilter, setDayFilter] = useState<Date | undefined>(undefined);
  const todayStr = format(new Date(), "yyyy-MM-dd");

  const tableMetrics = useMemo(() => {
    if (!dayFilter) return filteredMetrics;
    const dayStr = format(dayFilter, "yyyy-MM-dd");
    return filteredMetrics.filter(d => d.date === dayStr);
  }, [filteredMetrics, dayFilter]);

  const isToday = dayFilter && format(dayFilter, "yyyy-MM-dd") === todayStr;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Detalhamento Diário
            {selectedMemberId && members.length ? ` — ${members.find(m => m.id === selectedMemberId)?.name}` : ""}
            {hasActiveFilters ? ` (${tableMetrics.length} registros)` : ""}
          </h3>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setDayFilter(dayFilter && isToday ? undefined : new Date())}
            className={cn(
              "px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors flex items-center gap-1",
              isToday ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            <CalendarDays size={12} /> Hoje
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button
                className={cn(
                  "px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors flex items-center gap-1",
                  dayFilter && !isToday ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                <CalendarDays size={12} />
                {dayFilter && !isToday ? format(dayFilter, "dd/MM", { locale: ptBR }) : "Escolher dia"}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="single"
                selected={dayFilter}
                onSelect={(d) => setDayFilter(d || undefined)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
          {dayFilter && (
            <button onClick={() => setDayFilter(undefined)} className="text-[10px] text-destructive hover:text-destructive/80 flex items-center gap-0.5">
              <X size={10} /> Limpar
            </button>
          )}
          <ExportCsvButton dailyMetrics={tableMetrics} members={members} monthLabel={monthLabel} />
        </div>
      </div>
      <DailyTable dailyMetrics={tableMetrics} members={members} selectedMemberId={selectedMemberId} />
    </div>
  );
}
