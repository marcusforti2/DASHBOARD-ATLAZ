import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMonths, useTeamMembers } from "@/hooks/use-metrics";
import AdminDashboard from "@/pages/AdminDashboard";
import CloserEntry from "@/pages/CloserEntry";
import TeamManagement from "@/pages/TeamManagement";
import { AppSidebar, AdminView, CloserView } from "@/components/AppSidebar";
import { AiReportPanel } from "@/components/dashboard/AiReportPanel";
import { useMonthlyGoals, useAiReports, useDailyMetrics } from "@/hooks/use-metrics";
import { sumMetrics } from "@/lib/db";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { BarChart3, Loader2, Eye, Shield, Menu, Users, Target, Settings, Construction } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";

function ComingSoonPanel({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
        <Icon size={28} className="text-primary" />
      </div>
      <h2 className="text-lg font-bold text-foreground">{title}</h2>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Construction size={14} />
        <span>Em breve — esta seção está sendo construída</span>
      </div>
    </div>
  );
}

export default function Index() {
  const { user, role, profile, loading, signOut, isAdmin } = useAuth();
  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const queryClient = useQueryClient();

  const [adminView, setAdminView] = useState<AdminView>("dashboard");
  const [closerView, setCloserView] = useState<CloserView>("entry");
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();

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

  const activeView = isAdmin ? adminView : closerView;
  const isCloserPreview = isAdmin && adminView === "closer-preview";

  const handleViewChange = (view: string) => {
    if (isAdmin) {
      setAdminView(view as AdminView);
      if (view === "closer-preview" && !previewMemberId && members?.[0]) {
        setPreviewMemberId(members[0].id);
      }
    } else {
      setCloserView(view as CloserView);
    }
  };

  const renderContent = () => {
    if (isAdmin) {
      switch (adminView) {
        case "dashboard":
          return <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />;
        case "team":
          return <TeamManagement />;
        case "goals":
          return <ComingSoonPanel title="Gestão de Metas" icon={Target} />;
        case "reports":
          return activeMonthId && activeMonth ? (
            <AiReportPanel
              monthId={activeMonthId}
              monthLabel={activeMonth.label}
              metrics={totals}
              goals={goals ? { ...goals } as Record<string, number> : null}
              members={members?.map(m => m.name) || []}
              existingReports={aiReports || []}
              onReportGenerated={() => queryClient.invalidateQueries({ queryKey: ["ai-reports", activeMonthId] })}
            />
          ) : null;
        case "closer-preview":
          return previewMemberId ? (
            <CloserEntry
              teamMemberId={previewMemberId}
              memberName={members?.find(m => m.id === previewMemberId)?.name || ""}
            />
          ) : null;
        case "settings":
          return <ComingSoonPanel title="Configurações" icon={Settings} />;
        default:
          return null;
      }
    } else {
      switch (closerView) {
        case "entry":
          return profile?.team_member_id ? (
            <CloserEntry teamMemberId={profile.team_member_id} memberName={profile.full_name || ""} />
          ) : (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Seu perfil ainda não foi vinculado a um membro da equipe.</p>
              <p className="text-xs text-muted-foreground">Peça ao gestor para vincular sua conta.</p>
            </div>
          );
        case "dashboard":
          return <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />;
        default:
          return null;
      }
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

        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-background/80 backdrop-blur-xl sticky top-0 z-50">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
              <div className="h-5 w-px bg-border" />
              <h2 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                {isAdmin ? (
                  adminView === "dashboard" ? "Dashboard" :
                  adminView === "team" ? "Equipe" :
                  adminView === "goals" ? "Metas" :
                  adminView === "reports" ? "Relatórios IA" :
                  adminView === "closer-preview" ? "Visualização Closer" :
                  "Configurações"
                ) : (
                  closerView === "entry" ? "Inserir Dados" : "Meu Dashboard"
                )}
              </h2>
            </div>

            {/* Closer preview member selector */}
            {isCloserPreview && members && (
              <div className="flex items-center gap-2">
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

          {/* Closer preview banner */}
          {isCloserPreview && (
            <div className="bg-[hsl(38,92%,50%)]/10 border-b border-[hsl(38,92%,50%)]/30 px-4 py-2 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-[hsl(38,92%,50%)] uppercase tracking-wider">
                Modo visualização closer — {members?.find(m => m.id === previewMemberId)?.name}
              </span>
              <button
                onClick={() => setAdminView("dashboard")}
                className="flex items-center gap-1.5 px-3 py-1 text-[10px] rounded-lg font-semibold bg-[hsl(38,92%,50%)] text-background hover:bg-[hsl(38,92%,55%)] transition-colors"
              >
                <Shield size={10} /> Voltar ao Admin
              </button>
            </div>
          )}

          {/* Content */}
          <main className="flex-1 p-6 max-w-[1600px] mx-auto w-full">
            {renderContent()}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
