import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { DbWeeklyGoal, DbDailyMetric, METRIC_LABELS } from "@/lib/db";
import { parseISO, isWithinInterval } from "date-fns";

interface WeeklyComparisonChartProps {
  weeklyGoals: DbWeeklyGoal[];
  metric: string;
  dailyMetrics?: DbDailyMetric[];
}

export function WeeklyComparisonChart({ weeklyGoals, metric, dailyMetrics }: WeeklyComparisonChartProps) {
  const data = weeklyGoals.map((g) => {
    const startDate = (g as any).start_date;
    const endDate = (g as any).end_date;
    let realizado = 0;

    if (dailyMetrics && startDate && endDate) {
      // Match daily metrics by real date range
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      dailyMetrics.forEach(d => {
        const date = parseISO(d.date);
        if (isWithinInterval(date, { start, end })) {
          realizado += (d as any)[metric] || 0;
        }
      });
    } else if (dailyMetrics) {
      // Fallback: sequential matching by sorting dates into week buckets
      const sortedDates = [...new Set(dailyMetrics.map(d => d.date))].sort();
      const daysPerWeek = Math.ceil(sortedDates.length / weeklyGoals.length);
      const weekIdx = weeklyGoals.indexOf(g);
      const weekDates = new Set(sortedDates.slice(weekIdx * daysPerWeek, (weekIdx + 1) * daysPerWeek));
      dailyMetrics.forEach(d => {
        if (weekDates.has(d.date)) {
          realizado += (d as any)[metric] || 0;
        }
      });
    }

    const dateLabel = (g as any).start_date && (g as any).end_date
      ? `Sem ${g.week_number} (${formatShort((g as any).start_date)}–${formatShort((g as any).end_date)})`
      : `Sem ${g.week_number}`;

    return {
      name: dateLabel,
      meta: (g as any)[metric] || 0,
      realizado,
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
            <XAxis dataKey="name" tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 10 }} axisLine={false} tickLine={false} />
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
            <Legend wrapperStyle={{ fontSize: 11, color: "hsl(215, 16%, 55%)" }} iconType="circle" iconSize={8} />
            <Bar dataKey="meta" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Meta" opacity={0.4} />
            <Bar dataKey="realizado" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Realizado" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function formatShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}
