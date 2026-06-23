import { getPersonTotals, dailyData, METRIC_LABELS } from "@/data/prospecting-data";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const COLORS = ["hsl(217, 91%, 60%)", "hsl(160, 84%, 39%)", "hsl(280, 65%, 60%)"];

export function PersonSummary() {
  const totals = getPersonTotals(dailyData);
  const keyMetrics = ["followUp", "ligRealizada", "reuniaoRealizada"] as const;

  const chartData = totals.map(t => ({
    name: t.person,
    "Follow Up": t.followUp,
    "Lig. Realizada": t.ligRealizada,
    "Reunião Realizada": t.reuniaoRealizada,
  }));

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <h3 className="text-sm font-semibold text-card-foreground mb-4">Performance por Pessoa</h3>
      <div className="h-52">
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
              }}
            />
            <Bar dataKey="Follow Up" fill={COLORS[0]} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Lig. Realizada" fill={COLORS[1]} radius={[0, 4, 4, 0]} />
            <Bar dataKey="Reunião Realizada" fill={COLORS[2]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
