import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTeamMembers } from "@/hooks/use-metrics";
import { DbTeamMember } from "@/lib/db";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  User, Save, Loader2, Camera, Link2, Users, ChevronDown
} from "lucide-react";

export default function SettingsPage() {
  const { user, profile, isAdmin } = useAuth();
  const { data: members } = useTeamMembers();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);

  // Admin: list of profiles to link to team members
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => {
    setFullName(profile?.full_name || "");
  }, [profile]);

  useEffect(() => {
    if (!isAdmin) return;
    setLoadingProfiles(true);
    supabase
      .from("profiles")
      .select("id, full_name, team_member_id")
      .then(({ data }) => {
        setProfiles(data || []);
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
              <input
                type="text"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Email</label>
              <p className="mt-1 text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-4 py-2 text-xs rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
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
            <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Vincular Usuários a Closers</h3>
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
                    <select
                      value={p.team_member_id || ""}
                      onChange={e => handleLinkMember(p.id, e.target.value || null)}
                      className="appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-3 py-1.5 pr-6 rounded-lg border border-border cursor-pointer focus:ring-1 focus:ring-primary outline-none"
                    >
                      <option value="">Não vinculado</option>
                      {members?.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
