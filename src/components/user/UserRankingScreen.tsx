import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { ArrowLeft, Trophy, Crown, Flame, TrendingUp, Target, Zap, Star, Medal, ChevronDown, Sparkles } from "lucide-react";
import { useMonths, useDailyMetrics, useTeamMembers } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, getMemberAvatar, memberHasRole, getMemberRoles } from "@/lib/db";
import { cn } from "@/lib/utils";

interface UserRankingScreenProps {
  teamMemberId: string;
  memberName: string;
  memberRole: string;
  onBack: () => void;
}

const PODIUM_COLORS = [
  { gradient: "from-[hsl(45,93%,47%)] to-[hsl(35,85%,40%)]", text: "text-[hsl(45,93%,47%)]", ring: "ring-[hsl(45,93%,47%)]/50", glow: "shadow-[0_0_40px_-5px_hsl(45,93%,47%,0.5)]", bg: "from-[hsl(45,93%,47%)]/20 to-[hsl(45,93%,47%)]/5", emoji: "🥇", particle: "hsl(45,93%,47%)" },
  { gradient: "from-[hsl(210,10%,75%)] to-[hsl(210,10%,55%)]", text: "text-[hsl(210,10%,72%)]", ring: "ring-[hsl(210,10%,70%)]/40", glow: "shadow-[0_0_25px_-5px_hsl(210,10%,70%,0.3)]", bg: "from-[hsl(210,10%,70%)]/15 to-[hsl(210,10%,60%)]/5", emoji: "🥈", particle: "hsl(210,10%,70%)" },
  { gradient: "from-[hsl(24,60%,50%)] to-[hsl(24,50%,35%)]", text: "text-[hsl(24,60%,48%)]", ring: "ring-[hsl(24,60%,45%)]/40", glow: "shadow-[0_0_25px_-5px_hsl(24,60%,45%,0.3)]", bg: "from-[hsl(24,60%,45%)]/15 to-[hsl(24,50%,35%)]/5", emoji: "🥉", particle: "hsl(24,60%,45%)" },
];

/* ── Animated Counter ── */
function AnimatedNumber({ value, delay = 0, className }: { value: number; delay?: number; className?: string }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const duration = 1200;
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(eased * value));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay * 1000);
    return () => clearTimeout(timeout);
  }, [value, delay]);
  return <span className={className}>{display}</span>;
}

/* ── Floating Particles ── */
function FloatingParticles({ color, count = 6 }: { color: string; count?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full"
          style={{
            width: 3 + Math.random() * 4,
            height: 3 + Math.random() * 4,
            background: color,
            left: `${10 + Math.random() * 80}%`,
            bottom: 0,
            opacity: 0,
          }}
          animate={{
            y: [0, -80 - Math.random() * 60],
            opacity: [0, 0.7, 0],
            scale: [0.5, 1.2, 0.3],
          }}
          transition={{
            duration: 2 + Math.random() * 1.5,
            delay: 1 + i * 0.3 + Math.random() * 0.5,
            repeat: Infinity,
            repeatDelay: 2 + Math.random() * 3,
          }}
        />
      ))}
    </div>
  );
}

/* ── Pulse Ring ── */
function PulseRing({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ border: `2px solid ${color}` }}
      initial={{ scale: 1, opacity: 0.6 }}
      animate={{ scale: [1, 1.8, 2.2], opacity: [0.5, 0.2, 0] }}
      transition={{ duration: 2, delay, repeat: Infinity, repeatDelay: 3 }}
    />
  );
}

export function UserRankingScreen({ teamMemberId, memberName, memberRole, onBack }: UserRankingScreenProps) {
  const roles = getMemberRoles({ member_role: memberRole });
  const hasDualRole = roles.includes("sdr") && roles.includes("closer");
  const [activeRoleView, setActiveRoleView] = useState<"sdr" | "closer">(roles.includes("sdr") ? "sdr" : "closer");
  
  const currentRoleForRanking = hasDualRole ? activeRoleView : (roles.includes("closer") ? "closer" : "sdr");
  const metricKeys = currentRoleForRanking === "closer" ? [...CLOSER_METRIC_KEYS] : [...SDR_METRIC_KEYS];
  const rankingMetrics = ["_all", ...metricKeys];
  const rankingLabels: Record<string, string> = { _all: "Geral", ...METRIC_LABELS };
  const [selectedMetric, setSelectedMetric] = useState("_all");
  const [revealed, setRevealed] = useState(false);

  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const today = new Date();
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);
  const { data: dailyMetrics } = useDailyMetrics(currentMonth?.id);

  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 300);
    return () => clearTimeout(t);
  }, []);

  // Reset metric selection when switching role view
  useEffect(() => { setSelectedMetric("_all"); }, [activeRoleView]);

  const roleMembers = useMemo(() =>
    members?.filter(m => memberHasRole(m, currentRoleForRanking) && m.active) || [],
    [members, currentRoleForRanking]
  );

  const ranked = useMemo(() => {
    if (!dailyMetrics || !roleMembers.length) return [];
    return roleMembers
      .map((m, idx) => {
        const totals = sumMetrics(dailyMetrics, m.id);
        const allTotal = metricKeys.reduce((s, k) => s + (totals[k] || 0), 0);
        return {
          ...m, originalIndex: idx,
          total: selectedMetric === "_all" ? allTotal : (totals[selectedMetric] || 0),
          allTotals: totals, allTotal,
        };
      })
      .sort((a, b) => b.total - a.total);
  }, [roleMembers, dailyMetrics, selectedMetric, metricKeys]);

  const myPosition = ranked.findIndex(r => r.id === teamMemberId) + 1;
  const myData = ranked.find(r => r.id === teamMemberId);
  const maxVal = ranked[0]?.total || 1;

  const insights = useMemo(() => {
    if (!myData || !ranked.length) return [];
    const tips: { icon: React.ElementType; text: string; type: "success" | "warning" | "info" }[] = [];
    if (myPosition === 1) tips.push({ icon: Crown, text: "Você é o líder do ranking! Continue assim! 🔥", type: "success" });
    else if (myPosition <= 3) tips.push({ icon: Medal, text: "Você está no top 3! Falta pouco para o topo.", type: "success" });
    if (myPosition > 1) {
      const leader = ranked[0]; const gap = leader.total - myData.total;
      tips.push({ icon: Target, text: `Faltam ${gap} atividades para alcançar ${leader.name.split(" ")[0]} (1º lugar).`, type: "info" });
    }
    if (metricKeys.length > 1) {
      let bestMetric = metricKeys[0], bestRank = Infinity;
      let worstMetric = metricKeys[0], worstRank = 0;
      metricKeys.forEach(k => {
        const sorted = [...roleMembers].map(m => ({ id: m.id, val: sumMetrics(dailyMetrics || [], m.id)[k] || 0 })).sort((a, b) => b.val - a.val);
        const pos = sorted.findIndex(s => s.id === teamMemberId) + 1;
        if (pos < bestRank) { bestRank = pos; bestMetric = k; }
        if (pos > worstRank) { worstRank = pos; worstMetric = k; }
      });
      if (bestRank <= 3) tips.push({ icon: Star, text: `Seu ponto forte é ${METRIC_LABELS[bestMetric]} — você é ${bestRank}º nessa métrica!`, type: "success" });
      if (worstRank > 2 && worstRank !== bestRank) tips.push({ icon: TrendingUp, text: `Oportunidade: foque em ${METRIC_LABELS[worstMetric]} para subir no ranking!`, type: "warning" });
    }
    if (myPosition > 1 && myPosition <= ranked.length) {
      const above = ranked[myPosition - 2]; const diff = above.total - myData.total;
      if (diff <= 5) tips.push({ icon: Zap, text: `Apenas ${diff} atividades para ultrapassar ${above.name.split(" ")[0]}. Vai! ⚡`, type: "info" });
    }
    return tips.slice(0, 4);
  }, [myData, myPosition, ranked, metricKeys, roleMembers, dailyMetrics, teamMemberId]);

  const podium = ranked.slice(0, 3);
  const rest = ranked.slice(3);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="max-w-2xl mx-auto pb-10 relative"
    >
      {/* Background ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse,hsl(45,93%,47%,0.06)_0%,transparent_70%)] pointer-events-none" />

      {/* Dual Role Tab */}
      {hasDualRole && (
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 mb-4 relative z-10">
          <button onClick={() => setActiveRoleView("sdr")}
            className={cn("flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              activeRoleView === "sdr" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>⚡ SDR</button>
          <button onClick={() => setActiveRoleView("closer")}
            className={cn("flex-1 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all",
              activeRoleView === "closer" ? "bg-[hsl(280,65%,60%)] text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}>🏆 Closer</button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6 relative z-10">
        <motion.button
          onClick={onBack}
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft size={14} /> Voltar
        </motion.button>
        <div className="relative">
          <select
            value={selectedMetric}
            onChange={e => setSelectedMetric(e.target.value)}
            className="text-[10px] bg-secondary text-secondary-foreground rounded-lg px-3 py-1.5 border border-border outline-none appearance-none cursor-pointer pr-7 font-semibold"
          >
            {rankingMetrics.map(m => <option key={m} value={m}>{rankingLabels[m]}</option>)}
          </select>
          <ChevronDown size={10} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* ── Cinematic Title Reveal ── */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.15, type: "spring", damping: 15 }}
        className="text-center mb-8 relative"
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: "100%" }}
          transition={{ delay: 0.3, duration: 0.8 }}
          className="absolute top-1/2 left-0 h-px bg-gradient-to-r from-transparent via-[hsl(45,93%,47%)]/30 to-transparent"
        />
        <motion.div
          initial={{ scale: 0, rotate: -20 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: 0.2, type: "spring", damping: 8 }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-[hsl(45,93%,47%)]/15 via-[hsl(45,93%,47%)]/10 to-transparent rounded-full px-5 py-2 mb-3 relative"
        >
          <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}>
            <Trophy size={18} className="text-[hsl(45,93%,47%)]" />
          </motion.div>
          <span className="text-xs font-black text-[hsl(45,93%,47%)] uppercase tracking-[0.2em]">
            Ranking {memberRole === "closer" ? "Closers" : "SDRs"}
          </span>
          <Sparkles size={12} className="text-[hsl(45,93%,47%)]/60" />
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, letterSpacing: "0.3em" }}
          animate={{ opacity: 1, letterSpacing: "0.02em" }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-3xl font-black text-foreground"
        >
          Classificação
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs text-muted-foreground mt-1.5"
        >
          {currentMonth?.label || "Mês atual"} • {rankingLabels[selectedMetric]}
        </motion.p>
      </motion.div>

      {/* ── My Position Card with animated border ── */}
      {myData && (
        <motion.div
          initial={{ opacity: 0, x: -30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={{ delay: 0.5, type: "spring", damping: 14 }}
          className={cn(
            "rounded-2xl p-5 relative overflow-hidden mb-6",
            myPosition === 1
              ? "bg-gradient-to-r from-[hsl(45,93%,47%)]/10 via-card to-card border-2 border-[hsl(45,93%,47%)]/30"
              : myPosition <= 3
                ? "bg-gradient-to-r from-primary/10 via-card to-card border-2 border-primary/30"
                : "bg-card border border-border"
          )}
        >
          {/* Animated border glow */}
          {myPosition <= 3 && (
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{
                background: `conic-gradient(from 0deg, transparent, ${myPosition === 1 ? 'hsl(45,93%,47%,0.3)' : 'hsl(217,91%,60%,0.2)'}, transparent, transparent)`,
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            />
          )}
          <div className="absolute inset-[1px] rounded-2xl bg-card" />

          <div className="relative flex items-center gap-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.7, type: "spring", damping: 8 }}
              className={cn(
                "text-4xl font-black tabular-nums",
                myPosition === 1 ? "text-[hsl(45,93%,47%)]" : myPosition <= 3 ? "text-primary" : "text-muted-foreground"
              )}
            >
              {myPosition}º
            </motion.div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground">Sua posição</p>
              <p className="text-xs text-muted-foreground">
                <AnimatedNumber value={myData.total} delay={0.8} className="font-bold text-foreground" /> atividades • {ranked.length} participantes
              </p>
            </div>
            {myPosition === 1 && (
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Crown size={28} className="text-[hsl(45,93%,47%)]" />
              </motion.div>
            )}
            {myPosition === 2 && <Medal size={22} className="text-[hsl(210,10%,72%)]" />}
            {myPosition === 3 && <Medal size={22} className="text-[hsl(24,60%,48%)]" />}
          </div>
        </motion.div>
      )}

      {/* ── Insights with stagger ── */}
      {insights.length > 0 && (
        <div className="space-y-2 mb-8">
          <motion.h3
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-3"
          >
            <Zap size={11} className="text-primary" /> Insights para você
          </motion.h3>
          {insights.map((tip, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              transition={{ delay: 0.9 + i * 0.12, type: "spring", damping: 15 }}
              whileHover={{ x: 4, scale: 1.01 }}
              className={cn(
                "rounded-xl border px-4 py-3 flex items-start gap-3 text-xs cursor-default transition-shadow",
                tip.type === "success" && "border-accent/30 bg-accent/5 hover:shadow-[0_0_15px_-5px_hsl(160,84%,39%,0.2)]",
                tip.type === "warning" && "border-chart-4/30 bg-chart-4/5 hover:shadow-[0_0_15px_-5px_hsl(38,92%,50%,0.2)]",
                tip.type === "info" && "border-primary/30 bg-primary/5 hover:shadow-[0_0_15px_-5px_hsl(217,91%,60%,0.2)]",
              )}
            >
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}>
                <tip.icon size={14} className={cn(
                  "shrink-0",
                  tip.type === "success" && "text-accent",
                  tip.type === "warning" && "text-chart-4",
                  tip.type === "info" && "text-primary",
                )} />
              </motion.div>
              <span className="text-card-foreground leading-relaxed">{tip.text}</span>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── PODIUM ── */}
      {podium.length >= 2 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="relative mb-8"
        >
          {/* Stage floor */}
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 1.8, duration: 0.5 }}
            className="absolute bottom-0 left-[5%] right-[5%] h-1 rounded-full bg-gradient-to-r from-transparent via-[hsl(45,93%,47%)]/20 to-transparent"
          />

          <div className="flex items-end justify-center gap-3 sm:gap-5 pt-6 pb-4">
            {podium[1] && <PodiumSlot member={podium[1]} rank={1} delay={1.5} isMe={podium[1].id === teamMemberId} />}
            {podium[0] && <PodiumSlot member={podium[0]} rank={0} delay={1.2} isMe={podium[0].id === teamMemberId} />}
            {podium[2] && <PodiumSlot member={podium[2]} rank={2} delay={1.7} isMe={podium[2].id === teamMemberId} />}
          </div>
        </motion.div>
      )}

      {/* ── Rest of ranking ── */}
      {rest.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 2 }}
          className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm overflow-hidden"
        >
          {rest.map((member, idx) => {
            const pct = maxVal > 0 ? (member.total / maxVal) * 100 : 0;
            const isMe = member.id === teamMemberId;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 2.1 + idx * 0.1, type: "spring", damping: 18 }}
                whileHover={{ x: 4, backgroundColor: "hsl(222, 30%, 14%)" }}
                className={cn(
                  "flex items-center gap-3 px-4 py-3.5 border-b border-border/50 last:border-0 transition-all cursor-default",
                  isMe && "bg-primary/5 border-l-[3px] border-l-primary"
                )}
              >
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 2.2 + idx * 0.1, type: "spring" }}
                  className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center text-[10px] font-black text-muted-foreground tabular-nums"
                >
                  {idx + 4}
                </motion.span>
                <div className="relative">
                  <img
                    src={getMemberAvatar(member, member.originalIndex)}
                    alt={member.name}
                    className={cn("w-10 h-10 rounded-full object-cover shrink-0 border-2 transition-all", isMe ? "border-primary" : "border-border")}
                  />
                  {isMe && (
                    <motion.div
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary flex items-center justify-center"
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <span className="text-[7px] font-bold text-primary-foreground">EU</span>
                    </motion.div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={cn("text-xs font-semibold truncate", isMe ? "text-primary" : "text-card-foreground")}>
                      {member.name}
                    </span>
                    <AnimatedNumber
                      value={member.total}
                      delay={2.3 + idx * 0.1}
                      className="text-xs font-black tabular-nums text-card-foreground ml-2"
                    />
                  </div>
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ delay: 2.3 + idx * 0.1, duration: 0.8, ease: "easeOut" }}
                      className={cn(
                        "h-full rounded-full relative overflow-hidden",
                        isMe
                          ? "bg-gradient-to-r from-primary to-primary/70"
                          : "bg-gradient-to-r from-muted-foreground/50 to-muted-foreground/30"
                      )}
                    >
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_2s_infinite]" style={{ backgroundSize: "200% 100%" }} />
                    </motion.div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* Empty state */}
      {ranked.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-20"
        >
          <Trophy size={40} className="mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-sm text-muted-foreground">Nenhum dado disponível ainda</p>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Podium Slot ── */
function PodiumSlot({ member, rank, delay, isMe }: {
  member: { name: string; total: number; avatar_url?: string | null; id: string; originalIndex: number };
  rank: number; delay: number; isMe: boolean;
}) {
  const style = PODIUM_COLORS[rank];
  const podiumHeights = [140, 100, 76];
  const avatarSizes = ["w-[72px] h-[72px]", "w-14 h-14", "w-12 h-12"];
  const podiumH = podiumHeights[rank];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className={cn("flex flex-col items-center flex-1 max-w-[160px] relative", isMe && "z-10")}
    >
      {/* Crown for 1st */}
      {rank === 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -30 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          transition={{ delay: delay + 0.4, type: "spring", damping: 8 }}
        >
          <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }}>
            <Crown size={24} className="text-[hsl(45,93%,47%)] mb-1 drop-shadow-[0_0_8px_hsl(45,93%,47%,0.5)]" />
          </motion.div>
        </motion.div>
      )}

      {/* Avatar with pulse rings */}
      <motion.div
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ delay: delay + 0.2, type: "spring", damping: 10, stiffness: 100 }}
        className="relative mb-2"
      >
        {/* Pulse rings */}
        {rank === 0 && (
          <>
            <PulseRing color="hsl(45,93%,47%)" delay={delay + 1} />
            <PulseRing color="hsl(45,93%,47%)" delay={delay + 2} />
          </>
        )}

        <div className={cn(
          "rounded-full overflow-hidden shrink-0 relative ring-[3px]",
          avatarSizes[rank], style.ring, style.glow,
          isMe && "ring-4"
        )}>
          <img src={getMemberAvatar(member, member.originalIndex)} alt={member.name} className="w-full h-full object-cover" />

          {/* Shine sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
            initial={{ x: "-100%" }}
            animate={{ x: "200%" }}
            transition={{ delay: delay + 0.8, duration: 0.6 }}
          />
        </div>

        {/* Position badge */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: delay + 0.5, type: "spring", damping: 6 }}
          className={cn(
            "absolute -bottom-1 -right-1 rounded-full flex items-center justify-center font-black text-background bg-gradient-to-br shadow-lg",
            rank === 0 ? "w-7 h-7 text-xs" : "w-5 h-5 text-[9px]",
            style.gradient
          )}
        >
          {rank + 1}
        </motion.div>
      </motion.div>

      {/* Name */}
      <motion.span
        initial={{ opacity: 0, y: 5 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: delay + 0.4 }}
        className={cn("font-bold text-card-foreground truncate w-full text-center", rank === 0 ? "text-sm" : "text-xs", isMe && "text-primary")}
      >
        {member.name.split(" ")[0]} {isMe && "🫵"}
      </motion.span>

      {/* Podium bar */}
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: podiumH, opacity: 1 }}
        transition={{ delay: delay + 0.3, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "w-full rounded-t-xl flex items-center justify-center mt-2 overflow-hidden relative bg-gradient-to-b",
          style.bg, "ring-1", style.ring
        )}
      >
        {/* Floating particles inside podium */}
        <FloatingParticles color={style.particle} count={rank === 0 ? 8 : 4} />

        {/* Score */}
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.8, type: "spring", damping: 8 }}
          className="relative z-10 text-center"
        >
          <AnimatedNumber
            value={member.total}
            delay={delay + 0.6}
            className={cn("font-black tabular-nums block", rank === 0 ? "text-2xl" : "text-lg", style.text)}
          />
          <span className={cn("text-[8px] font-semibold uppercase tracking-wider opacity-60", style.text)}>pts</span>
        </motion.div>

        {/* Shimmer */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(110deg, transparent 30%, ${style.particle.replace(')', ',0.15)')} 50%, transparent 70%)`,
            backgroundSize: "200% 100%",
          }}
          animate={{ backgroundPosition: ["200% 0", "-200% 0"] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />

        {/* Bottom glow */}
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/20 to-transparent" />
      </motion.div>
    </motion.div>
  );
}
