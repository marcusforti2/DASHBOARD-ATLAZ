import { useState } from "react";
import { Target, Bot, LayoutDashboard } from "lucide-react";
import { CloserDailyDashboard } from "@/components/dashboard/CloserDailyDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import { AiChat } from "./AiChat";
import { AiToolsPanel } from "./AiToolsPanel";
import { cn } from "@/lib/utils";

type UserTab = "dashboard" | "ai-chat" | "ai-tools" | "general-dashboard";

interface UserHubProps {
  teamMemberId: string;
  memberName: string;
  memberRole: string;
  onSignOut: () => void;
}

const TABS: { id: UserTab; label: string; icon: React.ElementType; mobileLabel: string }[] = [
  { id: "dashboard", label: "Meu Dia", icon: Target, mobileLabel: "Dia" },
  { id: "ai-chat", label: "Coach IA", icon: Bot, mobileLabel: "Coach" },
  { id: "ai-tools", label: "Ferramentas IA", icon: Bot, mobileLabel: "Tools" },
  { id: "general-dashboard", label: "Dashboard", icon: LayoutDashboard, mobileLabel: "Geral" },
];

export function UserHub({ teamMemberId, memberName, memberRole, onSignOut }: UserHubProps) {
  const [activeTab, setActiveTab] = useState<UserTab>("dashboard");

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
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      {/* Tab navigation */}
      <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1 overflow-x-auto scrollbar-none">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <tab.icon size={14} />
            <span className="hidden sm:inline">{tab.label}</span>
            <span className="sm:hidden">{tab.mobileLabel}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {renderContent()}
    </div>
  );
}
