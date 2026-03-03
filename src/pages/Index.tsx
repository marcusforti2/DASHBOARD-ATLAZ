import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMonths, useTeamMembers, useMonthlyGoals, useWeeklyGoals, useDailyMetrics, useAiReports } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, METRIC_KEYS } from "@/lib/db";
import AdminDashboard from "@/pages/AdminDashboard";
import CloserEntry from "@/pages/CloserEntry";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, BarChart3, Loader2, LogOut, User, ClipboardList, LayoutDashboard } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function Index() {
  const { user, role, profile, loading, signOut, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [closerView, setCloserView] = useState<"entry" | "dashboard">("entry");

  const activeMonthId = selectedMonthId || months?.[0]?.id;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={32} />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If no role assigned yet, show pending message
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
          <button onClick={signOut} className="text-xs text-primary hover:text-primary/80">
            Sair
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" />
              <h1 className="text-sm font-bold text-foreground tracking-tight">LEARNING BRAND</h1>
            </div>
            <div className="h-5 w-px bg-border" />
            <div className="relative">
              <select
                value={activeMonthId || ""}
                onChange={e => setSelectedMonthId(e.target.value)}
                className="appearance-none bg-secondary text-secondary-foreground text-xs font-medium px-3 py-1.5 pr-7 rounded-lg border-none cursor-pointer focus:ring-1 focus:ring-primary outline-none"
              >
                {months?.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>

            {/* Closer: toggle between entry and dashboard */}
            {!isAdmin && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCloserView("entry")}
                  className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                    closerView === "entry" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  <ClipboardList size={12} /> Inserir Dados
                </button>
                <button
                  onClick={() => setCloserView("dashboard")}
                  className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors flex items-center gap-1.5 ${
                    closerView === "dashboard" ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  <LayoutDashboard size={12} /> Dashboard
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            {/* Member filter (admin only) */}
            {isAdmin && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setSelectedMemberId(null)}
                  className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors ${
                    !selectedMemberId ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  }`}
                >
                  Todos
                </button>
                {members?.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMemberId(m.id)}
                    className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors ${
                      selectedMemberId === m.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}

            {/* User info */}
            <div className="h-5 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-semibold text-foreground leading-tight">{profile?.full_name || user.email}</p>
                <p className="text-[9px] text-muted-foreground uppercase">{role}</p>
              </div>
              <button onClick={signOut} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Sair">
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      {isAdmin ? (
        <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />
      ) : (
        <div className="py-6 px-4">
          {closerView === "entry" && profile?.team_member_id ? (
            <CloserEntry teamMemberId={profile.team_member_id} memberName={profile.full_name || ""} />
          ) : closerView === "entry" && !profile?.team_member_id ? (
            <div className="text-center py-12 space-y-3">
              <p className="text-sm text-muted-foreground">Seu perfil ainda não foi vinculado a um membro da equipe.</p>
              <p className="text-xs text-muted-foreground">Peça ao gestor para vincular sua conta.</p>
            </div>
          ) : (
            <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />
          )}
        </div>
      )}
    </div>
  );
}
