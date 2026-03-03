import { DbDailyMetric, DbTeamMember, sumMetrics, METRIC_LABELS } from "@/lib/db";
import { Trophy, TrendingUp, TrendingDown, Medal } from "lucide-react";
import { useState } from "react";

interface CloserRankingProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
}

const RANKING_METRICS = ["follow_up", "conexoes", "reuniao_realizada", "lig_realizada", "abordagens"];
const MEDAL_COLORS = ["hsl(var(--chart-4))", "hsl(var(--muted-foreground))", "hsl(24, 60%, 45%)"];

export function CloserRanking({ dailyMetrics, members }: CloserRankingProps) {
  const [metric, setMetric] = useState("follow_up");

  const ranked = members
    .map(m => {
      const totals = sumMetrics(dailyMetrics, m.id);
      return { ...m, total: totals[metric] || 0 };
    })
    .sort((a, b) => b.total - a.total);

  const maxVal = ranked[0]?.total || 1;

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy size={14} className="text-[hsl(var(--chart-4))]" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Ranking</h3>
        </div>
        <select
          value={metric}
          onChange={e => setMetric(e.target.value)}
          className="text-[10px] bg-secondary text-secondary-foreground rounded-lg px-2 py-1 border-none outline-none appearance-none cursor-pointer"
        >
          {RANKING_METRICS.map(m => (
            <option key={m} value={m}>{METRIC_LABELS[m]}</option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {ranked.map((member, idx) => {
          const pct = maxVal > 0 ? (member.total / maxVal) * 100 : 0;
          return (
            <div key={member.id} className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0" style={{
                background: idx < 3 ? `${MEDAL_COLORS[idx]}20` : "hsl(var(--secondary))",
              }}>
                {idx < 3 ? (
                  <Medal size={12} style={{ color: MEDAL_COLORS[idx] }} />
                ) : (
                  <span className="text-[9px] font-bold text-muted-foreground">{idx + 1}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-card-foreground truncate">{member.name}</span>
                  <span className="text-xs font-bold tabular-nums text-card-foreground">{member.total}</span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${pct}%`,
                      background: idx === 0 ? "hsl(var(--chart-4))" : idx === 1 ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                    }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
