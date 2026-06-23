import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { weeklyGoals, weeklyActuals } from "@/data/prospecting-data";

interface WeeklyChartProps {
  metric: string;
}

export function WeeklyChart({ metric }: WeeklyChartProps) {
  const data = weeklyGoals.map((goal, i) => ({
    name: `Sem ${goal.week}`,
    meta: (goal as any)[metric] as number,
    real: (weeklyActuals[i] as any)[metric] as number,
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={4}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(222, 30%, 18%)" />
          <XAxis dataKey="name" tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fill: "hsl(215, 16%, 55%)", fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip
            contentStyle={{
              background: "hsl(222, 47%, 9%)",
              border: "1px solid hsl(222, 30%, 18%)",
              borderRadius: "8px",
              color: "hsl(210, 40%, 96%)",
            }}
          />
          <Bar dataKey="meta" fill="hsl(217, 91%, 60%)" radius={[4, 4, 0, 0]} name="Meta" opacity={0.4} />
          <Bar dataKey="real" fill="hsl(160, 84%, 39%)" radius={[4, 4, 0, 0]} name="Realizado" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
