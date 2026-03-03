import { useState, useMemo } from "react";
import { useMonths, useTeamMembers, useMonthlyGoals, useWeeklyGoals, useDailyMetrics, useAiReports } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, METRIC_KEYS, DbDailyMetric } from "@/lib/db";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { WeeklyComparisonChart } from "@/components/dashboard/WeeklyComparisonChart";
import { PersonPerformanceChart } from "@/components/dashboard/PersonPerformanceChart";
import { DailyTable } from "@/components/dashboard/DailyTable";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Filter, Calendar, Users, X } from "lucide-react";
import { format, parseISO, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHART_METRICS = ["follow_up", "conexoes", "reuniao_realizada", "lig_realizada"];

interface AdminDashboardProps {
  onSignOut: () => void;
  userName: string;
}

export default function AdminDashboard({ onSignOut, userName }: AdminDashboardProps) {
  const queryClient = useQueryClient();
  const { data: months, isLoading: monthsLoading } = useMonths();
  const { data: members } = useTeamMembers();
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedChartMetric, setSelectedChartMetric] = useState("follow_up");

  // Advanced filters
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedDayOfWeek, setSelectedDayOfWeek] = useState<string | null>(null);
  const [minMetricFilter, setMinMetricFilter] = useState<{ key: string; value: number } | null>(null);

  const activeMonthId = selectedMonthId || months?.[0]?.id;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  const { data: goals } = useMonthlyGoals(activeMonthId);
  const { data: weeklyGoals } = useWeeklyGoals(activeMonthId);
  const { data: dailyMetrics } = useDailyMetrics(activeMonthId);
  const { data: aiReports } = useAiReports(activeMonthId);

  // Apply filters
  const filteredMetrics = useMemo(() => {
    if (!dailyMetrics) return [];
    let result = [...dailyMetrics];

    if (selectedMemberId) {
      result = result.filter(d => d.member_id === selectedMemberId);
    }
    if (dateFrom) {
      result = result.filter(d => d.date >= dateFrom);
    }
    if (dateTo) {
      result = result.filter(d => d.date <= dateTo);
    }
    if (selectedDayOfWeek) {
      result = result.filter(d => d.day_of_week === selectedDayOfWeek);
    }
    if (minMetricFilter) {
      result = result.filter(d => (d as any)[minMetricFilter.key] >= minMetricFilter.value);
    }
    return result;
  }, [dailyMetrics, selectedMemberId, dateFrom, dateTo, selectedDayOfWeek, minMetricFilter]);

  const totals = filteredMetrics.length > 0 ? sumMetrics(filteredMetrics) : {};
  const hasActiveFilters = dateFrom || dateTo || selectedDayOfWeek || minMetricFilter;

  const clearFilters = () => {
    setDateFrom("");
    setDateTo("");
    setSelectedDayOfWeek(null);
    setMinMetricFilter(null);
  };

  if (monthsLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <main className="max-w-[1600px] mx-auto p-6 space-y-5">
      <KpiGrid totals={totals} goals={goals ? { ...goals } as Record<string, number> : null} />

      {/* Filters Panel */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-border">
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

      {/* Charts */}
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
          {weeklyGoals && <WeeklyComparisonChart weeklyGoals={weeklyGoals} metric={selectedChartMetric} />}
        </div>
        {dailyMetrics && members && (
          <PersonPerformanceChart dailyMetrics={dailyMetrics} members={members} />
        )}
      </div>

      {/* AI Report */}
      {activeMonthId && activeMonth && (
        <AiReportPanel
          monthId={activeMonthId}
          monthLabel={activeMonth.label}
          metrics={totals}
          goals={goals ? { ...goals } as Record<string, number> : null}
          members={members?.map(m => m.name) || []}
          existingReports={aiReports || []}
          onReportGenerated={() => queryClient.invalidateQueries({ queryKey: ["ai-reports", activeMonthId] })}
        />
      )}

      {/* Table */}
      <div>
        <h3 className="text-xs font-semibold text-foreground mb-3 uppercase tracking-wider">
          Detalhamento Diário
          {selectedMemberId && members ? ` — ${members.find(m => m.id === selectedMemberId)?.name}` : ""}
          {hasActiveFilters ? ` (${filteredMetrics.length} registros filtrados)` : ""}
        </h3>
        {members && (
          <DailyTable dailyMetrics={filteredMetrics} members={members} selectedMemberId={selectedMemberId} />
        )}
      </div>
    </main>
  );
}
