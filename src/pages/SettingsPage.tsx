import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTeamMembers } from "@/hooks/use-metrics";
import { DbTeamMember } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  User, Save, Loader2, Camera, Link2, Users, ChevronDown, ShieldCheck, Trash2, Plus, Mail
} from "lucide-react";

export default function SettingsPage() {
  const { user, profile, isAdmin } = useAuth();
  const { data: members } = useTeamMembers();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);

  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => { setFullName(profile?.full_name || ""); }, [profile]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingProfiles(true);
    Promise.all([
      supabase.from("profiles").select("id, full_name, team_member_id"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]).then(([{ data: allProfiles }, { data: adminRoles }]) => {
      const adminIds = new Set((adminRoles || []).map(r => r.user_id));
      setProfiles((allProfiles || []).filter(p => !adminIds.has(p.id)));
      setLoadingProfiles(false);
    });
  }, [isAdmin]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
    setSaving(false);
  };

  const handleLinkMember = async (profileId: string, memberId: string | null) => {
    const { error } = await supabase.from("profiles").update({ team_member_id: memberId }).eq("id", profileId);
    if (error) toast.error(error.message);
    else {
      toast.success("Vínculo atualizado!");
      setProfiles(prev => prev.map(p => p.id === profileId ? { ...p, team_member_id: memberId } : p));
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-bold text-foreground">Configurações</h2>
        <p className="text-xs text-muted-foreground mt-1">Gerencie seu perfil e configurações do sistema</p>
      </div>

      {/* Profile Section */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <User size={14} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Meu Perfil</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
            <span className="text-xl font-bold text-primary">{fullName?.charAt(0)?.toUpperCase() || "U"}</span>
          </div>
          <div className="flex-1 space-y-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome Completo</label>
              <input type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleSaveProfile} disabled={saving}
            className="px-4 py-2 text-xs rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Salvar Perfil
          </button>
        </div>
      </div>

      {/* Admin: Link Users to Team Members */}
      {isAdmin && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-accent" />
            <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Vincular Usuários a SDRs</h3>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Vincule contas de usuário aos membros da equipe para que possam inserir dados e ver seu dashboard.
          </p>
          {loadingProfiles ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
          ) : (
            <div className="space-y-2">
              {profiles.map(p => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                      <span className="text-[10px] font-bold text-primary">{p.full_name?.charAt(0)?.toUpperCase() || "?"}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-card-foreground">{p.full_name || "Sem nome"}</p>
                      <p className="text-[9px] text-muted-foreground">{p.id.slice(0, 8)}...</p>
                    </div>
                  </div>
                  <div className="relative">
                    <select value={p.team_member_id || ""} onChange={e => handleLinkMember(p.id, e.target.value || null)}
                      className="appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-3 py-1.5 pr-6 rounded-lg border border-border cursor-pointer focus:ring-1 focus:ring-primary outline-none">
                      <option value="">Não vinculado</option>
                      {members?.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Admin: Manage Admins */}
      {isAdmin && <AdminManagementSection />}
    </div>
  );
}

// --- Admin Management Section ---
function AdminManagementSection() {
  const [admins, setAdmins] = useState<{ user_id: string; email: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const { user } = useAuth();

  const loadAdmins = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (!roles || roles.length === 0) { setAdmins([]); setLoading(false); return; }
    const userIds = roles.map(r => r.user_id);
    const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
    setAdmins(userIds.map(uid => {
      const p = profiles?.find(pr => pr.id === uid);
      return { user_id: uid, email: "", full_name: p?.full_name || "Admin" };
    }));
    setLoading(false);
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleCreateAdmin = async () => {
    if (!newEmail.trim() || !newPassword.trim()) { toast.error("Email e senha são obrigatórios"); return; }
    if (newPassword.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); return; }
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("create-admin", {
      body: { email: newEmail.trim(), password: newPassword, full_name: newName.trim() || newEmail.trim() },
    });
    if (error) toast.error(error.message || "Erro ao criar admin");
    else if (data?.error) toast.error(data.error);
    else { toast.success("Admin criado!"); setNewEmail(""); setNewName(""); setNewPassword(""); setShowForm(false); loadAdmins(); }
    setCreating(false);
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (userId === user?.id) { toast.error("Você não pode remover a si mesmo"); return; }
    if (!confirm("Remover este admin?")) return;
    const { error } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
    if (error) toast.error(error.message);
    else { toast.success("Admin removido"); loadAdmins(); }
  };

  const handleGenerateLink = async () => {
    if (!user) return;
    setGeneratingLink(true);
    const { data, error } = await supabase.from("admin_invites").insert({ created_by: user.id }).select("token").single();
    if (error) toast.error("Erro: " + error.message);
    else { const link = `${window.location.origin}/register-admin?token=${data.token}`; setInviteLink(link); await navigator.clipboard.writeText(link); toast.success("Link copiado!"); }
    setGeneratingLink(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Gerenciar Administradores</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerateLink} disabled={generatingLink}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-accent text-accent-foreground hover:bg-accent/80 transition-colors flex items-center gap-1.5">
            {generatingLink ? <Loader2 size={10} className="animate-spin" /> : <Link2 size={10} />}
            Gerar Link de Convite
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus size={10} /> Criar Direto
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Link de Convite (válido por 7 dias)</p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteLink} className="flex-1 text-[10px] rounded-lg border border-border bg-secondary px-3 py-2 text-secondary-foreground outline-none" />
            <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copiado!"); }}
              className="px-3 py-2 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90">Copiar</button>
          </div>
        </div>
      )}

      {showForm && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
          <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Cadastrar Novo Admin</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</label>
              <input type="text" value={newName} onChange={e => setNewName(e.target.value)} placeholder="Nome completo"
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email *</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="admin@empresa.com"
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Senha *</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 text-[10px] rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancelar</button>
            <button onClick={handleCreateAdmin} disabled={creating}
              className="px-4 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
              {creating ? <Loader2 size={10} className="animate-spin" /> : <ShieldCheck size={10} />}
              Criar Admin
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.user_id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/30 border border-border">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <ShieldCheck size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-card-foreground">{a.full_name}</p>
                  <p className="text-[9px] text-muted-foreground">{a.user_id === user?.id ? "Você" : a.user_id.slice(0, 8) + "..."}</p>
                </div>
              </div>
              {a.user_id !== user?.id && (
                <button onClick={() => handleRemoveAdmin(a.user_id)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Remover admin">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum admin encontrado</p>}
        </div>
      )}
    </div>
  );
}
