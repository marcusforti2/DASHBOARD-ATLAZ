import { DbDailyMetric, DbTeamMember, sumMetrics, METRIC_LABELS, METRIC_KEYS, getMemberAvatar } from "@/lib/db";
import { Trophy, Medal, Crown, Flame, Star, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface CloserRankingProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
}

const RANKING_METRICS = ["_all", "follow_up", "conexoes", "reuniao_realizada", "lig_realizada", "abordagens", "conexoes_aceitas", "inmail", "numero", "lig_agendada", "reuniao_agendada"];

const RANKING_LABELS: Record<string, string> = {
  _all: "Todas",
  ...METRIC_LABELS,
};

const PODIUM_STYLES = [
  {
    ring: "ring-2 ring-[hsl(45,93%,47%)]/40",
    bg: "bg-gradient-to-br from-[hsl(45,93%,47%)]/15 to-[hsl(45,93%,47%)]/5",
    glow: "shadow-[0_0_24px_-4px_hsl(45,93%,47%,0.3)]",
    badge: "bg-gradient-to-br from-[hsl(45,93%,47%)] to-[hsl(35,90%,42%)]",
    text: "text-[hsl(45,93%,47%)]",
    bar: "from-[hsl(45,93%,47%)] to-[hsl(35,90%,42%)]",
    label: "🥇",
  },
  {
    ring: "ring-2 ring-[hsl(210,10%,70%)]/30",
    bg: "bg-gradient-to-br from-[hsl(210,10%,70%)]/10 to-[hsl(210,10%,60%)]/5",
    glow: "shadow-[0_0_16px_-4px_hsl(210,10%,70%,0.2)]",
    badge: "bg-gradient-to-br from-[hsl(210,10%,75%)] to-[hsl(210,10%,55%)]",
    text: "text-[hsl(210,10%,70%)]",
    bar: "from-[hsl(210,10%,75%)] to-[hsl(210,10%,55%)]",
    label: "🥈",
  },
  {
    ring: "ring-2 ring-[hsl(24,60%,45%)]/30",
    bg: "bg-gradient-to-br from-[hsl(24,60%,45%)]/10 to-[hsl(24,50%,35%)]/5",
    glow: "shadow-[0_0_16px_-4px_hsl(24,60%,45%,0.2)]",
    badge: "bg-gradient-to-br from-[hsl(24,60%,50%)] to-[hsl(24,50%,35%)]",
    text: "text-[hsl(24,60%,45%)]",
    bar: "from-[hsl(24,60%,50%)] to-[hsl(24,50%,35%)]",
    label: "🥉",
  },
];

export function CloserRanking({ dailyMetrics, members }: CloserRankingProps) {
  const [metric, setMetric] = useState("_all");
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  const ranked = useMemo(() => {
    return members
      .map(m => {
        const totals = sumMetrics(dailyMetrics, m.id);
        const allTotal = METRIC_KEYS.reduce((s, k) => s + (totals[k] || 0), 0);
        return {
          ...m,
          total: metric === "_all" ? allTotal : (totals[metric] || 0),
          allTotals: totals,
          allTotal,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [members, dailyMetrics, metric]);

  const maxVal = ranked[0]?.total || 1;
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(45,93%,47%)]/20 to-[hsl(45,93%,47%)]/5 flex items-center justify-center">
            <Trophy size={16} className="text-[hsl(45,93%,47%)]" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">Ranking SDRs</h3>
            <p className="text-[9px] text-muted-foreground mt-0.5">{RANKING_LABELS[metric]}</p>
          </div>
        </div>
        <div className="relative">
          <select
            value={metric}
            onChange={e => setMetric(e.target.value)}
            className="text-[10px] bg-secondary text-secondary-foreground rounded-lg px-2.5 py-1.5 border border-border outline-none appearance-none cursor-pointer pr-6 font-medium"
          >
            {RANKING_METRICS.map(m => (
              <option key={m} value={m}>{RANKING_LABELS[m]}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Podium - Visual */}
      {podium.length >= 2 && (
        <div className="flex items-end justify-center gap-3 pt-2">
          {/* 2nd place */}
          {podium[1] && (
            <PodiumCard member={podium[1]} rank={1} maxVal={maxVal} style={PODIUM_STYLES[1]} height="h-24" />
          )}
          {/* 1st place */}
          {podium[0] && (
            <PodiumCard member={podium[0]} rank={0} maxVal={maxVal} style={PODIUM_STYLES[0]} height="h-32" isFirst />
          )}
          {/* 3rd place */}
          {podium[2] && (
            <PodiumCard member={podium[2]} rank={2} maxVal={maxVal} style={PODIUM_STYLES[2]} height="h-20" />
          )}
        </div>
      )}

      {/* Rest of the ranking */}
      {rest.length > 0 && (
        <div className="space-y-2 pt-1">
          {rest.map((member, idx) => {
            const pct = maxVal > 0 ? (member.total / maxVal) * 100 : 0;
            const position = idx + 4;
            return (
              <div key={member.id} className="flex items-center gap-3 group rounded-lg px-3 py-2 hover:bg-secondary/40 transition-colors">
                <span className="w-5 text-center text-[10px] font-bold text-muted-foreground tabular-nums">
                  {position}º
                </span>
                <img
                  src={getMemberAvatar(member, idx + 3)}
                  alt={member.name}
                  className="w-7 h-7 rounded-full object-cover shrink-0 border border-border"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-card-foreground truncate">{member.name}</span>
                    <span className="text-xs font-bold tabular-nums text-card-foreground ml-2">{member.total}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full bg-muted-foreground/40 transition-all duration-700"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick stats toggle */}
      <button
        onClick={() => setShowAllMetrics(!showAllMetrics)}
        className="w-full text-center text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors py-1"
      >
        {showAllMetrics ? "Ocultar detalhes" : "Ver todas as métricas"}
      </button>

      {/* All metrics comparison table */}
      {showAllMetrics && (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-semibold uppercase tracking-wider">SDR</th>
                {METRIC_KEYS.map(k => (
                  <th key={k} className="text-right py-2 text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap px-1.5">
                    {METRIC_LABELS[k].substring(0, 6)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ranked.map((member, idx) => (
                <tr key={member.id} className={cn("border-b border-border/50", idx < 3 && "font-semibold")}>
                  <td className="py-2 text-card-foreground whitespace-nowrap">
                    <span className="mr-1">{idx < 3 ? PODIUM_STYLES[idx].label : `${idx + 1}º`}</span>
                    {member.name}
                  </td>
                  {METRIC_KEYS.map(k => {
                    const val = member.allTotals[k] || 0;
                    // Find if this member is top for this metric
                    const isTop = ranked.every(r => (r.allTotals[k] || 0) <= val) && val > 0;
                    return (
                      <td key={k} className={cn(
                        "text-right py-2 tabular-nums px-1.5",
                        isTop ? "text-[hsl(45,93%,47%)] font-bold" : val > 0 ? "text-card-foreground" : "text-muted-foreground/30"
                      )}>
                        {val}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function PodiumCard({
  member,
  rank,
  maxVal,
  style,
  height,
  isFirst = false,
}: {
  member: { name: string; total: number; avatar_url?: string | null; id: string };
  rank: number;
  maxVal: number;
  style: typeof PODIUM_STYLES[0];
  height: string;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 flex-1 max-w-[120px]")}>
      {/* Avatar */}
      <div className="relative">
        {isFirst && (
          <Crown size={16} className="absolute -top-4 left-1/2 -translate-x-1/2 text-[hsl(45,93%,47%)] animate-pulse" />
        )}
        <div className={cn(
          "rounded-full shrink-0 transition-all overflow-hidden",
          style.ring, style.glow,
          isFirst ? "w-14 h-14" : "w-12 h-12"
        )}>
          <img
            src={member.avatar_url || `/avatars/default-${(rank % 6) + 1}.jpg`}
            alt={member.name}
            className="w-full h-full object-cover"
          />
        </div>
        <div className={cn(
          "absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-background",
          style.badge
        )}>
          {rank + 1}
        </div>
      </div>

      {/* Name */}
      <span className={cn("text-[11px] font-bold text-card-foreground text-center leading-tight truncate w-full", isFirst && "text-xs")}>
        {member.name}
      </span>

      {/* Podium bar */}
      <div className={cn(
        "w-full rounded-t-lg flex items-end justify-center pb-2 transition-all",
        height,
        style.bg, style.ring
      )}>
        <div className="text-center">
          <p className={cn("text-lg font-black tabular-nums", style.text, isFirst && "text-2xl")}>
            {member.total}
          </p>
          {isFirst && <Flame size={12} className="text-[hsl(45,93%,47%)] mx-auto mt-0.5" />}
        </div>
      </div>
    </div>
  );
}
