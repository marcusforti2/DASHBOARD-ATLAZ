import { useState } from "react";
import { useMonths, useTeamMembers, useMonthlyGoals, useWeeklyGoals, useDailyMetrics, useAiReports } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, METRIC_KEYS } from "@/lib/db";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { WeeklyComparisonChart } from "@/components/dashboard/WeeklyComparisonChart";
import { PersonPerformanceChart } from "@/components/dashboard/PersonPerformanceChart";
import { DailyTable } from "@/components/dashboard/DailyTable";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, BarChart3, Loader2 } from "lucide-react";

const CHART_METRICS = ["follow_up", "conexoes", "reuniao_realizada", "lig_realizada"];

export default function Index() {
  const queryClient = useQueryClient();
  const { data: months, isLoading: monthsLoading } = useMonths();
  const { data: members } = useTeamMembers();
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [selectedChartMetric, setSelectedChartMetric] = useState("follow_up");

  const activeMonthId = selectedMonthId || months?.[0]?.id;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  const { data: goals } = useMonthlyGoals(activeMonthId);
  const { data: weeklyGoals } = useWeeklyGoals(activeMonthId);
  const { data: dailyMetrics } = useDailyMetrics(activeMonthId);
  const { data: aiReports } = useAiReports(activeMonthId);

  const totals = dailyMetrics ? sumMetrics(dailyMetrics, selectedMemberId || undefined) : {};

  const isLoading = monthsLoading;

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" />
              <h1 className="text-sm font-bold text-foreground tracking-tight">LEARNING BRAND</h1>
            </div>
            <div className="h-5 w-px bg-border" />
            <div className="relative">
              <select
                value={activeMonthId || ""}
                onChange={e => setSelectedMonthId(e.target.value)}
                className="appearance-none bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1.5 pr-7 rounded-lg border-none cursor-pointer focus:ring-1 focus:ring-primary outline-none"
              >
                {months?.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

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
      </header>

      <main className="max-w-[1600px] mx-auto p-6 space-y-5">
        <KpiGrid totals={totals} goals={goals ? { ...goals } as Record<string, number> : null} />

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
            Detalhamento Diário {selectedMemberId && members ? `— ${members.find(m => m.id === selectedMemberId)?.name}` : ""}
          </h3>
          {dailyMetrics && members && (
            <DailyTable dailyMetrics={dailyMetrics} members={members} selectedMemberId={selectedMemberId} />
          )}
        </div>
      </main>
    </div>
  );
}
