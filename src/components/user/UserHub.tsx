import { useState } from "react";
import { Target, Bot, LayoutDashboard, LogOut, BarChart3, Trophy, Zap, Shield, GraduationCap } from "lucide-react";
import { CloserDailyDashboard } from "@/components/dashboard/CloserDailyDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import { AiChat } from "./AiChat";
import { AiToolsPanel } from "./AiToolsPanel";
import { UserRankingScreen } from "./UserRankingScreen";
import { TrainingViewer } from "@/components/training/TrainingViewer";
import { cn } from "@/lib/utils";
import { AnimatePresence } from "framer-motion";
import { getMemberRoles } from "@/lib/db";

type UserTab = "dashboard" | "ai-chat" | "ai-tools" | "general-dashboard" | "training";

interface UserHubProps {
  teamMemberId: string;
  memberName: string;
  memberRole: string;
  onSignOut: () => void;
}

const TABS: { id: UserTab; label: string; icon: React.ElementType; mobileLabel: string }[] = [
  { id: "dashboard", label: "Meu Dia", icon: Target, mobileLabel: "Dia" },
  { id: "training", label: "Treinamentos", icon: GraduationCap, mobileLabel: "Treino" },
  { id: "ai-chat", label: "Coach IA", icon: Bot, mobileLabel: "Coach" },
  { id: "ai-tools", label: "Ferramentas IA", icon: Bot, mobileLabel: "Tools" },
  { id: "general-dashboard", label: "Dashboard", icon: LayoutDashboard, mobileLabel: "Geral" },
];

export function UserHub({ teamMemberId, memberName, memberRole, onSignOut }: UserHubProps) {
  const [activeTab, setActiveTab] = useState<UserTab>("dashboard");
  const [showRanking, setShowRanking] = useState(false);

  const roles = getMemberRoles({ member_role: memberRole });
  const hasDualRole = roles.includes("sdr") && roles.includes("closer");
  const roleLabel = hasDualRole ? "SDR + Closer" : roles.includes("closer") ? "Closer" : "SDR";

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return <CloserDailyDashboard teamMemberId={teamMemberId} memberName={memberName} memberRole={memberRole} />;
      case "ai-chat":
        return (
          <div className="max-w-3xl mx-auto">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <AiChat memberId={teamMemberId} tool="chat" />
            </div>
          </div>
        );
      case "ai-tools":
        return (
          <div className="max-w-4xl mx-auto">
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
              <AiToolsPanel memberId={teamMemberId} memberRole={memberRole} />
            </div>
          </div>
        );
      case "general-dashboard":
        return <AdminDashboard onSignOut={onSignOut} userName={memberName} />;
      case "training":
        return <TrainingViewer memberRole={memberRole} />;
      default:
        return null;
    }
  };

  return (
    <>
      {/* ── Header ── */}
      <header className="h-12 sm:h-14 flex items-center justify-between border-b border-border px-3 sm:px-6 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]">
            <BarChart3 size={16} className="text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-bold text-foreground truncate">{memberName}</p>
            <p className="text-[9px] sm:text-[10px] text-primary font-bold uppercase tracking-[0.15em]">{roleLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Tab navigation inline in header */}
          <nav className="flex items-center gap-0.5 bg-secondary/50 rounded-lg p-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); setShowRanking(false); }}
                className={cn(
                  "flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-md text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all",
                  activeTab === tab.id
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <tab.icon size={13} />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.mobileLabel}</span>
              </button>
            ))}
          </nav>

          {/* Ranking button */}
          <button
            onClick={() => setShowRanking(true)}
            className={cn(
              "flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg text-[10px] sm:text-xs font-semibold whitespace-nowrap transition-all",
              "text-[hsl(45,93%,47%)] bg-[hsl(45,93%,47%)]/10 hover:bg-[hsl(45,93%,47%)]/20 border border-[hsl(45,93%,47%)]/20"
            )}
          >
            <Trophy size={13} />
            <span className="hidden sm:inline">Ver Ranking</span>
            <span className="sm:hidden">Rank</span>
          </button>

          <div className="h-5 w-px bg-border mx-1 hidden sm:block" />

          <button
            onClick={onSignOut}
            className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Sair"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
        <AnimatePresence mode="wait">
          {showRanking ? (
            <UserRankingScreen
              key="ranking"
              teamMemberId={teamMemberId}
              memberName={memberName}
              memberRole={memberRole}
              onBack={() => setShowRanking(false)}
            />
          ) : (
            renderContent()
          )}
        </AnimatePresence>
      </main>
    </>
  );
}
