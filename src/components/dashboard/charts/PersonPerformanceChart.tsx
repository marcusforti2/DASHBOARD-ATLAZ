import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { DbDailyMetric, DbTeamMember, METRIC_LABELS, sumMetrics } from "@/lib/db";

const COLORS = ["hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)", "hsl(280, 65%, 60%)"];

interface PersonPerformanceChartProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
}

export function PersonPerformanceChart({ dailyMetrics, members }: PersonPerformanceChartProps) {
  const chartData = members.map(m => {
    const totals = sumMetrics(dailyMetrics, m.id);
    return {
      name: m.name,
      "Follow Up": totals.follow_up,
      "Lig. Realizada": totals.lig_realizada,
      "Reunião Realiz.": totals.reuniao_realizada,
    };
  });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-xs font-semibold text-card-foreground mb-4 uppercase tracking-wider">Performance por Pessoa</h3>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" barGap={2}>
            <XAxis type="number" tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" tick={{ fill: "hsl(210, 40%, 96%)", fontSize: 12 }} axisLine={false} tickLine={false} width={55} />
            <Tooltip
              contentStyle={{
                background: "hsl(222, 47%, 9%)",
                border: "1px solid hsl(222, 30%, 18%)",
                borderRadius: "8px",
                color: "hsl(210, 40%, 96%)",
                fontSize: 12,
              }}
            />
            <Bar dataKey="Follow Up" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Lig. Realizada" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Reunião Realiz." fill={COLORS[2]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
