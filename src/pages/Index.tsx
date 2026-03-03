import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMonths, useTeamMembers } from "@/hooks/use-metrics";
import AdminDashboard from "@/pages/AdminDashboard";
import CloserEntry from "@/pages/CloserEntry";
import { ChevronDown, BarChart3, Loader2, LogOut, User, ClipboardList, LayoutDashboard, Eye, Shield } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function Index() {
  const { user, role, profile, loading, signOut, isAdmin } = useAuth();
  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Admin: "admin" (full dashboard) or "closer-preview" (see as closer)
  // Closer: "entry" or "dashboard"
  const [viewMode, setViewMode] = useState<"admin" | "closer-preview" | "entry" | "dashboard">(
    "admin"
  );
  // When admin previews closer, which member to simulate
  const [previewMemberId, setPreviewMemberId] = useState<string | null>(null);

  const activeMonthId = selectedMonthId || months?.[0]?.id;

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

  const isCloserPreview = isAdmin && viewMode === "closer-preview";

  return (
    <div className="min-h-screen bg-background">
      {/* Closer preview banner */}
      {isCloserPreview && (
        <div className="bg-[hsl(38,92%,50%)]/10 border-b border-[hsl(38,92%,50%)]/30 px-6 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye size={14} className="text-[hsl(38,92%,50%)]" />
            <span className="text-xs font-semibold text-[hsl(38,92%,50%)]">
              MODO VISUALIZAÇÃO CLOSER
              {previewMemberId && members ? ` — ${members.find(m => m.id === previewMemberId)?.name}` : ""}
            </span>
          </div>
          <button
            onClick={() => setViewMode("admin")}
            className="flex items-center gap-1.5 px-3 py-1 text-[10px] rounded-lg font-semibold bg-[hsl(38,92%,50%)] text-background hover:bg-[hsl(38,92%,55%)] transition-colors"
          >
            <Shield size={10} /> Voltar ao Admin
          </button>
        </div>
      )}

      {/* Header */}
      <header className="border-b border-border sticky top-0 z-50 bg-background/80 backdrop-blur-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
          {/* Left side */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <BarChart3 size={20} className="text-primary" />
              <h1 className="text-sm font-bold text-foreground tracking-tight">LEARNING BRAND</h1>
            </div>
            <div className="h-5 w-px bg-border" />

            {/* Month selector */}
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

            <div className="h-5 w-px bg-border" />

            {/* View mode tabs */}
            {isAdmin && !isCloserPreview && (
              <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("admin")}
                  className={`px-3 py-1.5 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    viewMode === "admin"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Shield size={11} /> Gestão
                </button>
                <button
                  onClick={() => {
                    setViewMode("closer-preview");
                    if (!previewMemberId && members?.[0]) setPreviewMemberId(members[0].id);
                  }}
                  className={`px-3 py-1.5 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    viewMode === "closer-preview"
                      ? "bg-[hsl(38,92%,50%)] text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Eye size={11} /> Ver como Closer
                </button>
              </div>
            )}

            {/* Closer view tabs */}
            {!isAdmin && (
              <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-0.5">
                <button
                  onClick={() => setViewMode("entry")}
                  className={`px-3 py-1.5 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    viewMode === "entry"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <ClipboardList size={11} /> Inserir Dados
                </button>
                <button
                  onClick={() => setViewMode("dashboard")}
                  className={`px-3 py-1.5 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-all flex items-center gap-1.5 ${
                    viewMode === "dashboard"
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <LayoutDashboard size={11} /> Dashboard
                </button>
              </div>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {/* Member filter — admin dashboard mode */}
            {isAdmin && viewMode === "admin" && (
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

            {/* Member selector — closer preview mode */}
            {isCloserPreview && members && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold mr-1">Simular:</span>
                {members.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPreviewMemberId(m.id)}
                    className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold uppercase tracking-wider transition-colors ${
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

            <div className="h-5 w-px bg-border" />

            {/* User badge */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                <User size={14} className="text-primary" />
              </div>
              <div className="hidden sm:block">
                <p className="text-[10px] font-semibold text-foreground leading-tight">
                  {profile?.full_name || user.email}
                </p>
                <p className={`text-[9px] uppercase font-semibold ${isAdmin ? "text-primary" : "text-accent"}`}>
                  {isCloserPreview ? "Preview Mode" : role}
                </p>
              </div>
              <button
                onClick={signOut}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Sair"
              >
                <LogOut size={14} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      {isAdmin && viewMode === "admin" && (
        <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />
      )}

      {isCloserPreview && previewMemberId && (
        <div className="py-6 px-4">
          <CloserEntry
            teamMemberId={previewMemberId}
            memberName={members?.find(m => m.id === previewMemberId)?.name || ""}
          />
        </div>
      )}

      {!isAdmin && viewMode === "entry" && profile?.team_member_id && (
        <div className="py-6 px-4">
          <CloserEntry teamMemberId={profile.team_member_id} memberName={profile.full_name || ""} />
        </div>
      )}

      {!isAdmin && viewMode === "entry" && !profile?.team_member_id && (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm text-muted-foreground">Seu perfil ainda não foi vinculado a um membro da equipe.</p>
          <p className="text-xs text-muted-foreground">Peça ao gestor para vincular sua conta.</p>
        </div>
      )}

      {!isAdmin && viewMode === "dashboard" && (
        <AdminDashboard onSignOut={signOut} userName={profile?.full_name || ""} />
      )}
    </div>
  );
}
