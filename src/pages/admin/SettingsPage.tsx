import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  User, Save, Loader2, Link2, ShieldCheck, Trash2, Plus, Mail, Phone, Key,
  X, Check, Copy, Edit2, MessageCircle, Camera
} from "lucide-react";

export default function SettingsPage() {
  const { user, profile, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [saving, setSaving] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setFullName(profile?.full_name || ""); }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim() }).eq("id", user.id);
    if (error) toast.error(error.message);
    else toast.success("Perfil atualizado!");
    setSaving(false);
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
          <div className="relative group">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt={fullName} className="w-16 h-16 rounded-full object-cover" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-xl font-bold text-primary">{fullName?.charAt(0)?.toUpperCase() || "U"}</span>
              </div>
            )}
            <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
              <Camera size={18} className="text-white" />
              <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !user) return;
                  if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
                  const ext = file.name.split('.').pop();
                  const filePath = `admin-${user.id}/avatar.${ext}`;
                  await supabase.storage.from("member-avatars").upload(filePath, file, { upsert: true });
                  const { data: urlData } = supabase.storage.from("member-avatars").getPublicUrl(filePath);
                  const newUrl = urlData.publicUrl + "?t=" + Date.now();
                  await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", user.id);
                  // Also update team_member if linked
                  if (profile?.team_member_id) {
                    await supabase.from("team_members").update({ avatar_url: newUrl }).eq("id", profile.team_member_id);
                  }
                  toast.success("Foto atualizada!");
                  queryClient.invalidateQueries({ queryKey: ["team-members"] });
                  // Force re-fetch auth to update sidebar
                  window.location.reload();
                }} />
            </label>
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

      {isAdmin && <AdminManagementSection />}
    </div>
  );
}

// ─── Admin Form Dialog ───────────────────────────────────────────────────
function AdminFormDialog({
  admin,
  onClose,
  onSaved,
}: {
  admin?: { user_id: string; full_name: string; phone?: string } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(admin?.full_name || "");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState(admin?.phone || "");
  const [saving, setSaving] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);

  const isEditing = !!admin;

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setPassword(pwd);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    if (isEditing) {
      // Update profile name
      const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", admin.user_id);
      if (error) { toast.error(error.message); setSaving(false); return; }

      // Update/create WhatsApp contact
      if (phone.trim()) {
        const cleanPhone = phone.trim().replace(/\D/g, "");
        const { data: existing } = await supabase.from("whatsapp_contacts").select("id").eq("user_id", admin.user_id).maybeSingle();
        if (existing) {
          await supabase.from("whatsapp_contacts").update({ phone: cleanPhone }).eq("id", existing.id);
        } else {
          await supabase.from("whatsapp_contacts").insert({ phone: cleanPhone, user_id: admin.user_id });
        }
      }
      toast.success("Admin atualizado!");
      onSaved();
      onClose();
      setSaving(false);
      return;
    }

    // New admin
    if (!email.trim()) { toast.error("Email é obrigatório"); setSaving(false); return; }
    if (!password || password.length < 6) { toast.error("Senha mínimo 6 caracteres"); setSaving(false); return; }

    try {
      const { data, error } = await supabase.functions.invoke("create-admin", {
        body: { email: email.trim(), password, full_name: name.trim() },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const userId = data.user_id;

      // Save WhatsApp contact
      if (phone.trim() && userId) {
        await supabase.from("whatsapp_contacts").insert({
          phone: phone.trim().replace(/\D/g, ""),
          user_id: userId,
        });
      }

      toast.success("Admin criado!");
      onSaved();

      const appUrl = window.location.origin;
      const msg =
`🎉 *Bem-vindo(a), ${name.trim()}!*

Você foi cadastrado(a) como *Administrador* no sistema de gestão.

🔗 *Acesse aqui:* ${appUrl}/login
📧 *Email:* ${email.trim()}
🔑 *Senha:* ${password}

Faça login para gerenciar a equipe e acompanhar métricas. 🚀`;
      setWelcomeMsg(msg);

      // Auto-send WhatsApp
      if (phone.trim()) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
            body: JSON.stringify({ phone: phone.trim().replace(/\D/g, ""), message: msg }),
          });
          if (resp.ok) { setWhatsappSent(true); toast.success("✅ WhatsApp enviado!"); }
          else toast.error("Falha no envio automático do WhatsApp");
        } catch { toast.error("Erro ao enviar WhatsApp"); }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (welcomeMsg) { navigator.clipboard.writeText(welcomeMsg); setCopied(true); toast.success("Copiado!"); setTimeout(() => setCopied(false), 2000); }
  };

  // ── Welcome message ──
  if (welcomeMsg) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center"><Check size={16} className="text-accent" /></div>
            <div>
              <h3 className="text-sm font-bold text-card-foreground">Admin Cadastrado!</h3>
              <p className="text-[10px] text-muted-foreground">
                {whatsappSent ? "✅ Mensagem enviada no WhatsApp!" : "Copie e envie as credenciais"}
              </p>
            </div>
          </div>
          {whatsappSent && (
            <div className="rounded-xl bg-accent/10 border border-accent/30 p-3 mb-3 flex items-center gap-2">
              <MessageCircle size={14} className="text-accent shrink-0" />
              <span className="text-[10px] text-accent font-medium">Credenciais enviadas para {phone.trim()} via WhatsApp!</span>
            </div>
          )}
          <div className="rounded-xl bg-secondary/50 border border-border p-4 max-h-56 overflow-y-auto">
            <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-sans leading-relaxed">{welcomeMsg}</pre>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(welcomeMsg)}`, "_blank")}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
              <MessageCircle size={14} /> {whatsappSent ? "Enviar Novamente" : "Abrir WhatsApp"}
            </button>
            <button onClick={handleCopy}
              className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2">
              {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Copiado!" : "Copiar Mensagem"}
            </button>
          </div>
          <button onClick={onClose} className="w-full mt-2 px-4 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center">Fechar</button>
        </div>
      </div>
    );
  }

  // ── Form ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-card-foreground">{isEditing ? "Editar Admin" : "Novo Administrador"}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground"><X size={16} /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <User size={10} /> Nome completo
            </label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Maria Santos"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all" autoFocus />
          </div>
          {!isEditing && (
            <>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Mail size={10} /> Email de acesso
                </label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@empresa.com"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Key size={10} /> Senha
                </label>
                <div className="flex gap-2">
                  <input type="text" value={password} onChange={e => setPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                    className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none font-mono transition-all" />
                  <button type="button" onClick={generatePassword}
                    className="px-3 py-2 text-[10px] rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/30 font-semibold whitespace-nowrap">
                    Gerar
                  </button>
                </div>
              </div>
            </>
          )}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Phone size={10} /> WhatsApp <span className="text-[8px] font-normal opacity-60">{isEditing ? "" : "(envia credenciais automático)"}</span>
            </label>
            <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 99999-9999"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all" />
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">Cancelar</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {isEditing ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Admin Management Section ────────────────────────────────────────────
function AdminManagementSection() {
  const [admins, setAdmins] = useState<{ user_id: string; full_name: string; phone?: string; avatar_url?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAdmin, setEditingAdmin] = useState<{ user_id: string; full_name: string; phone?: string } | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { user } = useAuth();

  const loadAdmins = async () => {
    setLoading(true);
    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (!roles || roles.length === 0) { setAdmins([]); setLoading(false); return; }
    const userIds = roles.map(r => r.user_id);
    const [{ data: profiles }, { data: contacts }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds),
      supabase.from("whatsapp_contacts").select("user_id, phone").in("user_id", userIds),
    ]);
    setAdmins(userIds.map(uid => {
      const p = profiles?.find(pr => pr.id === uid);
      const c = contacts?.find(ct => ct.user_id === uid);
      return { user_id: uid, full_name: p?.full_name || "Admin", phone: c?.phone || "", avatar_url: p?.avatar_url };
    }));
    setLoading(false);
  };

  useEffect(() => { loadAdmins(); }, []);

  const handleDeleteAdmin = async (adminId: string) => {
    if (adminId === user?.id) { toast.error("Você não pode excluir a si mesmo"); return; }
    if (!confirm("Tem certeza que deseja excluir este admin? A conta será removida permanentemente.")) return;
    setDeletingId(adminId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      // Delete auth user via edge function
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: adminId }),
      });
      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || "Erro ao excluir");
      }
      toast.success("Admin excluído!");
      loadAdmins();
    } catch (err: any) {
      // Fallback: just remove role
      await supabase.from("user_roles").delete().eq("user_id", adminId).eq("role", "admin");
      toast.success("Admin removido");
      loadAdmins();
    } finally {
      setDeletingId(null);
    }
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldCheck size={14} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Administradores</h3>
          <span className="text-[10px] text-muted-foreground">({admins.length})</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleGenerateLink} disabled={generatingLink}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-accent text-accent-foreground hover:bg-accent/80 transition-colors flex items-center gap-1.5">
            {generatingLink ? <Loader2 size={10} className="animate-spin" /> : <Link2 size={10} />}
            Link de Convite
          </button>
          <button onClick={() => { setEditingAdmin(null); setShowForm(true); }}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5">
            <Plus size={10} /> Novo Admin
          </button>
        </div>
      </div>

      {inviteLink && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 space-y-2">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-wider">Link de Convite (7 dias)</p>
          <div className="flex items-center gap-2">
            <input readOnly value={inviteLink} className="flex-1 text-[10px] rounded-lg border border-border bg-secondary px-3 py-2 text-secondary-foreground outline-none font-mono" />
            <button onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copiado!"); }}
              className="px-3 py-2 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90">Copiar</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.user_id} className="flex items-center justify-between p-3 rounded-xl bg-secondary/30 border border-border">
              <div className="flex items-center gap-3">
                {a.avatar_url ? (
                  <img src={a.avatar_url} alt={a.full_name} className="w-9 h-9 rounded-full object-cover" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-primary/15 flex items-center justify-center">
                    <ShieldCheck size={14} className="text-primary" />
                  </div>
                )}
                <div>
                  <p className="text-xs font-semibold text-card-foreground">{a.full_name}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">{a.user_id === user?.id ? "Você" : a.user_id.slice(0, 8) + "..."}</span>
                    {a.phone && (
                      <span className="text-[9px] text-accent flex items-center gap-0.5">
                        <Phone size={8} /> {a.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditingAdmin(a); setShowForm(true); }}
                  className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Editar">
                  <Edit2 size={12} />
                </button>
                {a.user_id !== user?.id && (
                  <button onClick={() => handleDeleteAdmin(a.user_id)} disabled={deletingId === a.user_id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50" title="Excluir">
                    {deletingId === a.user_id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  </button>
                )}
              </div>
            </div>
          ))}
          {admins.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum admin encontrado</p>}
        </div>
      )}

      {showForm && (
        <AdminFormDialog
          admin={editingAdmin}
          onClose={() => { setShowForm(false); setEditingAdmin(null); }}
          onSaved={loadAdmins}
        />
      )}
    </div>
  );
}
