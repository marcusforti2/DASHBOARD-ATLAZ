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
import DnaMappingPage from "@/pages/DnaMappingPage";
import ProcessosPage from "@/pages/ProcessosPage";
import AdminCalendarPage from "@/pages/AdminCalendarPage";
import TrainingAdminPage from "@/pages/TrainingAdminPage";
import { AppSidebar, AdminView } from "@/components/AppSidebar";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { UserHub } from "@/components/user/UserHub";
import { JarvisOverlay } from "@/components/user/JarvisOverlay";
import { MotivationalPopup } from "@/components/user/MotivationalPopup";
import { useMonthlyGoals, useAiReports, useDailyMetrics } from "@/hooks/use-metrics";
import { sumMetrics, goalToMetrics } from "@/lib/db";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BarChart3, Loader2, Maximize, Minimize, ArrowLeft, Users, ClipboardEdit } from "lucide-react";
import { AdminMetricsEditor } from "@/components/admin/AdminMetricsEditor";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function Index() {
  const { user, role, profile, loading, signOut, isAdmin } = useAuth();
  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const queryClient = useQueryClient();

  const [adminView, setAdminView] = useState<AdminView>("dashboard");
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mainRef = useRef<HTMLDivElement>(null);

  // Inspect mode
  const [showInspectDialog, setShowInspectDialog] = useState(false);
  const [inspectMemberId, setInspectMemberId] = useState<string | null>(null);
  const [showMetricsEditor, setShowMetricsEditor] = useState(false);

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

  // ── SDR / Closer: full-screen layout WITHOUT sidebar ──
  if (!isAdmin) {
    if (!profile?.team_member_id) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="text-center space-y-3">
            <p className="text-sm text-muted-foreground">Seu perfil ainda não foi vinculado a um membro da equipe.</p>
            <p className="text-xs text-muted-foreground">Peça ao gestor para vincular sua conta.</p>
            <button onClick={signOut} className="text-xs text-primary hover:text-primary/80">Sair</button>
          </div>
        </div>
      );
    }
    const memberRole = members?.find(m => m.id === profile.team_member_id)?.member_role || "sdr";
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background">
          <UserHub
            teamMemberId={profile.team_member_id}
            memberName={profile.full_name || ""}
            memberRole={memberRole}
            onSignOut={signOut}
          />
          <MotivationalPopup userRole={role} />
        </div>
      </SidebarProvider>
    );
  }

  // ── INSPECT MODE: Full-screen view of a team member ──
  if (inspectMemberId) {
    const inspectMember = members?.find(m => m.id === inspectMemberId);
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background relative">
          <UserHub
            teamMemberId={inspectMemberId}
            memberName={inspectMember?.name || ""}
            memberRole={inspectMember?.member_role || "sdr"}
            onSignOut={signOut}
          />

          {/* Admin floating controls */}
          <div className="fixed top-3 right-3 z-[100] flex items-center gap-2">
            <button
              onClick={() => setShowMetricsEditor(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors shadow-lg"
            >
              <ClipboardEdit size={12} />
              Editar Métricas
            </button>
            <button
              onClick={() => {
                setInspectMemberId(null);
                setAdminView("dashboard");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
            >
              <ArrowLeft size={12} />
              Voltar Admin
            </button>
          </div>

          <AdminMetricsEditor
            open={showMetricsEditor}
            onOpenChange={setShowMetricsEditor}
            teamMemberId={inspectMemberId}
            memberName={inspectMember?.name || ""}
            memberRole={inspectMember?.member_role || "sdr"}
          />
        </div>
      </SidebarProvider>
    );
  }

  // ── Admin: sidebar layout ──
  const activeView = adminView;

  const handleViewChange = (view: string) => {
    if (view === "inspect-team") {
      setShowInspectDialog(true);
      return;
    }
    setAdminView(view as AdminView);
  };

  const getHeaderTitle = () => {
    switch (adminView) {
      case "dashboard": return "DASHBOARD LSD";
      case "team": return "Equipe";
      case "goals": return "Metas";
      case "reports": return "Relatórios IA";
      case "whatsapp": return "WhatsApp";
      case "popups": return "Popups Motivacionais";
      case "knowledge": return "Conhecimento IA";
      case "dna-mapping": return "Sales DNA Decoder";
      case "training": return "Treinamentos";
      case "calendars": return "Agendas";
      case "settings": return "Configurações";
      default: return "";
    }
  };

  const renderAdminContent = () => {
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
      case "settings":
        return <SettingsPage />;
      case "whatsapp":
        return <WhatsAppPage />;
      case "popups":
        return <AdminPopupsPage />;
      case "knowledge":
        return <AdminKnowledgePage />;
      case "dna-mapping":
        return <DnaMappingPage />;
      case "training":
        return <TrainingAdminPage />;
      case "processos":
        return <ProcessosPage />;
      case "calendars":
        return <AdminCalendarPage />;
      default:
        return null;
    }
  };

  const handleInspectMember = (memberId: string) => {
    setShowInspectDialog(false);
    setInspectMemberId(memberId);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar
          isAdmin={true}
          activeView={activeView}
          onViewChange={handleViewChange}
          userName={profile?.full_name || user.email || ""}
          userRole={role}
          avatarUrl={profile?.avatar_url}
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

            <div className="flex items-center gap-2">
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
            </div>
          </header>

          <main className="flex-1 p-2 sm:p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
            {renderAdminContent()}
          </main>
        </div>

        {/* TITAN — Admin only */}
        <JarvisOverlay
          memberId={profile?.team_member_id || user.id}
          memberRole="admin"
          onNavigate={(view) => setAdminView(view as AdminView)}
          onInspect={(memberId) => {
            setInspectMemberId(memberId);
          }}
          onFilter={(memberId, month, year) => {
            setAdminView("dashboard");
            // Filter will be applied via URL params or state — for now navigate to dashboard
            // The dashboard component will pick up the filter from a shared state
          }}
        />
      </div>

      {/* Inspect Team Dialog */}
      <Dialog open={showInspectDialog} onOpenChange={setShowInspectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-sm">
              <Users size={16} className="text-primary" />
              Inspecionar Equipe
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Selecione um membro para visualizar a tela dele como se fosse o próprio usuário.
          </p>
          <div className="grid gap-2 mt-2 max-h-[50vh] overflow-y-auto">
            {members?.filter(m => m.active).map(member => (
              <button
                key={member.id}
                onClick={() => handleInspectMember(member.id)}
                className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all text-left group"
              >
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary/25 to-accent/15 flex items-center justify-center shrink-0">
                  {member.avatar_url ? (
                    <img src={member.avatar_url} alt={member.name} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-primary">{member.name?.charAt(0)?.toUpperCase()}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">{member.name}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {member.member_role === "closer" ? "Closer" : member.member_role === "sdr_closer" ? "SDR + Closer" : "SDR"}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
}
