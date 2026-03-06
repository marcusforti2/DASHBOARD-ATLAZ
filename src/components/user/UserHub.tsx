import { useState, useEffect } from "react";
import { Target, Bot, LayoutDashboard, LogOut, BarChart3, Trophy, GraduationCap, Calendar } from "lucide-react";
import { CloserDailyDashboard } from "@/components/dashboard/CloserDailyDashboard";
import AdminDashboard from "@/pages/AdminDashboard";
import { AiChat } from "./AiChat";
import { AiToolsPanel } from "./AiToolsPanel";
import { UserRankingScreen } from "./UserRankingScreen";
import { TrainingViewer } from "@/components/training/TrainingViewer";
import { TrainingNotificationPopup } from "@/components/training/TrainingNotificationPopup";
import { GoogleCalendarPanel } from "./GoogleCalendarPanel";
import { CalendarConnectPopup } from "./CalendarConnectPopup";
import { AnimatePresence } from "framer-motion";
import { getMemberRoles } from "@/lib/db";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  SidebarHeader,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

type UserTab = "dashboard" | "ai-chat" | "ai-tools" | "general-dashboard" | "training" | "calendar" | "ranking";

interface UserHubProps {
  teamMemberId: string;
  memberName: string;
  memberRole: string;
  onSignOut: () => void;
}

const TABS: { id: UserTab; label: string; icon: React.ElementType }[] = [
  { id: "dashboard", label: "Meu Dia", icon: Target },
  { id: "calendar", label: "Agenda", icon: Calendar },
  { id: "training", label: "Treinamentos", icon: GraduationCap },
  { id: "ai-chat", label: "Coach IA", icon: Bot },
  { id: "ai-tools", label: "Ferramentas IA", icon: Bot },
  { id: "general-dashboard", label: "Dashboard Geral", icon: LayoutDashboard },
  { id: "ranking", label: "Ranking", icon: Trophy },
];

export function UserHub({ teamMemberId, memberName, memberRole, onSignOut }: UserHubProps) {
  const [activeTab, setActiveTab] = useState<UserTab>("dashboard");

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
      case "calendar":
        return (
          <div className="max-w-3xl mx-auto">
            <GoogleCalendarPanel teamMemberId={teamMemberId} memberRole={memberRole} />
          </div>
        );
      case "ranking":
        return (
          <UserRankingScreen
            teamMemberId={teamMemberId}
            memberName={memberName}
            memberRole={memberRole}
            onBack={() => setActiveTab("dashboard")}
          />
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    return TABS.find(t => t.id === activeTab)?.label || "";
  };

  return (
    <>
      <TrainingNotificationPopup
        memberRole={memberRole}
        onGoToTraining={() => setActiveTab("training")}
      />

      <CalendarConnectPopup
        teamMemberId={teamMemberId}
        memberRole={memberRole}
        onGoToCalendar={() => setActiveTab("calendar")}
      />

      <UserHubSidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        memberName={memberName}
        roleLabel={roleLabel}
        onSignOut={onSignOut}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-11 sm:h-12 flex items-center justify-between border-b border-border px-2 sm:px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
            <div className="h-5 w-px bg-border hidden sm:block" />
            <h2 className="text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider truncate">
              {getTitle()}
            </h2>
          </div>
        </header>

        <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
          <AnimatePresence mode="wait">
            {renderContent()}
          </AnimatePresence>
        </main>
      </div>
    </>
  );
}

// ── Sidebar component for UserHub ──
function UserHubSidebar({
  activeTab,
  onTabChange,
  memberName,
  roleLabel,
  onSignOut,
}: {
  activeTab: UserTab;
  onTabChange: (tab: UserTab) => void;
  memberName: string;
  roleLabel: string;
  onSignOut: () => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const renderItem = (tab: { id: UserTab; label: string; icon: React.ElementType }) => {
    const isActive = activeTab === tab.id;
    const isRanking = tab.id === "ranking";

    const button = (
      <SidebarMenuButton
        onClick={() => onTabChange(tab.id)}
        isActive={isActive}
        tooltip={tab.label}
        className={`transition-all h-9 ${
          isActive
            ? isRanking
              ? "bg-[hsl(45,93%,47%)]/15 text-[hsl(45,93%,47%)] font-semibold border-l-2 border-[hsl(45,93%,47%)] rounded-l-none"
              : "bg-primary/15 text-primary font-semibold border-l-2 border-primary rounded-l-none"
            : isRanking
              ? "text-[hsl(45,93%,47%)]/70 hover:text-[hsl(45,93%,47%)] hover:bg-[hsl(45,93%,47%)]/10"
              : "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent/50"
        } ${collapsed ? "justify-center px-0" : ""}`}
      >
        <tab.icon size={18} strokeWidth={isActive ? 2.5 : 1.5} className="shrink-0" />
        {!collapsed && <span className="text-[11px] tracking-wide">{tab.label}</span>}
      </SidebarMenuButton>
    );

    return (
      <SidebarMenuItem key={tab.id}>
        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{button}</TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{tab.label}</TooltipContent>
          </Tooltip>
        ) : (
          button
        )}
      </SidebarMenuItem>
    );
  };

  const mainTabs = TABS.filter(t => t.id !== "ranking");
  const rankingTab = TABS.find(t => t.id === "ranking")!;

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className={`p-4 pb-2 ${collapsed ? "p-2 flex items-center justify-center" : ""}`}>
        <div className={`flex items-center overflow-hidden ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0 shadow-[0_0_12px_-3px_hsl(var(--primary)/0.4)]">
            <BarChart3 size={16} className="text-primary" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className="text-[11px] font-bold text-sidebar-foreground tracking-tight truncate">LEARNING BRAND</h1>
              <p className="text-[8px] text-muted-foreground uppercase tracking-[0.15em]">Sales Tracker</p>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className={collapsed ? "px-1" : "px-2"}>
        <SidebarGroup>
          {!collapsed && (
            <SidebarGroupLabel className="text-[8px] text-muted-foreground/60 uppercase tracking-[0.2em] px-3 mb-0.5 font-semibold">
              Menu
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu>{mainTabs.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-1 opacity-30" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderItem(rankingTab)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className={`border-t border-sidebar-border/50 ${collapsed ? "p-2" : "p-3"}`}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0 cursor-default">
                  <span className="text-[10px] font-bold text-primary">{memberName?.charAt(0)?.toUpperCase() || "U"}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">{memberName} — {roleLabel}</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button onClick={onSignOut} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <LogOut size={14} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs">Sair</TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-primary">{memberName?.charAt(0)?.toUpperCase() || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-sidebar-foreground truncate">{memberName}</p>
              <p className="text-[8px] text-primary uppercase font-bold tracking-[0.15em]">{roleLabel}</p>
            </div>
            <button onClick={onSignOut} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0" title="Sair">
              <LogOut size={14} />
            </button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
