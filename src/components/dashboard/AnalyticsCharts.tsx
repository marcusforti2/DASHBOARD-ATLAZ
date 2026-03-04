import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { parseISO, format, isWithinInterval } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp, Waves, Radar as RadarIcon, Users, User } from "lucide-react";
import { DbDailyMetric, DbTeamMember, DbWeeklyGoal, METRIC_KEYS, METRIC_LABELS, sumMetrics } from "@/lib/db";
import { cn } from "@/lib/utils";

type ChartType = "bar" | "line" | "area" | "radar";
type ViewMode = "weekly" | "daily" | "person";

const CHART_TYPES: { id: ChartType; label: string; icon: React.ElementType }[] = [
  { id: "bar", label: "Barras", icon: BarChart3 },
  { id: "line", label: "Linhas", icon: TrendingUp },
  { id: "area", label: "Área", icon: Waves },
  { id: "radar", label: "Radar", icon: RadarIcon },
];

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: "weekly", label: "Semanal", icon: BarChart3 },
  { id: "daily", label: "Diário", icon: TrendingUp },
  { id: "person", label: "Por Pessoa", icon: Users },
];

const PALETTE = [
  "hsl(217, 91%, 60%)",
  "hsl(160, 84%, 39%)",
  "hsl(280, 65%, 60%)",
  "hsl(45, 93%, 47%)",
  "hsl(0, 70%, 55%)",
  "hsl(190, 80%, 50%)",
  "hsl(330, 70%, 55%)",
  "hsl(120, 60%, 45%)",
  "hsl(30, 90%, 55%)",
  "hsl(250, 65%, 55%)",
];

const TOOLTIP_STYLE = {
  background: "hsl(222, 47%, 9%)",
  border: "1px solid hsl(222, 30%, 18%)",
  borderRadius: "10px",
  color: "hsl(210, 40%, 96%)",
  fontSize: 11,
  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)",
};

interface WeekInfo {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
}

interface AnalyticsChartsProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
  weeklyGoals?: DbWeeklyGoal[];
  weeksOfMonth: WeekInfo[];
}

export function AnalyticsCharts({ dailyMetrics, members, weeklyGoals, weeksOfMonth }: AnalyticsChartsProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["follow_up", "conexoes", "reuniao_realizada"]);

  const toggleMetric = (key: string) => {
    setSelectedMetrics(prev =>
      prev.includes(key)
        ? prev.length > 1 ? prev.filter(k => k !== key) : prev
        : [...prev, key]
    );
  };

  // Weekly data: meta vs realizado per week
  const weeklyData = useMemo(() => {
    if (!weeklyGoals || weeksOfMonth.length === 0) return [];
    return weeksOfMonth.map(w => {
      const weekMetrics = dailyMetrics.filter(d => d.date >= w.startDate && d.date <= w.endDate);
      const totals = weekMetrics.length > 0 ? sumMetrics(weekMetrics) : {};
      const goal = weeklyGoals.find(g => g.week_number === w.weekNumber);
      const entry: Record<string, any> = { name: `Sem ${w.weekNumber}` };
      selectedMetrics.forEach(k => {
        entry[METRIC_LABELS[k]] = totals[k] || 0;
        if (goal) entry[`Meta ${METRIC_LABELS[k]}`] = (goal as any)[k] || 0;
      });
      return entry;
    });
  }, [dailyMetrics, weeklyGoals, weeksOfMonth, selectedMetrics]);

  // Daily data: totals per day
  const dailyData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    dailyMetrics.forEach(d => {
      const existing = dateMap.get(d.date) || {};
      selectedMetrics.forEach(k => {
        existing[k] = (existing[k] || 0) + ((d as any)[k] || 0);
      });
      dateMap.set(d.date, existing);
    });
    return [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, vals]) => {
      const entry: Record<string, any> = { name: format(parseISO(date), "dd/MM", { locale: ptBR }) };
      selectedMetrics.forEach(k => { entry[METRIC_LABELS[k]] = vals[k] || 0; });
      return entry;
    });
  }, [dailyMetrics, selectedMetrics]);

  // Person data: totals per member
  const personData = useMemo(() => {
    return members.map(m => {
      const totals = sumMetrics(dailyMetrics, m.id);
      const entry: Record<string, any> = { name: m.name };
      selectedMetrics.forEach(k => { entry[METRIC_LABELS[k]] = totals[k] || 0; });
      return entry;
    });
  }, [dailyMetrics, members, selectedMetrics]);

  // Radar data
  const radarData = useMemo(() => {
    if (viewMode === "person") {
      // Each metric as an axis, each member as a series
      return selectedMetrics.map(k => {
        const entry: Record<string, any> = { metric: METRIC_LABELS[k] };
        members.forEach(m => {
          const totals = sumMetrics(dailyMetrics, m.id);
          entry[m.name] = totals[k] || 0;
        });
        return entry;
      });
    }
    // Default: metrics as axes, single total
    const totals = sumMetrics(dailyMetrics);
    return selectedMetrics.map(k => ({
      metric: METRIC_LABELS[k],
      valor: totals[k] || 0,
    }));
  }, [dailyMetrics, members, selectedMetrics, viewMode]);

  const activeData = viewMode === "weekly" ? weeklyData : viewMode === "daily" ? dailyData : personData;
  const dataKeys = selectedMetrics.map(k => METRIC_LABELS[k]);

  const renderChart = () => {
    if (chartType === "radar") {
      const radarKeys = viewMode === "person" ? members.map(m => m.name) : ["valor"];
      return (
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
            <PolarGrid stroke="hsl(222, 30%, 20%)" />
            <PolarAngleAxis
              dataKey="metric"
              tick={{ fill: "hsl(215, 16%, 65%)", fontSize: 10 }}
            />
            <PolarRadiusAxis
              tick={{ fill: "hsl(215, 16%, 45%)", fontSize: 9 }}
              axisLine={false}
            />
            {radarKeys.map((key, i) => (
              <Radar
                key={key}
                name={key === "valor" ? "Total" : key}
                dataKey={key}
                stroke={PALETTE[i % PALETTE.length]}
                fill={PALETTE[i % PALETTE.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
          </RadarChart>
        </ResponsiveContainer>
      );
    }

    const ChartComponent = chartType === "line" ? LineChart : chartType === "area" ? AreaChart : BarChart;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={activeData} barGap={2} barCategoryGap="20%">
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 15%)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />

          {dataKeys.map((key, i) => {
            const color = PALETTE[i % PALETTE.length];
            if (chartType === "line") {
              return (
                <Line
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(222, 47%, 9%)" }}
                />
              );
            }
            if (chartType === "area") {
              return (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={color}
                  strokeWidth={2}
                  fill={`url(#gradient-${i})`}
                />
              );
            }
            return (
              <Bar
                key={key}
                dataKey={key}
                fill={color}
                radius={[4, 4, 0, 0]}
                opacity={0.85}
              />
            );
          })}

          {/* Area gradients */}
          {chartType === "area" && (
            <defs>
              {dataKeys.map((_, i) => (
                <linearGradient key={i} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
          )}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="p-4 pb-3 border-b border-border/50">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" />
            Análise de Performance
          </h3>

          <div className="flex items-center gap-2">
            {/* View mode */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
              {VIEW_MODES.map(v => (
                <button
                  key={v.id}
                  onClick={() => setViewMode(v.id)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 text-[9px] rounded-md font-semibold uppercase tracking-wider transition-all",
                    viewMode === v.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <v.icon size={10} />
                  {v.label}
                </button>
              ))}
            </div>

            {/* Chart type */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
              {CHART_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setChartType(ct.id)}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    chartType === ct.id
                      ? "bg-accent text-accent-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  title={ct.label}
                >
                  <ct.icon size={12} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metric selector pills */}
        <div className="flex flex-wrap items-center gap-1 mt-3">
          {METRIC_KEYS.map((k, i) => (
            <button
              key={k}
              onClick={() => toggleMetric(k)}
              className={cn(
                "px-2 py-0.5 text-[9px] rounded-full font-semibold uppercase tracking-wider transition-all border",
                selectedMetrics.includes(k)
                  ? "border-transparent text-white shadow-sm"
                  : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent"
              )}
              style={selectedMetrics.includes(k) ? { backgroundColor: PALETTE[i % PALETTE.length] } : {}}
            >
              {METRIC_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-4 h-80">
        {activeData.length > 0 || chartType === "radar" ? (
          renderChart()
        ) : (
          <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
            Sem dados para exibir
          </div>
        )}
      </div>
    </div>
  );
}
