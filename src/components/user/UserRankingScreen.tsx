import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Trophy, Crown, Flame, TrendingUp, TrendingDown, Target, Zap, Star, Medal, ChevronDown } from "lucide-react";
import { useMonths, useDailyMetrics, useTeamMembers, useWeeklyGoals } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, getMemberAvatar } from "@/lib/db";
import { cn } from "@/lib/utils";

interface UserRankingScreenProps {
  teamMemberId: string;
  memberName: string;
  memberRole: string;
  onBack: () => void;
}

const PODIUM_COLORS = [
  { gradient: "from-[hsl(45,93%,47%)] to-[hsl(35,85%,40%)]", text: "text-[hsl(45,93%,47%)]", ring: "ring-[hsl(45,93%,47%)]/50", glow: "shadow-[0_0_30px_-5px_hsl(45,93%,47%,0.4)]", bg: "from-[hsl(45,93%,47%)]/15 to-[hsl(45,93%,47%)]/5", emoji: "🥇" },
  { gradient: "from-[hsl(210,10%,75%)] to-[hsl(210,10%,55%)]", text: "text-[hsl(210,10%,72%)]", ring: "ring-[hsl(210,10%,70%)]/40", glow: "shadow-[0_0_20px_-5px_hsl(210,10%,70%,0.3)]", bg: "from-[hsl(210,10%,70%)]/10 to-[hsl(210,10%,60%)]/5", emoji: "🥈" },
  { gradient: "from-[hsl(24,60%,50%)] to-[hsl(24,50%,35%)]", text: "text-[hsl(24,60%,48%)]", ring: "ring-[hsl(24,60%,45%)]/40", glow: "shadow-[0_0_20px_-5px_hsl(24,60%,45%,0.3)]", bg: "from-[hsl(24,60%,45%)]/10 to-[hsl(24,50%,35%)]/5", emoji: "🥉" },
];

export function UserRankingScreen({ teamMemberId, memberName, memberRole, onBack }: UserRankingScreenProps) {
  const metricKeys = memberRole === "closer" ? [...CLOSER_METRIC_KEYS] : [...SDR_METRIC_KEYS];
  const rankingMetrics = ["_all", ...metricKeys];
  const rankingLabels: Record<string, string> = { _all: "Geral", ...METRIC_LABELS };

  const [selectedMetric, setSelectedMetric] = useState("_all");

  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const today = new Date();
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);
  const { data: dailyMetrics } = useDailyMetrics(currentMonth?.id);

  const roleMembers = useMemo(() =>
    members?.filter(m => m.member_role === memberRole && m.active) || [],
    [members, memberRole]
  );

  const ranked = useMemo(() => {
    if (!dailyMetrics || !roleMembers.length) return [];
    return roleMembers
      .map((m, idx) => {
        const totals = sumMetrics(dailyMetrics, m.id);
        const allTotal = metricKeys.reduce((s, k) => s + (totals[k] || 0), 0);
        return {
          ...m,
          originalIndex: idx,
          total: selectedMetric === "_all" ? allTotal : (totals[selectedMetric] || 0),
          allTotals: totals,
          allTotal,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [roleMembers, dailyMetrics, selectedMetric, metricKeys]);

  const myPosition = ranked.findIndex(r => r.id === teamMemberId) + 1;
  const myData = ranked.find(r => r.id === teamMemberId);
  const maxVal = ranked[0]?.total || 1;

  // Insights
  const insights = useMemo(() => {
    if (!myData || !ranked.length) return [];
    const tips: { icon: React.ElementType; text: string; type: "success" | "warning" | "info" }[] = [];

    if (myPosition === 1) {
      tips.push({ icon: Crown, text: "Você é o líder do ranking! Continue assim! 🔥", type: "success" });
    } else if (myPosition <= 3) {
      tips.push({ icon: Medal, text: `Você está no top 3! Falta pouco para o topo.`, type: "success" });
    }

    if (myPosition > 1) {
      const leader = ranked[0];
      const gap = leader.total - myData.total;
      tips.push({ icon: Target, text: `Faltam ${gap} atividades para alcançar ${leader.name.split(" ")[0]} (1º lugar).`, type: "info" });
    }

    // Find strongest metric
    if (metricKeys.length > 1) {
      let bestMetric = metricKeys[0];
      let bestRank = Infinity;
      metricKeys.forEach(k => {
        const sorted = [...roleMembers]
          .map(m => ({ id: m.id, val: sumMetrics(dailyMetrics || [], m.id)[k] || 0 }))
          .sort((a, b) => b.val - a.val);
        const pos = sorted.findIndex(s => s.id === teamMemberId) + 1;
        if (pos < bestRank) { bestRank = pos; bestMetric = k; }
      });
      if (bestRank <= 3) {
        tips.push({ icon: Star, text: `Seu ponto forte é ${METRIC_LABELS[bestMetric]} — você é ${bestRank}º nessa métrica!`, type: "success" });
      }

      // Weakest
      let worstMetric = metricKeys[0];
      let worstRank = 0;
      metricKeys.forEach(k => {
        const sorted = [...roleMembers]
          .map(m => ({ id: m.id, val: sumMetrics(dailyMetrics || [], m.id)[k] || 0 }))
          .sort((a, b) => b.val - a.val);
        const pos = sorted.findIndex(s => s.id === teamMemberId) + 1;
        if (pos > worstRank) { worstRank = pos; worstMetric = k; }
      });
      if (worstRank > 2 && worstRank !== bestRank) {
        tips.push({ icon: TrendingUp, text: `Oportunidade de melhoria: ${METRIC_LABELS[worstMetric]}. Foque nessa métrica para subir no ranking!`, type: "warning" });
      }
    }

    if (myPosition > 1 && myPosition <= ranked.length) {
      const above = ranked[myPosition - 2];
      const diff = above.total - myData.total;
      if (diff <= 5) {
        tips.push({ icon: Zap, text: `Você está a apenas ${diff} atividades de ultrapassar ${above.name.split(" ")[0]}. Vai!`, type: "info" });
      }
    }

    return tips.slice(0, 4);
  }, [myData, myPosition, ranked, metricKeys, roleMembers, dailyMetrics, teamMemberId]);

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="max-w-2xl mx-auto space-y-5 pb-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Voltar
        </button>
        <div className="relative">
          <select
            value={selectedMetric}
            onChange={e => setSelectedMetric(e.target.value)}
            className="text-[10px] bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 border border-border outline-none appearance-none cursor-pointer pr-7 font-semibold"
          >
            {rankingMetrics.map(m => (
              <option key={m} value={m}>{rankingLabels[m]}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(45,93%,47%)]/10 to-transparent rounded-full px-4 py-1.5 mb-2">
          <Trophy size={16} className="text-[hsl(45,93%,47%)]" />
          <span className="text-xs font-bold text-[hsl(45,93%,47%)] uppercase tracking-wider">
            Ranking {memberRole === "closer" ? "Closers" : "SDRs"}
          </span>
        </div>
        <h1 className="text-2xl font-black text-foreground">Classificação Geral</h1>
        <p className="text-xs text-muted-foreground mt-1">
          {currentMonth?.label || "Mês atual"} • {rankingLabels[selectedMetric]}
        </p>
      </motion.div>

      {/* My Position Highlight */}
      {myData && (
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "rounded-2xl border-2 p-4 relative overflow-hidden",
            myPosition === 1
              ? "border-[hsl(45,93%,47%)]/40 bg-gradient-to-r from-[hsl(45,93%,47%)]/10 to-transparent"
              : myPosition <= 3
                ? "border-primary/30 bg-gradient-to-r from-primary/10 to-transparent"
                : "border-border bg-card"
          )}
        >
          {myPosition === 1 && (
            <div className="absolute top-0 right-0 w-32 h-32 bg-[hsl(45,93%,47%)]/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
          )}
          <div className="relative flex items-center gap-4">
            <div className={cn(
              "text-3xl font-black tabular-nums",
              myPosition === 1 ? "text-[hsl(45,93%,47%)]" : myPosition <= 3 ? "text-primary" : "text-muted-foreground"
            )}>
              {myPosition}º
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Sua posição</p>
              <p className="text-xs text-muted-foreground">
                {myData.total} atividades • {ranked.length} participantes
              </p>
            </div>
            {myPosition === 1 && <Crown size={24} className="text-[hsl(45,93%,47%)] animate-pulse" />}
            {myPosition === 2 && <Medal size={20} className="text-[hsl(210,10%,72%)]" />}
            {myPosition === 3 && <Medal size={20} className="text-[hsl(24,60%,48%)]" />}
          </div>
        </motion.div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="space-y-2"
        >
          <h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Zap size={11} className="text-primary" /> Insights para você
          </h3>
          {insights.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.35 + i * 0.1 }}
              className={cn(
                "rounded-xl border px-4 py-3 flex items-start gap-3 text-xs",
                tip.type === "success" && "border-accent/30 bg-accent/5",
                tip.type === "warning" && "border-chart-4/30 bg-chart-4/5",
                tip.type === "info" && "border-primary/30 bg-primary/5",
              )}
            >
              <tip.icon size={14} className={cn(
                "shrink-0 mt-0.5",
                tip.type === "success" && "text-accent",
                tip.type === "warning" && "text-chart-4",
                tip.type === "info" && "text-primary",
              )} />
              <span className="text-card-foreground leading-relaxed">{tip.text}</span>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Podium */}
      {podium.length >= 2 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="flex items-end justify-center gap-3 pt-4 pb-2"
        >
          {/* 2nd place */}
          {podium[1] && (
            <PodiumSlot member={podium[1]} rank={1} delay={0.6} isMe={podium[1].id === teamMemberId} />
          )}
          {/* 1st place */}
          {podium[0] && (
            <PodiumSlot member={podium[0]} rank={0} delay={0.4} isMe={podium[0].id === teamMemberId} />
          )}
          {/* 3rd place */}
          {podium[2] && (
            <PodiumSlot member={podium[2]} rank={2} delay={0.7} isMe={podium[2].id === teamMemberId} />
          )}
        </motion.div>
      )}

      {/* Rest of ranking */}
      {rest.length > 0 && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {rest.map((member, idx) => {
            const pct = maxVal > 0 ? (member.total / maxVal) * 100 : 0;
            const isMe = member.id === teamMemberId;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 + idx * 0.08 }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-colors",
                  isMe ? "bg-primary/5 border-l-2 border-l-primary" : "hover:bg-secondary/30"
                )}
              >
                <span className="w-6 text-center text-xs font-bold text-muted-foreground tabular-nums">
                  {idx + 4}º
                </span>
                <img
                  src={getMemberAvatar(member, member.originalIndex)}
                  alt={member.name}
                  className={cn("w-9 h-9 rounded-full object-cover shrink-0 border-2", isMe ? "border-primary" : "border-border")}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={cn("text-xs font-semibold truncate", isMe ? "text-primary" : "text-card-foreground")}>
                      {member.name} {isMe && "(Você)"}
                    </span>
                    <span className="text-xs font-bold tabular-nums text-card-foreground ml-2">{member.total}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 1 + idx * 0.08, duration: 0.6 }}
                      className={cn("h-full rounded-full", isMe ? "bg-primary" : "bg-muted-foreground/40")}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

function PodiumSlot({ member, rank, delay, isMe }: {
  member: { name: string; total: number; avatar_url?: string | null; id: string; originalIndex: number };
  rank: number;
  delay: number;
  isMe: boolean;
}) {
  const style = PODIUM_COLORS[rank];
  const heights = ["h-28", "h-20", "h-16"];
  const avatarSizes = ["w-16 h-16", "w-12 h-12", "w-11 h-11"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", damping: 12 }}
      className={cn("flex flex-col items-center flex-1 max-w-[140px]", isMe && "scale-105")}
    >
      {rank === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.3 }}
        >
          <Crown size={20} className="text-[hsl(45,93%,47%)] mb-1" />
        </motion.div>
      )}

      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: delay + 0.15, type: "spring", damping: 10 }}
        className={cn(
          "rounded-full overflow-hidden shrink-0 relative ring-2",
          avatarSizes[rank],
          style.ring,
          style.glow,
          isMe && "ring-4"
        )}
      >
        <img src={getMemberAvatar(member, member.originalIndex)} alt={member.name} className="w-full h-full object-cover" />
        <div className={cn("absolute -bottom-0.5 -right-0.5 rounded-full flex items-center justify-center font-bold text-background bg-gradient-to-br", rank === 0 ? "w-5 h-5 text-[9px]" : "w-4 h-4 text-[8px]", style.gradient)}>
          {rank + 1}
        </div>
      </motion.div>

      <span className={cn("font-bold text-card-foreground truncate w-full text-center mt-2", rank === 0 ? "text-xs" : "text-[10px]", isMe && "text-primary")}>
        {member.name.split(" ")[0]} {isMe && "🫵"}
      </span>

      {/* Podium bar */}
      <motion.div
        initial={{ height: 0 }}
        animate={{ height: "auto" }}
        transition={{ delay: delay + 0.2, duration: 0.5 }}
        className={cn(
          "w-full rounded-t-lg flex items-end justify-center mt-2 overflow-hidden relative bg-gradient-to-br",
          heights[rank],
          style.bg,
          "ring-1",
          style.ring
        )}
      >
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: delay + 0.5 }}
          className={cn("font-black tabular-nums pb-2", rank === 0 ? "text-lg" : "text-sm", style.text)}
        >
          {member.total}
        </motion.span>

        {/* Shimmer on 1st */}
        {rank === 0 && (
          <div
            className="absolute inset-0 pointer-events-none opacity-20 animate-shimmer"
            style={{
              backgroundImage: "linear-gradient(90deg, transparent 0%, hsl(45,93%,47%,0.4) 50%, transparent 100%)",
              backgroundSize: "200% 100%",
            }}
          />
        )}
      </motion.div>
    </motion.div>
  );
}
