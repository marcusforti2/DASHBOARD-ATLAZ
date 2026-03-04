import { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { parseISO, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BarChart3, TrendingUp, Waves, Radar as RadarIcon, Users, PieChart as PieIcon, Layers, Grid3X3, ArrowDownNarrowWide } from "lucide-react";
import { DbDailyMetric, DbTeamMember, DbWeeklyGoal, METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, METRIC_LABELS, sumMetrics } from "@/lib/db";
import { cn } from "@/lib/utils";

type ChartType = "bar" | "stacked" | "line" | "area" | "radar" | "donut" | "heatmap" | "funnel";
type ViewMode = "weekly" | "daily" | "person";
type TeamFilter = "all" | "sdr" | "closer";

const CHART_TYPES: { id: ChartType; label: string; icon: React.ElementType }[] = [
  { id: "bar", label: "Barras", icon: BarChart3 },
  { id: "stacked", label: "Empilhadas", icon: Layers },
  { id: "line", label: "Linhas", icon: TrendingUp },
  { id: "area", label: "Área", icon: Waves },
  { id: "radar", label: "Radar", icon: RadarIcon },
  { id: "donut", label: "Donut", icon: PieIcon },
  { id: "heatmap", label: "Heatmap", icon: Grid3X3 },
  { id: "funnel", label: "Funil", icon: ArrowDownNarrowWide },
];

const VIEW_MODES: { id: ViewMode; label: string; icon: React.ElementType }[] = [
  { id: "weekly", label: "Semanal", icon: BarChart3 },
  { id: "daily", label: "Diário", icon: TrendingUp },
  { id: "person", label: "Por Pessoa", icon: Users },
];

const TEAM_FILTERS: { id: TeamFilter; label: string }[] = [
  { id: "all", label: "Time" },
  { id: "sdr", label: "SDR" },
  { id: "closer", label: "Closer" },
];

const PALETTE = [
  "hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)", "hsl(280, 65%, 60%)",
  "hsl(45, 93%, 47%)", "hsl(0, 70%, 55%)", "hsl(190, 80%, 50%)",
  "hsl(330, 70%, 55%)", "hsl(120, 60%, 45%)", "hsl(30, 90%, 55%)", "hsl(250, 65%, 55%)",
];

const TOOLTIP_STYLE = {
  background: "hsl(222, 47%, 9%)",
  border: "1px solid hsl(222, 30%, 18%)",
  borderRadius: "10px",
  color: "hsl(210, 40%, 96%)",
  fontSize: 11,
  boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)",
};

interface WeekInfo { weekNumber: number; label: string; startDate: string; endDate: string; }

interface AnalyticsChartsProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
  weeklyGoals?: DbWeeklyGoal[];
  weeksOfMonth: WeekInfo[];
}

export function AnalyticsCharts({ dailyMetrics, members, weeklyGoals, weeksOfMonth }: AnalyticsChartsProps) {
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [viewMode, setViewMode] = useState<ViewMode>("weekly");
  const [teamFilter, setTeamFilter] = useState<TeamFilter>("all");
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(["follow_up", "conexoes", "reuniao_realizada"]);

  const filteredMembers = useMemo(() => {
    if (teamFilter === "sdr") return members.filter(m => m.member_role === "sdr");
    if (teamFilter === "closer") return members.filter(m => m.member_role === "closer");
    return members;
  }, [members, teamFilter]);

  const availableMetrics = useMemo((): readonly string[] => {
    if (teamFilter === "sdr") return SDR_METRIC_KEYS;
    if (teamFilter === "closer") return CLOSER_METRIC_KEYS;
    return METRIC_KEYS;
  }, [teamFilter]);

  const filteredDailyMetrics = useMemo(() => {
    if (teamFilter === "all") return dailyMetrics;
    const memberIds = new Set(filteredMembers.map(m => m.id));
    return dailyMetrics.filter(d => memberIds.has(d.member_id));
  }, [dailyMetrics, filteredMembers, teamFilter]);

  const activeSelectedMetrics = useMemo(() => {
    const valid = selectedMetrics.filter(k => availableMetrics.includes(k));
    if (valid.length === 0) return availableMetrics.slice(0, Math.min(3, availableMetrics.length)) as string[];
    return valid;
  }, [selectedMetrics, availableMetrics]);

  const toggleMetric = (key: string) => {
    const current = activeSelectedMetrics;
    if (current.includes(key)) {
      if (current.length > 1) setSelectedMetrics(current.filter(k => k !== key));
    } else {
      setSelectedMetrics([...current, key]);
    }
  };

  const getMetricPaletteIndex = (key: string) => {
    const allIdx = (METRIC_KEYS as readonly string[]).indexOf(key);
    return allIdx >= 0 ? allIdx : 0;
  };

  const getColor = (metricKey: string) => PALETTE[getMetricPaletteIndex(metricKey) % PALETTE.length];

  // === DATA ===
  const weeklyData = useMemo(() => {
    if (!weeklyGoals || weeksOfMonth.length === 0) return [];
    return weeksOfMonth.map(w => {
      const weekMetrics = filteredDailyMetrics.filter(d => d.date >= w.startDate && d.date <= w.endDate);
      const totals = weekMetrics.length > 0 ? sumMetrics(weekMetrics) : {};
      const entry: Record<string, any> = { name: `Sem ${w.weekNumber}` };
      activeSelectedMetrics.forEach(k => { entry[METRIC_LABELS[k]] = totals[k] || 0; });
      return entry;
    });
  }, [filteredDailyMetrics, weeklyGoals, weeksOfMonth, activeSelectedMetrics]);

  const dailyData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    filteredDailyMetrics.forEach(d => {
      const existing = dateMap.get(d.date) || {};
      activeSelectedMetrics.forEach(k => { existing[k] = (existing[k] || 0) + ((d as any)[k] || 0); });
      dateMap.set(d.date, existing);
    });
    return [...dateMap.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, vals]) => {
      const entry: Record<string, any> = { name: format(parseISO(date), "dd/MM", { locale: ptBR }) };
      activeSelectedMetrics.forEach(k => { entry[METRIC_LABELS[k]] = vals[k] || 0; });
      return entry;
    });
  }, [filteredDailyMetrics, activeSelectedMetrics]);

  const personData = useMemo(() => {
    return filteredMembers.map(m => {
      const totals = sumMetrics(filteredDailyMetrics, m.id);
      const entry: Record<string, any> = { name: m.name };
      activeSelectedMetrics.forEach(k => { entry[METRIC_LABELS[k]] = totals[k] || 0; });
      return entry;
    });
  }, [filteredDailyMetrics, filteredMembers, activeSelectedMetrics]);

  const radarData = useMemo(() => {
    if (viewMode === "person") {
      return activeSelectedMetrics.map(k => {
        const entry: Record<string, any> = { metric: METRIC_LABELS[k] };
        filteredMembers.forEach(m => { entry[m.name] = sumMetrics(filteredDailyMetrics, m.id)[k] || 0; });
        return entry;
      });
    }
    const totals = sumMetrics(filteredDailyMetrics);
    return activeSelectedMetrics.map(k => ({ metric: METRIC_LABELS[k], valor: totals[k] || 0 }));
  }, [filteredDailyMetrics, filteredMembers, activeSelectedMetrics, viewMode]);

  // Donut data
  const donutData = useMemo(() => {
    const totals = sumMetrics(filteredDailyMetrics);
    return activeSelectedMetrics.map(k => ({
      name: METRIC_LABELS[k],
      value: totals[k] || 0,
      color: getColor(k),
    }));
  }, [filteredDailyMetrics, activeSelectedMetrics]);

  // Heatmap data: days x metrics
  const heatmapData = useMemo(() => {
    const dateMap = new Map<string, Record<string, number>>();
    filteredDailyMetrics.forEach(d => {
      const existing = dateMap.get(d.date) || {};
      activeSelectedMetrics.forEach(k => { existing[k] = (existing[k] || 0) + ((d as any)[k] || 0); });
      dateMap.set(d.date, existing);
    });
    return { dates: [...dateMap.keys()].sort(), map: dateMap };
  }, [filteredDailyMetrics, activeSelectedMetrics]);

  // Funnel data: show metrics in order as a conversion funnel
  const funnelData = useMemo(() => {
    const totals = sumMetrics(filteredDailyMetrics);
    return activeSelectedMetrics
      .map(k => ({ name: METRIC_LABELS[k], value: totals[k] || 0, fill: getColor(k) }))
      .sort((a, b) => b.value - a.value);
  }, [filteredDailyMetrics, activeSelectedMetrics]);

  const activeData = viewMode === "weekly" ? weeklyData : viewMode === "daily" ? dailyData : personData;
  const dataKeys = activeSelectedMetrics.map(k => METRIC_LABELS[k]);

  // === RENDERERS ===
  const renderRadar = () => {
    const radarKeys = viewMode === "person" ? filteredMembers.map(m => m.name) : ["valor"];
    return (
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(222, 30%, 20%)" />
          <PolarAngleAxis dataKey="metric" tick={{ fill: "hsl(215, 16%, 65%)", fontSize: 10 }} />
          <PolarRadiusAxis tick={{ fill: "hsl(215, 16%, 45%)", fontSize: 9 }} axisLine={false} />
          {radarKeys.map((key, i) => (
            <Radar key={key} name={key === "valor" ? "Total" : key} dataKey={key}
              stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]}
              fillOpacity={0.15} strokeWidth={2} />
          ))}
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
        </RadarChart>
      </ResponsiveContainer>
    );
  };

  const renderDonut = () => {
    const total = donutData.reduce((s, d) => s + d.value, 0);
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={donutData} cx="50%" cy="50%" innerRadius="55%" outerRadius="80%"
            dataKey="value" nameKey="name" paddingAngle={3} stroke="none">
            {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [`${value} (${total > 0 ? Math.round((value / total) * 100) : 0}%)`, name]} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />
          <text x="50%" y="48%" textAnchor="middle" fill="hsl(210, 40%, 96%)" fontSize={22} fontWeight="bold">{total}</text>
          <text x="50%" y="56%" textAnchor="middle" fill="hsl(215, 16%, 55%)" fontSize={9}>TOTAL</text>
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderHeatmap = () => {
    const { dates, map } = heatmapData;
    if (dates.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sem dados</div>;

    // Find max per metric for color scaling
    const maxPerMetric: Record<string, number> = {};
    activeSelectedMetrics.forEach(k => {
      let max = 0;
      dates.forEach(d => { max = Math.max(max, map.get(d)?.[k] || 0); });
      maxPerMetric[k] = max || 1;
    });

    return (
      <div className="overflow-x-auto h-full flex flex-col">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full text-[9px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-card">
                <th className="text-left py-1.5 px-2 text-muted-foreground font-semibold uppercase tracking-wider sticky left-0 bg-card">Dia</th>
                {activeSelectedMetrics.map(k => (
                  <th key={k} className="text-center py-1.5 px-1 text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap">
                    {METRIC_LABELS[k]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {dates.map(date => {
                const vals = map.get(date) || {};
                return (
                  <tr key={date} className="border-t border-border/30">
                    <td className="py-1 px-2 text-card-foreground font-medium whitespace-nowrap sticky left-0 bg-card">
                      {format(parseISO(date), "dd/MM", { locale: ptBR })}
                    </td>
                    {activeSelectedMetrics.map(k => {
                      const val = vals[k] || 0;
                      const intensity = maxPerMetric[k] > 0 ? val / maxPerMetric[k] : 0;
                      const color = getColor(k);
                      return (
                        <td key={k} className="text-center py-1 px-1">
                          <div
                            className="mx-auto w-full max-w-[48px] rounded-md py-0.5 font-bold text-[10px]"
                            style={{
                              backgroundColor: `color-mix(in srgb, ${color} ${Math.round(intensity * 70 + 10)}%, transparent)`,
                              color: intensity > 0.4 ? "white" : "hsl(215, 16%, 55%)",
                            }}
                          >
                            {val}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const FUNNEL_COLORS = [
    '#3B82F6', '#10B981', '#A855F7', '#F59E0B', '#EF4444',
    '#06B6D4', '#EC4899', '#84CC16', '#F97316', '#6366F1',
  ];

  const renderFunnel = () => {
    if (funnelData.length === 0) return <div className="flex items-center justify-center h-full text-muted-foreground text-xs">Sem dados</div>;
    const maxVal = Math.max(...funnelData.map(d => d.value), 1);
    const total = funnelData.reduce((s, d) => s + d.value, 0);
    const count = funnelData.length;

    return (
      <div className="h-full w-full flex items-center justify-center py-3 px-4 overflow-hidden">
        <div className="flex w-full max-w-2xl gap-6">
          {/* Funnel visual */}
          <div className="flex-1 flex flex-col items-center gap-0">
            {funnelData.map((item, i) => {
              const color = FUNNEL_COLORS[i % FUNNEL_COLORS.length];
              const widthPct = 30 + (item.value / maxVal) * 70;
              const nextWidthPct = i < count - 1 ? 30 + (funnelData[i + 1].value / maxVal) * 70 : widthPct * 0.5;
              const segH = Math.max(32, Math.min(48, 280 / count));
              const convRate = i > 0 && funnelData[i - 1].value > 0
                ? Math.round((item.value / funnelData[i - 1].value) * 100) : null;
              const pctTotal = total > 0 ? Math.round((item.value / total) * 100) : 0;

              // Trapezoid points
              const topL = 50 - widthPct / 2;
              const topR = 50 + widthPct / 2;
              const botL = 50 - nextWidthPct / 2;
              const botR = 50 + nextWidthPct / 2;

              return (
                <div
                  key={i}
                  className="relative w-full group"
                  style={{
                    opacity: 0,
                    animation: `funnel-stage-in 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  <div className="relative flex items-center w-full" style={{ height: `${segH}px` }}>
                    {/* Conversion rate - left */}
                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-16 text-right pr-2">
                      {convRate !== null && (
                        <span className={cn(
                          "text-[10px] font-bold tabular-nums",
                          convRate >= 50 ? "text-accent" : convRate >= 20 ? "text-amber-400" : "text-destructive"
                        )}>
                          ↓{convRate}%
                        </span>
                      )}
                    </div>

                    {/* Trapezoid shape */}
                    <div className="flex-1 flex justify-center px-16">
                      <div
                        className="relative transition-transform duration-300 group-hover:scale-[1.03] cursor-pointer"
                        style={{ width: '100%', height: `${segH}px` }}
                      >
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="w-full h-full" style={{ filter: `drop-shadow(0 2px 8px ${color}44)` }}>
                          <defs>
                            <linearGradient id={`fg-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor={color} stopOpacity="1" />
                              <stop offset="100%" stopColor={color} stopOpacity="0.7" />
                            </linearGradient>
                            <linearGradient id={`fshine-${i}`} x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="white" stopOpacity="0.25" />
                              <stop offset="40%" stopColor="white" stopOpacity="0.05" />
                              <stop offset="100%" stopColor="white" stopOpacity="0" />
                            </linearGradient>
                          </defs>
                          {/* Main shape */}
                          <polygon
                            points={`${topL},0 ${topR},0 ${botR},100 ${botL},100`}
                            fill={`url(#fg-${i})`}
                          />
                          {/* Shine overlay */}
                          <polygon
                            points={`${topL},0 ${topR},0 ${botR},100 ${botL},100`}
                            fill={`url(#fshine-${i})`}
                          />
                          {/* Left edge highlight */}
                          <line x1={topL} y1="0" x2={botL} y2="100" stroke="white" strokeOpacity="0.15" strokeWidth="0.5" />
                        </svg>

                        {/* Centered value */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="text-sm font-black text-white tabular-nums drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                            {item.value.toLocaleString("pt-BR")}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Label - right */}
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 pl-2 min-w-[120px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}88` }} />
                        <div className="flex flex-col">
                          <span className="text-[11px] font-semibold text-card-foreground whitespace-nowrap leading-tight">{item.name}</span>
                          <span className="text-[9px] text-muted-foreground tabular-nums">{pctTotal}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderBarOrLineOrArea = () => {
    const isStacked = chartType === "stacked";
    const ChartComponent = (chartType === "line") ? LineChart : (chartType === "area") ? AreaChart : BarChart;

    return (
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent data={activeData} barGap={isStacked ? 0 : 2} barCategoryGap="20%">
          <defs>
            {chartType === "area" && dataKeys.map((_, i) => {
              const color = getColor(activeSelectedMetrics[i]);
              return (
                <linearGradient key={i} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.02} />
                </linearGradient>
              );
            })}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 15%)" />
          <XAxis dataKey="name" tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" iconSize={6} />

          {dataKeys.map((key, i) => {
            const color = getColor(activeSelectedMetrics[i]);
            if (chartType === "line") {
              return <Line key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2.5}
                dot={{ r: 4, fill: color, strokeWidth: 0 }}
                activeDot={{ r: 6, strokeWidth: 2, stroke: "hsl(222, 47%, 9%)" }} />;
            }
            if (chartType === "area") {
              return <Area key={key} type="monotone" dataKey={key} stroke={color} strokeWidth={2} fill={`url(#gradient-${i})`} />;
            }
            // bar or stacked
            return <Bar key={key} dataKey={key} fill={color} radius={isStacked ? [0, 0, 0, 0] : [4, 4, 0, 0]}
              opacity={0.85} stackId={isStacked ? "stack" : undefined} />;
          })}
        </ChartComponent>
      </ResponsiveContainer>
    );
  };

  const renderChart = () => {
    if (chartType === "radar") return renderRadar();
    if (chartType === "donut") return renderDonut();
    if (chartType === "heatmap") return renderHeatmap();
    if (chartType === "funnel") return renderFunnel();
    return renderBarOrLineOrArea();
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Team filter */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
              {TEAM_FILTERS.map(tf => (
                <button key={tf.id} onClick={() => setTeamFilter(tf.id)}
                  className={cn(
                    "px-2.5 py-1 text-[9px] rounded-md font-semibold uppercase tracking-wider transition-all",
                    teamFilter === tf.id
                      ? tf.id === "sdr" ? "bg-primary text-primary-foreground shadow-sm"
                        : tf.id === "closer" ? "bg-[hsl(280,65%,60%)] text-white shadow-sm"
                        : "bg-[hsl(45,93%,47%)] text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}>
                  {tf.label}
                </button>
              ))}
            </div>

            {/* View mode */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
              {VIEW_MODES.map(v => (
                <button key={v.id} onClick={() => setViewMode(v.id)}
                  className={cn(
                    "flex items-center gap-1 px-2.5 py-1 text-[9px] rounded-md font-semibold uppercase tracking-wider transition-all",
                    viewMode === v.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}>
                  <v.icon size={10} />
                  {v.label}
                </button>
              ))}
            </div>

            {/* Chart type */}
            <div className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
              {CHART_TYPES.map(ct => (
                <button key={ct.id} onClick={() => setChartType(ct.id)}
                  className={cn(
                    "p-1.5 rounded-md transition-all",
                    chartType === ct.id ? "bg-accent text-accent-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  title={ct.label}>
                  <ct.icon size={12} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Metric selector pills */}
        <div className="flex flex-wrap items-center gap-1 mt-3">
          {availableMetrics.map((k) => {
            const isSelected = activeSelectedMetrics.includes(k);
            return (
              <button key={k} onClick={() => toggleMetric(k)}
                className={cn(
                  "px-2 py-0.5 text-[9px] rounded-full font-semibold uppercase tracking-wider transition-all border",
                  isSelected ? "border-transparent text-white shadow-sm" : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30 bg-transparent"
                )}
                style={isSelected ? { backgroundColor: getColor(k) } : {}}>
                {METRIC_LABELS[k]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Chart */}
      <div className={cn("p-4", chartType === "heatmap" ? "h-96" : "h-80")}>
        {(activeData.length > 0 || ["radar", "donut", "funnel", "heatmap"].includes(chartType)) ? (
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
