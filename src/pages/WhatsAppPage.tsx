import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTeamMembers } from "@/hooks/use-metrics";
import { DbTeamMember } from "@/lib/db";
import { toast } from "sonner";
import {
  MessageCircle, Phone, Send, Loader2, ShieldCheck, Users,
} from "lucide-react";
import FlowBuilder from "@/components/whatsapp/FlowBuilder";
import PasswordGate from "@/components/PasswordGate";

export default function WhatsAppPage() {
  const { user, isAdmin } = useAuth();
  const { data: members } = useTeamMembers();
  const [automations, setAutomations] = useState<any[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(true);

  const loadAutomations = async () => {
    setLoadingAutomations(true);
    const { data } = await supabase.from("whatsapp_automations").select("*").order("created_at", { ascending: false });
    setAutomations(data || []);
    setLoadingAutomations(false);
  };

  useEffect(() => { loadAutomations(); }, []);

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>;

  return (
    <PasswordGate>
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageCircle size={20} className="text-primary" />
          WhatsApp
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Gerencie fluxos, contatos e disparos de mensagens</p>
      </div>

      {/* Flow Builder */}
      {loadingAutomations ? (
        <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
      ) : (
        <FlowBuilder automations={automations} onReload={loadAutomations} />
      )}

      {/* Contacts */}
      <WhatsAppContactsSection members={members || []} />
    </div>
  );
}

// --- Contacts Section ---
function WhatsAppContactsSection({ members }: { members: DbTeamMember[] }) {
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [adminContacts, setAdminContacts] = useState<Record<string, string>>({});
  const [admins, setAdmins] = useState<{ user_id: string; full_name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [testPhone, setTestPhone] = useState("");
  const [testMsg, setTestMsg] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const { data: allContacts } = await supabase.from("whatsapp_contacts").select("team_member_id, user_id, phone");
    const memberMap: Record<string, string> = {};
    const adminMap: Record<string, string> = {};
    (allContacts || []).forEach((c: any) => {
      if (c.team_member_id) memberMap[c.team_member_id] = c.phone;
      if (c.user_id) adminMap[c.user_id] = c.phone;
    });
    setContacts(memberMap);
    setAdminContacts(adminMap);

    const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    if (roles && roles.length > 0) {
      const userIds = roles.map(r => r.user_id);
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      setAdmins((profiles || []).map(p => ({ user_id: p.id, full_name: p.full_name || "Admin" })));
    }
    setLoading(false);
  };

  const handleSaveMemberPhone = async (memberId: string, phone: string) => {
    setSaving(memberId);
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      await supabase.from("whatsapp_contacts").delete().eq("team_member_id", memberId);
      setContacts(prev => { const n = { ...prev }; delete n[memberId]; return n; });
      toast.success("Telefone removido");
    } else {
      const { data: existing } = await supabase.from("whatsapp_contacts").select("id").eq("team_member_id", memberId).maybeSingle();
      if (existing) await supabase.from("whatsapp_contacts").update({ phone: cleanPhone }).eq("id", existing.id);
      else await supabase.from("whatsapp_contacts").insert({ team_member_id: memberId, phone: cleanPhone });
      setContacts(prev => ({ ...prev, [memberId]: cleanPhone }));
      toast.success("Telefone salvo!");
    }
    setSaving(null);
  };

  const handleSaveAdminPhone = async (userId: string, phone: string) => {
    setSaving(userId);
    const cleanPhone = phone.replace(/\D/g, "");
    if (!cleanPhone) {
      await supabase.from("whatsapp_contacts").delete().eq("user_id", userId);
      setAdminContacts(prev => { const n = { ...prev }; delete n[userId]; return n; });
      toast.success("Telefone removido");
    } else {
      const { data: existing } = await supabase.from("whatsapp_contacts").select("id").eq("user_id", userId).maybeSingle();
      if (existing) await supabase.from("whatsapp_contacts").update({ phone: cleanPhone }).eq("id", existing.id);
      else await supabase.from("whatsapp_contacts").insert({ user_id: userId, phone: cleanPhone });
      setAdminContacts(prev => ({ ...prev, [userId]: cleanPhone }));
      toast.success("Telefone salvo!");
    }
    setSaving(null);
  };

  const handleTestMessage = async () => {
    if (!testPhone.trim() || !testMsg.trim()) { toast.error("Preencha o número e a mensagem"); return; }
    setSending(true);
    const { data, error } = await supabase.functions.invoke("send-whatsapp", {
      body: { phone: testPhone.trim(), message: testMsg.trim() },
    });
    if (error) toast.error("Erro: " + error.message);
    else if (data?.error) toast.error("Erro: " + data.error);
    else { toast.success("Mensagem enviada com sucesso! ✅"); setTestMsg(""); }
    setSending(false);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Phone size={14} className="text-primary" />
        <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Contatos WhatsApp</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-4">
          {/* Admins */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck size={10} /> Administradores
            </p>
            {admins.map(a => (
              <div key={a.user_id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <ShieldCheck size={12} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-card-foreground">
                    {a.full_name} {a.user_id === user?.id && <span className="text-[9px] text-muted-foreground">(Você)</span>}
                  </p>
                  <input type="tel" placeholder="5511999999999" defaultValue={adminContacts[a.user_id] || ""}
                    onBlur={e => { const val = e.target.value.replace(/\D/g, ""); if (val !== (adminContacts[a.user_id] || "")) handleSaveAdminPhone(a.user_id, val); }}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
                </div>
                {saving === a.user_id && <Loader2 size={12} className="animate-spin text-primary" />}
              </div>
            ))}
          </div>

          {/* Team Members */}
          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users size={10} /> Membros da Equipe
            </p>
            {members.filter(m => m.active).map(m => (
              <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                  <Phone size={12} className="text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-card-foreground">
                    {m.name} <span className="ml-1 text-[9px] text-muted-foreground">({m.member_role || "sdr"})</span>
                  </p>
                  <input type="tel" placeholder="5511999999999" defaultValue={contacts[m.id] || ""}
                    onBlur={e => { const val = e.target.value.replace(/\D/g, ""); if (val !== (contacts[m.id] || "")) handleSaveMemberPhone(m.id, val); }}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
                </div>
                {saving === m.id && <Loader2 size={12} className="animate-spin text-primary" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test message */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
        <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Enviar Mensagem de Teste</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Número</label>
            <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="5511999999999"
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mensagem</label>
            <input type="text" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Teste de mensagem..."
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleTestMessage} disabled={sending}
            className="px-4 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
            {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            Enviar Teste
          </button>
        </div>
      </div>
    </div>
  );
}
