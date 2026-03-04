import { useState, useCallback, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMonths, useTeamMembers } from "@/hooks/use-metrics";
import AdminDashboard from "@/pages/AdminDashboard";
import TeamManagement from "@/pages/TeamManagement";
import GoalsManagement from "@/pages/GoalsManagement";
import SettingsPage from "@/pages/SettingsPage";
import WhatsAppPage from "@/pages/WhatsAppPage";
import AdminPopupsPage from "@/pages/AdminPopupsPage";
import AdminKnowledgePage from "@/pages/AdminKnowledgePage";
import { AppSidebar, AdminView, CloserView } from "@/components/AppSidebar";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { CloserDailyDashboard } from "@/components/dashboard/CloserDailyDashboard";
import CloserEntry from "@/pages/CloserEntry";
import { UserHub } from "@/components/user/UserHub";
import { MotivationalPopup } from "@/components/user/MotivationalPopup";
import { useMonthlyGoals, useAiReports, useDailyMetrics } from "@/hooks/use-metrics";
import { sumMetrics, goalToMetrics } from "@/lib/db";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BarChart3, Loader2, Eye, Shield, Maximize, Minimize } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

export default function Index() {
  const { user, role, profile, loading, signOut, isAdmin } = useAuth();
  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const queryClient = useQueryClient();

  const [adminView, setAdminView] = useState<AdminView>("dashboard");
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);
  const [previewCloserView, setPreviewCloserView] = useState<"entry" | "daily-goals">("entry");
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      mainRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "F11" || (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === "f")) {
        e.preventDefault();
        toggleFullscreen();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const activeMonthId = selectedMonthId || months?.[0]?.id;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  const { data: goals } = useMonthlyGoals(activeMonthId);
  const { data: aiReports } = useAiReports(activeMonthId);
  const { data: dailyMetrics } = useDailyMetrics(activeMonthId);
  const totals = dailyMetrics && dailyMetrics.length > 0 ? sumMetrics(dailyMetrics) : {};

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="text-center space-y-4 max-w-sm">
          <BarChart3 size={32} className="text-primary mx-auto" />
          <h2 className="text-lg font-bold text-foreground">Conta Pendente</h2>
          <p className="text-sm text-muted-foreground">
            Sua conta foi criada mas ainda não foi vinculada a um perfil.
            Peça ao gestor para aprovar seu acesso.
          </p>
          <button onClick={signOut} className="text-xs text-primary hover:text-primary/80">Sair</button>
        </div>
      </div>
    );
  }

  const activeView = isAdmin ? adminView : "hub";
  const isCloserPreview = isAdmin && adminView === "closer-preview";

  const handleViewChange = (view: string) => {
    if (isAdmin) {
      setAdminView(view as AdminView);
      if (view === "closer-preview" && !previewMemberId && members?.[0]) {
        setPreviewMemberId(members[0].id);
      }
    }
  };

  const getHeaderTitle = () => {
    if (!isAdmin) return "Meu Painel";
    switch (adminView) {
      case "dashboard": return "DASHBOARD LSD";
      case "team": return "Equipe";
      case "goals": return "Metas";
      case "reports": return "Relatórios IA";
      case "whatsapp": return "WhatsApp";
      case "popups": return "Popups Motivacionais";
      case "knowledge": return "Conhecimento IA";
      case "closer-preview": return "Visualização SDR";
      case "settings": return "Configurações";
      default: return "";
    }
  };

  const renderContent = () => {
    if (!isAdmin) {
      // SDR/Closer unified hub
      if (!profile?.team_member_id) {
        return (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">Seu perfil ainda não foi vinculado a um membro da equipe.</p>
            <p className="text-xs text-muted-foreground">Peça ao gestor para vincular sua conta.</p>
          </div>
        );
      }
      const memberRole = members?.find(m => m.id === profile.team_member_id)?.member_role || "sdr";
      return (
        <UserHub
          teamMemberId={profile.team_member_id}
          memberName={profile.full_name || ""}
          memberRole={memberRole}
          onSignOut={signOut}
        />
      );
    }

    // Admin views
    switch (adminView) {
      case "dashboard":
        return <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />;
      case "team":
        return <TeamManagement />;
      case "goals":
        return <GoalsManagement />;
      case "reports":
        return activeMonthId && activeMonth ? (
          <AiReportPanel
            monthId={activeMonthId}
            monthLabel={activeMonth.label}
            metrics={totals}
            goals={goalToMetrics(goals)}
            members={members?.map(m => m.name) || []}
            existingReports={aiReports || []}
            onReportGenerated={() => queryClient.invalidateQueries({ queryKey: ["ai-reports", activeMonthId] })}
          />
        ) : null;
      case "closer-preview":
        if (!previewMemberId) return null;
        const previewMember = members?.find(m => m.id === previewMemberId);
        return (
          <UserHub
            teamMemberId={previewMemberId}
            memberName={previewMember?.name || ""}
            memberRole={previewMember?.member_role || "sdr"}
            onSignOut={signOut}
          />
        );
      case "settings":
        return <SettingsPage />;
      case "whatsapp":
        return <WhatsAppPage />;
      case "popups":
        return <AdminPopupsPage />;
      case "knowledge":
        return <AdminKnowledgePage />;
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          isAdmin={isAdmin}
          activeView={activeView}
          onViewChange={handleViewChange}
          userName={profile?.full_name || user.email || ""}
          userRole={isCloserPreview ? "Preview Mode" : role}
          onSignOut={signOut}
        />

        <div ref={mainRef} className={`flex-1 flex flex-col min-w-0 ${isFullscreen ? "bg-background" : ""}`}>
          <header className="h-11 sm:h-12 flex items-center justify-between border-b border-border px-2 sm:px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground shrink-0" />
              <div className="h-5 w-px bg-border hidden sm:block" />
              <h2 className="text-[10px] sm:text-xs font-semibold text-foreground uppercase tracking-wider truncate">
                {getHeaderTitle()}
              </h2>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                >
                  {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {isFullscreen ? "Sair da tela cheia" : "Tela cheia"} <kbd className="ml-1 px-1 py-0.5 rounded bg-muted text-[9px] font-mono">Ctrl+Shift+F</kbd>
              </TooltipContent>
            </Tooltip>

            {isCloserPreview && members && (
              <div className="flex items-center gap-2 flex-wrap">
                <Eye size={12} className="text-[hsl(38,92%,50%)]" />
                <span className="text-[10px] text-[hsl(38,92%,50%)] font-semibold uppercase tracking-wider mr-1">Simular:</span>
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPreviewMemberId(m.id)}
                    className={`px-2.5 py-1 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors ${
                      previewMemberId === m.id
                        ? "bg-[hsl(38,92%,50%)] text-background"
                        : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </header>

          {isCloserPreview && (
            <div className="bg-[hsl(38,92%,50%)]/10 border-b border-[hsl(38,92%,50%)]/30 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[hsl(38,92%,50%)] uppercase tracking-wider">
                Modo visualização SDR — {members?.find(m => m.id === previewMemberId)?.name}
              </span>
              <button
                onClick={() => setAdminView("dashboard")}
                className="flex items-center gap-1.5 px-3 py-1 text-[10px] rounded-lg font-semibold bg-[hsl(38,92%,50%)] text-background hover:bg-[hsl(38,92%,55%)] transition-colors"
              >
                <Shield size={10} /> Voltar ao Admin
              </button>
            </div>
          )}

          <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
            {renderContent()}
          </main>
        </div>

        {/* Motivational popups for SDR/Closer */}
        {!isAdmin && role && <MotivationalPopup userRole={role} />}
      </div>
    </SidebarProvider>
  );
}
