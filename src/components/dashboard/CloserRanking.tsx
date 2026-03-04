import { DbDailyMetric, DbTeamMember, sumMetrics, METRIC_LABELS, SHORT_TABLE_LABELS, METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, getMemberAvatar } from "@/lib/db";
import { Trophy, Medal, Crown, Flame, Star, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";

interface CloserRankingProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
}

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
  const sdrMembers = members.filter(m => m.member_role === "sdr");
  const closerMembers = members.filter(m => m.member_role === "closer");

  return (
    <div className="flex flex-col gap-4">
      {sdrMembers.length > 0 && (
        <RoleRanking
          title="Ranking SDRs"
          members={sdrMembers}
          dailyMetrics={dailyMetrics}
          metricKeys={[...SDR_METRIC_KEYS]}
          variant="sdr"
        />
      )}
      {closerMembers.length > 0 && (
        <RoleRanking
          title="Ranking Closers"
          members={closerMembers}
          dailyMetrics={dailyMetrics}
          metricKeys={[...CLOSER_METRIC_KEYS]}
          variant="closer"
        />
      )}
    </div>
  );
}

export interface RoleRankingProps {
  title: string;
  members: DbTeamMember[];
  dailyMetrics: DbDailyMetric[];
  metricKeys: string[];
  variant: "sdr" | "closer";
  compact?: boolean;
}

export function RoleRanking({ title, members, dailyMetrics, metricKeys, variant, compact = false }: RoleRankingProps) {
  const rankingMetrics = ["_all", ...metricKeys];
  const rankingLabels: Record<string, string> = { _all: "Todas", ...METRIC_LABELS };

  const [metric, setMetric] = useState("_all");
  const [showAllMetrics, setShowAllMetrics] = useState(false);

  const ranked = useMemo(() => {
    return members
      .map((m, originalIdx) => {
        const totals = sumMetrics(dailyMetrics, m.id);
        const allTotal = metricKeys.reduce((s, k) => s + (totals[k] || 0), 0);
        return {
          ...m,
          originalIndex: originalIdx,
          total: metric === "_all" ? allTotal : (totals[metric] || 0),
          allTotals: totals,
          allTotal,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [members, dailyMetrics, metric, metricKeys]);

  const maxVal = ranked[0]?.total || 1;
  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  const isCloser = variant === "closer";
  const headerBg = isCloser
    ? "bg-[hsl(var(--panel-closer))] border-[hsl(280,30%,18%)] border-l-[3px] border-l-[hsl(var(--panel-closer-accent))]"
    : "bg-[hsl(var(--panel-sdr))] border-[hsl(217,40%,18%)] border-l-[3px] border-l-[hsl(var(--panel-sdr-accent))]";
  const chipClass = isCloser
    ? "text-[hsl(280,65%,80%)] bg-[hsl(280,65%,60%/0.15)] border-[hsl(280,65%,60%/0.3)]"
    : "text-primary-foreground bg-primary/20 border-primary/30";

  // Compact: animated mini podium + list
  if (compact) {
    const p1 = podium[0];
    const p2 = podium[1];
    const p3 = podium[2];

    const PodiumSlot = ({ member, rank, podiumH, avatarSize, delay }: {
      member: typeof p1; rank: number; podiumH: string; avatarSize: string; delay: number;
    }) => {
      const s = PODIUM_STYLES[rank];
      const heightValue = podiumH === "h-14" ? "3.5rem" : podiumH === "h-10" ? "2.5rem" : "2rem";
      if (!member) return (
        <div className="flex flex-col items-center flex-1 justify-end">
          <div className={cn("w-full rounded-t-md bg-secondary/10")} style={{ height: heightValue, opacity: 0.3 }} />
        </div>
      );
      return (
        <div className="flex flex-col items-center flex-1 justify-end relative">
          {rank === 0 && (
            <Crown size={12} className="text-[hsl(45,93%,47%)] animate-crown-bounce mb-0.5" />
          )}
          <div
            className={cn("rounded-full overflow-hidden shrink-0 relative animate-avatar-drop", avatarSize, s.ring, s.glow)}
            style={{ animationDelay: `${delay + 0.2}s`, animationFillMode: "both" }}
          >
            <img src={getMemberAvatar(member, member.originalIndex)} alt={member.name} className="w-full h-full object-cover" />
            <div className={cn(
              "absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center font-bold text-background",
              rank === 0 ? "w-4 h-4 text-[8px]" : "w-3.5 h-3.5 text-[7px]",
              s.badge
            )}>
              {rank + 1}
            </div>
          </div>
          <span
            className={cn("font-semibold text-card-foreground truncate w-full text-center mt-1 animate-fade-in", rank === 0 ? "text-[9px] font-bold" : "text-[8px]")}
            style={{ animationDelay: `${delay + 0.4}s`, animationFillMode: "both" }}
          >
            {member.name}
          </span>
          <div
            className={cn("w-full rounded-t-md flex items-end justify-center mt-0.5 overflow-hidden relative animate-podium-rise", s.bg, "ring-1", s.ring)}
            style={{
              ["--podium-height" as string]: heightValue,
              animationDelay: `${delay}s`,
              animationFillMode: "both",
            } as React.CSSProperties}
          >
            <span
              className={cn("font-black tabular-nums pb-1 animate-score-pop", rank === 0 ? "text-sm" : "text-[10px]", s.text)}
              style={{ animationDelay: `${delay + 0.6}s`, animationFillMode: "both" }}
            >
              {member.total}
            </span>
            {rank === 0 && (
              <Flame size={10} className="text-[hsl(45,93%,47%)] absolute bottom-0.5 animate-score-pop" style={{ animationDelay: `${delay + 0.8}s`, animationFillMode: "both" }} />
            )}
            {/* Shimmer on 1st place podium */}
            {rank === 0 && (
              <div
                className="absolute inset-0 rounded-t-md pointer-events-none opacity-30 animate-shimmer"
                style={{
                  backgroundImage: "linear-gradient(90deg, transparent 0%, hsl(45,93%,47%,0.3) 50%, transparent 100%)",
                  backgroundSize: "200% 100%",
                }}
              />
            )}
          </div>
        </div>
      );
    };

    return (
      <div className={cn("rounded-xl border p-3 space-y-2 h-full", headerBg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy size={13} className="text-[hsl(45,93%,47%)]" />
            <h3 className="text-[10px] font-bold text-card-foreground uppercase tracking-wider">{title}</h3>
          </div>
          <div className="relative">
            <select
              value={metric}
              onChange={e => setMetric(e.target.value)}
              className="text-[9px] bg-secondary text-secondary-foreground rounded-md px-2 py-1 border border-border outline-none appearance-none cursor-pointer pr-5 font-medium"
            >
              {rankingMetrics.map(m => (
                <option key={m} value={m}>{rankingLabels[m]}</option>
              ))}
            </select>
            <ChevronDown size={8} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>

        {/* Animated Mini Podium */}
        {podium.length >= 1 && (
          <div className="flex items-end justify-center gap-1.5 pt-1 pb-1 min-h-[100px]">
            <PodiumSlot member={p2 || null} rank={1} podiumH="h-10" avatarSize="w-8 h-8" delay={0.3} />
            <PodiumSlot member={p1 || null} rank={0} podiumH="h-14" avatarSize="w-10 h-10 ring-2" delay={0} />
            <PodiumSlot member={p3 || null} rank={2} podiumH="h-8" avatarSize="w-7 h-7" delay={0.5} />
          </div>
        )}

        {/* Rest below podium with animated bars */}
        {rest.length > 0 && (
          <div className="space-y-0.5 border-t border-border/50 pt-1.5">
            {rest.map((member, idx) => {
              const pct = maxVal > 0 ? (member.total / maxVal) * 100 : 0;
              const delay = 0.7 + idx * 0.15;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-secondary/40 transition-colors opacity-0 animate-fade-in"
                  style={{ animationDelay: `${delay}s`, animationFillMode: "both" }}
                >
                  <span className="w-4 text-center text-[9px] font-bold text-muted-foreground tabular-nums">{idx + 4}º</span>
                  <img src={getMemberAvatar(member, member.originalIndex)} alt={member.name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-border" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-semibold text-card-foreground truncate">{member.name}</span>
                      <span className="text-[9px] font-bold tabular-nums text-card-foreground ml-1">{member.total}</span>
                    </div>
                    <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mt-0.5">
                      <div
                        className="h-full rounded-full bg-muted-foreground/40 animate-bar-fill"
                        style={{ ["--bar-width" as any]: `${pct}%`, width: 0, animationDelay: `${delay + 0.2}s`, animationFillMode: "both" } as React.CSSProperties}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border p-5 space-y-5", headerBg)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(45,93%,47%)]/20 to-[hsl(45,93%,47%)]/5 flex items-center justify-center">
            <Trophy size={16} className="text-[hsl(45,93%,47%)]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">{title}</h3>
              <span className={cn("text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border", chipClass)}>
                {variant.toUpperCase()}
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground mt-0.5">{rankingLabels[metric]}</p>
          </div>
        </div>
        <div className="relative">
          <select
            value={metric}
            onChange={e => setMetric(e.target.value)}
            className="text-[10px] bg-secondary text-secondary-foreground rounded-lg px-2.5 py-1.5 border border-border outline-none appearance-none cursor-pointer pr-6 font-medium"
          >
            {rankingMetrics.map(m => (
              <option key={m} value={m}>{rankingLabels[m]}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Podium - Visual */}
      {podium.length >= 2 && (
        <div className="flex items-end justify-center gap-3 pt-2">
          {podium[1] && (
            <PodiumCard member={podium[1]} originalIndex={podium[1].originalIndex} rank={1} maxVal={maxVal} style={PODIUM_STYLES[1]} height="h-24" />
          )}
          {podium[0] && (
            <PodiumCard member={podium[0]} originalIndex={podium[0].originalIndex} rank={0} maxVal={maxVal} style={PODIUM_STYLES[0]} height="h-32" isFirst />
          )}
          {podium[2] && (
            <PodiumCard member={podium[2]} originalIndex={podium[2].originalIndex} rank={2} maxVal={maxVal} style={PODIUM_STYLES[2]} height="h-20" />
          )}
        </div>
      )}

      {podium.length === 1 && (
        <div className="flex justify-center pt-2">
          <PodiumCard member={podium[0]} originalIndex={podium[0].originalIndex} rank={0} maxVal={maxVal} style={PODIUM_STYLES[0]} height="h-32" isFirst />
        </div>
      )}

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
                  src={getMemberAvatar(member, member.originalIndex)}
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

      <button
        onClick={() => setShowAllMetrics(!showAllMetrics)}
        className="w-full text-center text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors py-1"
      >
        {showAllMetrics ? "Ocultar detalhes" : "Ver todas as métricas"}
      </button>

      {showAllMetrics && (
        <div className="overflow-x-auto -mx-5 px-5">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 text-muted-foreground font-semibold uppercase tracking-wider">
                  {variant === "sdr" ? "SDR" : "Closer"}
                </th>
                {metricKeys.map(k => (
                  <th key={k} className="text-right py-2 text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap px-1.5">
                    {SHORT_TABLE_LABELS[k] || METRIC_LABELS[k] || k}
                  </th>
                ))}
                <th className="text-right py-2 text-muted-foreground font-semibold uppercase tracking-wider whitespace-nowrap px-1.5">
                  TOTAL
                </th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((member, idx) => (
                <tr key={member.id} className={cn("border-b border-border/50", idx < 3 && "font-semibold")}>
                  <td className="py-2 text-card-foreground whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <img
                        src={getMemberAvatar(member, member.originalIndex)}
                        alt={member.name}
                        className="w-5 h-5 rounded-full object-cover shrink-0 border border-border"
                      />
                      <span>{idx < 3 ? PODIUM_STYLES[idx].label : `${idx + 1}º`}</span>
                      {member.name}
                    </div>
                  </td>
                  {metricKeys.map(k => {
                    const val = member.allTotals[k] || 0;
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
                  <td className="text-right py-2 tabular-nums px-1.5 font-bold text-card-foreground">
                    {member.allTotal}
                  </td>
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
  originalIndex,
  rank,
  maxVal,
  style,
  height,
  isFirst = false,
}: {
  member: { name: string; total: number; avatar_url?: string | null; id: string };
  originalIndex: number;
  rank: number;
  maxVal: number;
  style: typeof PODIUM_STYLES[0];
  height: string;
  isFirst?: boolean;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-2 flex-1 max-w-[120px]")}>
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
            src={member.avatar_url || `/avatars/default-${(originalIndex % 6) + 1}.jpg`}
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
      <span className={cn("text-[11px] font-bold text-card-foreground text-center leading-tight truncate w-full", isFirst && "text-xs")}>
        {member.name}
      </span>
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
