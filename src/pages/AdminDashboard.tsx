import { useState, useMemo } from "react";
import { useMonths, useTeamMembers, useMonthlyGoals, useWeeklyGoals, useDailyMetrics, useAiReports } from "@/hooks/use-metrics";
import { sumMetrics, goalToMetrics, METRIC_LABELS, METRIC_KEYS, DbDailyMetric, DbTeamMember } from "@/lib/db";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { WeeklyComparisonChart } from "@/components/dashboard/WeeklyComparisonChart";
import { PersonPerformanceChart } from "@/components/dashboard/PersonPerformanceChart";
import { CloserRanking } from "@/components/dashboard/CloserRanking";
import { DailyTable } from "@/components/dashboard/DailyTable";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { AlertsPanel } from "@/components/dashboard/AlertsPanel";
import { ExportCsvButton } from "@/components/dashboard/ExportCsvButton";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Filter, X, CalendarDays } from "lucide-react";
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

  // Advanced filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string | null>(null);
  const [minMetricFilter, setMinMetricFilter] = useState<{ key: string; value: number } | null>(null);

  const activeMonthId = selectedMonthId || months?.[0]?.id;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  // Previous month for trends
  const activeMonthIdx = months?.findIndex(m => m.id === activeMonthId) ?? -1;
  const previousMonthId = activeMonthIdx >= 0 && months?.[activeMonthIdx + 1]?.id;

  const { data: goals } = useMonthlyGoals(activeMonthId, selectedMemberId);
  const { data: weeklyGoals } = useWeeklyGoals(activeMonthId, selectedMemberId);
  const { data: dailyMetrics } = useDailyMetrics(activeMonthId);
  const { data: previousMetrics } = useDailyMetrics(previousMonthId || undefined);
  const { data: aiReports } = useAiReports(activeMonthId);

  // Apply filters
  const filteredMetrics = useMemo(() => {
    if (!dailyMetrics) return [];
    let result = [...dailyMetrics];
    if (selectedMemberId) result = result.filter(d => d.member_id === selectedMemberId);
    if (dateFrom) result = result.filter(d => d.date >= dateFrom);
    if (dateTo) result = result.filter(d => d.date <= dateTo);
    if (selectedDayOfWeek) result = result.filter(d => d.day_of_week === selectedDayOfWeek);
    if (minMetricFilter) result = result.filter(d => (d as any)[minMetricFilter.key] >= minMetricFilter.value);
    return result;
  }, [dailyMetrics, selectedMemberId, dateFrom, dateTo, selectedDayOfWeek, minMetricFilter]);

  const totals = filteredMetrics.length > 0 ? sumMetrics(filteredMetrics) : {};
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

      {/* KPIs */}
      <KpiGrid totals={totals} goals={goalToMetrics(goals)} previousTotals={previousTotals} />

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
              dailyMetrics={filteredMetrics}
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
        filteredMetrics={filteredMetrics}
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
          metrics={totals}
          goals={goalToMetrics(goals)}
          members={members?.map(m => m.name) || []}
          existingReports={aiReports || []}
          onReportGenerated={() => queryClient.invalidateQueries({ queryKey: ["ai-reports", activeMonthId] })}
        />
      )}

      {/* Alerts */}
      {dailyMetrics && members && (
        <AlertsPanel
          dailyMetrics={filteredMetrics}
          members={members}
          goals={goalToMetrics(goals)}
        />
      )}
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
