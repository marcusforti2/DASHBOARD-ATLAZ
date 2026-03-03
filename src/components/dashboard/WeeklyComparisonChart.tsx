import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DbWeeklyGoal, METRIC_LABELS } from "@/lib/db";

interface WeeklyComparisonChartProps {
  weeklyGoals: DbWeeklyGoal[];
  metric: string;
}

export function WeeklyComparisonChart({ weeklyGoals, metric }: WeeklyComparisonChartProps) {
  const data = weeklyGoals.map(g => ({
    name: `Sem ${g.week_number}`,
    meta: (g as any)[metric] || 0,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-xs font-semibold text-card-foreground mb-4 uppercase tracking-wider">
        Metas Semanais — {METRIC_LABELS[metric]}
      </h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
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
            <Bar dataKey="meta" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Meta" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
