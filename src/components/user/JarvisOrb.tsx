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
  gradient: string;
  glowColor: string;
  ringColor: string;
  pulseSpeed: number;
  ringScale: number[];
}> = {
  idle: {
    gradient: "from-blue-500 via-blue-600 to-indigo-600",
    glowColor: "rgba(59,130,246,0.4)",
    ringColor: "border-blue-400/30",
    pulseSpeed: 3,
    ringScale: [1, 1.06, 1],
  },
  listening: {
    gradient: "from-purple-500 via-violet-500 to-fuchsia-500",
    glowColor: "rgba(168,85,247,0.6)",
    ringColor: "border-purple-400/50",
    pulseSpeed: 0.8,
    ringScale: [1, 1.18, 1],
  },
  processing: {
    gradient: "from-amber-400 via-orange-500 to-yellow-500",
    glowColor: "rgba(245,158,11,0.5)",
    ringColor: "border-amber-400/40",
    pulseSpeed: 0.6,
    ringScale: [1, 1.12, 1],
  },
  speaking: {
    gradient: "from-emerald-400 via-green-500 to-teal-500",
    glowColor: "rgba(16,185,129,0.5)",
    ringColor: "border-emerald-400/40",
    pulseSpeed: 1.2,
    ringScale: [1, 1.1, 1],
  },
};

const SIZES = {
  sm: { container: "w-12 h-12", core: "w-8 h-8", ringInset: "inset-1", ring2Inset: "inset-0.5", iconSize: 16 },
  md: { container: "w-28 h-28", core: "w-16 h-16", ringInset: "inset-3", ring2Inset: "inset-1", iconSize: 24 },
  lg: { container: "w-36 h-36", core: "w-20 h-20", ringInset: "inset-4", ring2Inset: "inset-1.5", iconSize: 28 },
};

export function JarvisOrb({ state, size = "md", onClick, className }: JarvisOrbProps) {
  const config = STATE_CONFIG[state];
  const sizeConfig = SIZES[size];

  return (
    <div
      className={cn("relative flex items-center justify-center cursor-pointer", sizeConfig.container, className)}
      onClick={onClick}
    >
      {/* Outermost ring */}
      <motion.div
        className={cn("absolute inset-0 rounded-full border-2", config.ringColor)}
        animate={{
          scale: config.ringScale,
          opacity: [0.2, 0.5, 0.2],
        }}
        transition={{ duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Middle ring */}
      <motion.div
        className={cn("absolute rounded-full border", config.ringColor, sizeConfig.ring2Inset)}
        style={{ inset: size === "sm" ? 2 : size === "md" ? 6 : 8 }}
        animate={{
          scale: [1, 1.1, 1],
          opacity: [0.15, 0.4, 0.15],
        }}
        transition={{ duration: config.pulseSpeed * 1.3, repeat: Infinity, ease: "easeInOut", delay: 0.3 }}
      />

      {/* Inner reactive ring */}
      <motion.div
        className={cn("absolute rounded-full border border-white/10")}
        style={{ inset: size === "sm" ? 4 : size === "md" ? 12 : 16 }}
        animate={{
          scale: state === "listening" ? [1, 1.15, 1] : state === "speaking" ? [1, 1.08, 1] : [1, 1.04, 1],
          opacity: [0.1, 0.3, 0.1],
        }}
        transition={{ duration: config.pulseSpeed * 0.7, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
      />

      {/* Core orb */}
      <motion.div
        className={cn(
          "rounded-full flex items-center justify-center bg-gradient-to-br",
          config.gradient,
          sizeConfig.core,
        )}
        animate={{
          boxShadow: [
            `0 0 20px ${config.glowColor}`,
            `0 0 ${state === "listening" ? 60 : state === "processing" ? 50 : 40}px ${config.glowColor}`,
            `0 0 20px ${config.glowColor}`,
          ],
        }}
        transition={{ duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
      >
        {/* Inner light dot */}
        <motion.div
          className="rounded-full bg-white/30"
          style={{ width: sizeConfig.iconSize * 0.5, height: sizeConfig.iconSize * 0.5 }}
          animate={{
            scale: state === "processing" ? [1, 1.5, 1] : [1, 1.2, 1],
            opacity: state === "processing" ? [0.4, 0.9, 0.4] : [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: state === "processing" ? 0.4 : config.pulseSpeed * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>
    </div>
  );
}
