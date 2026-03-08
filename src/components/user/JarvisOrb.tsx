import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type OrbState = "idle" | "listening" | "processing" | "speaking";

interface JarvisOrbProps {
  state: OrbState;
  size?: "sm" | "md" | "lg";
  onClick?: () => void;
  className?: string;
}

const STATE_CONFIG: Record<OrbState, {
  coreColor: string;
  glowColor: string;
  ringColor: string;
  pulseSpeed: number;
  glowIntensity: number;
}> = {
  idle: {
    coreColor: "#4A9EFF",
    glowColor: "rgba(74,158,255,0.5)",
    ringColor: "rgba(74,158,255,0.25)",
    pulseSpeed: 3,
    glowIntensity: 30,
  },
  listening: {
    coreColor: "#8B5CF6",
    glowColor: "rgba(139,92,246,0.6)",
    ringColor: "rgba(139,92,246,0.35)",
    pulseSpeed: 0.8,
    glowIntensity: 50,
  },
  processing: {
    coreColor: "#F59E0B",
    glowColor: "rgba(245,158,11,0.5)",
    ringColor: "rgba(245,158,11,0.3)",
    pulseSpeed: 0.6,
    glowIntensity: 45,
  },
  speaking: {
    coreColor: "#10B981",
    glowColor: "rgba(16,185,129,0.5)",
    ringColor: "rgba(16,185,129,0.3)",
    pulseSpeed: 1.2,
    glowIntensity: 40,
  },
};

const SIZES = {
  sm: { container: 48, core: 22, ring1: 34, ring2: 42, ring3: 48, tickCount: 24, tickLen: 3 },
  md: { container: 112, core: 40, ring1: 60, ring2: 80, ring3: 100, tickCount: 36, tickLen: 5 },
  lg: { container: 144, core: 52, ring1: 76, ring2: 100, ring3: 128, tickCount: 48, tickLen: 6 },
};

export function JarvisOrb({ state, size = "md", onClick, className }: JarvisOrbProps) {
  const config = STATE_CONFIG[state];
  const s = SIZES[size];
  const cx = s.container / 2;
  const cy = s.container / 2;

  // Generate tick marks around the rings (like the arc reactor segments)
  const ticks = Array.from({ length: s.tickCount }, (_, i) => {
    const angle = (i / s.tickCount) * Math.PI * 2 - Math.PI / 2;
    const r1 = s.ring2 / 2 - 1;
    const r2 = s.ring2 / 2 + s.tickLen;
    return {
      x1: cx + Math.cos(angle) * r1,
      y1: cy + Math.sin(angle) * r1,
      x2: cx + Math.cos(angle) * r2,
      y2: cy + Math.sin(angle) * r2,
      thick: i % 3 === 0,
    };
  });

  // Inner triangle shape (arc reactor style)
  const triangleSize = s.core * 0.35;
  const trianglePoints = [0, 1, 2].map((i) => {
    const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
    return `${cx + Math.cos(angle) * triangleSize},${cy + Math.sin(angle) * triangleSize}`;
  }).join(" ");

  return (
    <div
      className={cn("relative flex items-center justify-center cursor-pointer", className)}
      style={{ width: s.container, height: s.container }}
      onClick={onClick}
    >
      {/* Ambient glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            `0 0 ${config.glowIntensity}px ${config.glowColor}, inset 0 0 ${config.glowIntensity / 2}px ${config.glowColor}`,
            `0 0 ${config.glowIntensity * 1.8}px ${config.glowColor}, inset 0 0 ${config.glowIntensity}px ${config.glowColor}`,
            `0 0 ${config.glowIntensity}px ${config.glowColor}, inset 0 0 ${config.glowIntensity / 2}px ${config.glowColor}`,
          ],
        }}
        transition={{ duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
      />

      <svg
        width={s.container}
        height={s.container}
        viewBox={`0 0 ${s.container} ${s.container}`}
        className="relative z-10"
      >
        <defs>
          {/* Core radial gradient */}
          <radialGradient id={`core-grad-${size}`} cx="45%" cy="40%" r="55%">
            <stop offset="0%" stopColor="white" stopOpacity="0.95" />
            <stop offset="30%" stopColor={config.coreColor} stopOpacity="0.9" />
            <stop offset="70%" stopColor={config.coreColor} stopOpacity="0.7" />
            <stop offset="100%" stopColor={config.coreColor} stopOpacity="0.3" />
          </radialGradient>

          {/* Ring glow filter */}
          <filter id={`ring-glow-${size}`} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation={size === "sm" ? 1.5 : 3} result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Outer ring */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={s.ring3 / 2 - 1}
          fill="none"
          stroke={config.ringColor}
          strokeWidth={size === "sm" ? 1 : 1.5}
          filter={`url(#ring-glow-${size})`}
          animate={{
            opacity: [0.3, 0.7, 0.3],
          }}
          transition={{ duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Middle ring with dashes */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={s.ring2 / 2}
          fill="none"
          stroke={config.ringColor}
          strokeWidth={size === "sm" ? 0.8 : 1.2}
          strokeDasharray={size === "sm" ? "3 4" : "5 6"}
          filter={`url(#ring-glow-${size})`}
          animate={{
            strokeDashoffset: [0, -(s.ring2 * Math.PI)],
            opacity: [0.4, 0.8, 0.4],
          }}
          transition={{
            strokeDashoffset: { duration: state === "processing" ? 4 : 20, repeat: Infinity, ease: "linear" },
            opacity: { duration: config.pulseSpeed * 1.2, repeat: Infinity, ease: "easeInOut" },
          }}
        />

        {/* Inner ring solid */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={s.ring1 / 2}
          fill="none"
          stroke={config.coreColor}
          strokeWidth={size === "sm" ? 0.6 : 1}
          strokeOpacity={0.5}
          filter={`url(#ring-glow-${size})`}
          animate={{
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: config.pulseSpeed * 0.8, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        />

        {/* Tick marks */}
        {ticks.map((t, i) => (
          <motion.line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            stroke={config.coreColor}
            strokeWidth={t.thick ? (size === "sm" ? 0.8 : 1.2) : (size === "sm" ? 0.4 : 0.6)}
            strokeOpacity={t.thick ? 0.7 : 0.3}
            animate={t.thick ? {
              strokeOpacity: [0.5, 1, 0.5],
            } : undefined}
            transition={t.thick ? {
              duration: config.pulseSpeed,
              repeat: Infinity,
              ease: "easeInOut",
              delay: i * 0.1,
            } : undefined}
          />
        ))}

        {/* Rotating arc segment */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={(s.ring1 / 2 + s.ring2 / 2) / 2}
          fill="none"
          stroke={config.coreColor}
          strokeWidth={size === "sm" ? 1.5 : 2.5}
          strokeOpacity={0.6}
          strokeDasharray={`${s.ring1 * 0.3} ${s.ring1 * 2}`}
          strokeLinecap="round"
          filter={`url(#ring-glow-${size})`}
          animate={{
            rotate: [0, 360],
          }}
          transition={{
            duration: state === "processing" ? 2 : 8,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Counter-rotating arc */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={(s.ring2 / 2 + s.ring3 / 2) / 2}
          fill="none"
          stroke={config.coreColor}
          strokeWidth={size === "sm" ? 1 : 2}
          strokeOpacity={0.4}
          strokeDasharray={`${s.ring2 * 0.2} ${s.ring2 * 2}`}
          strokeLinecap="round"
          animate={{
            rotate: [360, 0],
          }}
          transition={{
            duration: state === "processing" ? 3 : 12,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />

        {/* Core circle */}
        <motion.circle
          cx={cx}
          cy={cy}
          r={s.core / 2}
          fill={`url(#core-grad-${size})`}
          animate={{
            r: state === "processing"
              ? [s.core / 2, s.core / 2 + 2, s.core / 2]
              : [s.core / 2, s.core / 2 + 1, s.core / 2],
          }}
          transition={{ duration: config.pulseSpeed * 0.6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Inner triangle (arc reactor center) */}
        {size !== "sm" && (
          <motion.polygon
            points={trianglePoints}
            fill="none"
            stroke="white"
            strokeWidth={size === "md" ? 1 : 1.5}
            strokeOpacity={0.5}
            strokeLinejoin="round"
            animate={{
              rotate: [0, 360],
              strokeOpacity: [0.3, 0.7, 0.3],
            }}
            transition={{
              rotate: { duration: state === "processing" ? 3 : 15, repeat: Infinity, ease: "linear" },
              strokeOpacity: { duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" },
            }}
            style={{ transformOrigin: `${cx}px ${cy}px` }}
          />
        )}

        {/* Central highlight dot */}
        <motion.circle
          cx={cx - s.core * 0.12}
          cy={cy - s.core * 0.12}
          r={s.core * 0.08}
          fill="white"
          opacity={0.7}
          animate={{
            opacity: [0.5, 0.9, 0.5],
          }}
          transition={{ duration: config.pulseSpeed * 0.8, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Node dots on outer ring */}
        {[0, 90, 180, 270].map((deg) => {
          const angle = (deg / 360) * Math.PI * 2 - Math.PI / 2;
          const r = s.ring3 / 2 - 1;
          const dotR = size === "sm" ? 1.5 : 2.5;
          return (
            <motion.circle
              key={deg}
              cx={cx + Math.cos(angle) * r}
              cy={cy + Math.sin(angle) * r}
              r={dotR}
              fill={config.coreColor}
              filter={`url(#ring-glow-${size})`}
              animate={{
                r: [dotR, dotR * 1.5, dotR],
                opacity: [0.6, 1, 0.6],
              }}
              transition={{
                duration: config.pulseSpeed,
                repeat: Infinity,
                ease: "easeInOut",
                delay: deg * 0.003,
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}
