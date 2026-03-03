import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { DbWeeklyGoal, DbDailyMetric, METRIC_LABELS } from "@/lib/db";
import { startOfWeek, endOfWeek, parseISO, isWithinInterval, getISOWeek } from "date-fns";

interface WeeklyComparisonChartProps {
  weeklyGoals: DbWeeklyGoal[];
  metric: string;
  dailyMetrics?: DbDailyMetric[];
}

export function WeeklyComparisonChart({ weeklyGoals, metric, dailyMetrics }: WeeklyComparisonChartProps) {
  // Group daily metrics by week number to get actual values
  const actualByWeek: Record<number, number> = {};
  if (dailyMetrics) {
    dailyMetrics.forEach(d => {
      const date = parseISO(d.date);
      const weekNum = getISOWeek(date);
      // Map ISO week to sequential week number based on goals
      const goalWeeks = weeklyGoals.map(g => g.week_number);
      // Simple approach: use index-based mapping
      if (!actualByWeek[weekNum]) actualByWeek[weekNum] = 0;
      actualByWeek[weekNum] += (d as any)[metric] || 0;
    });
  }

  // Build data with week-based matching
  const weekNumbers = [...new Set(dailyMetrics?.map(d => getISOWeek(parseISO(d.date))) || [])].sort();
  
  const data = weeklyGoals.map((g, idx) => {
    const matchedWeek = weekNumbers[idx];
    return {
      name: `Sem ${g.week_number}`,
      meta: (g as any)[metric] || 0,
      realizado: matchedWeek ? (actualByWeek[matchedWeek] || 0) : 0,
    };
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-xs font-semibold text-card-foreground mb-4 uppercase tracking-wider">
        Realizado vs Meta — {METRIC_LABELS[metric]}
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={2} barCategoryGap="20%">
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 15%)" />
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <Tooltip
              contentStyle={{
                background: "hsl(222, 47%, 9%)",
                border: "1px solid hsl(222, 30%, 18%)",
                borderRadius: "8px",
                color: "hsl(210, 40%, 96%)",
                fontSize: 12,
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "hsl(215, 16%, 55%)" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar dataKey="meta" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Meta" opacity={0.4} />
            <Bar dataKey="realizado" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Realizado" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
