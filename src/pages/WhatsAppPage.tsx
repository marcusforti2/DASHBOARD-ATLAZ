import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useTeamMembers } from "@/hooks/use-metrics";
import { DbTeamMember } from "@/lib/db";
import { toast } from "sonner";
import {
  MessageCircle, Phone, Send, Loader2, ShieldCheck, Users, Save, Sparkles, Clock, Target,
  ToggleLeft, ToggleRight, Zap, Play, Eye, Trash2, Plus, ChevronDown
} from "lucide-react";

export default function WhatsAppPage() {
  const { user, isAdmin } = useAuth();
  const { data: members } = useTeamMembers();

  if (!isAdmin) return <p className="text-sm text-muted-foreground">Acesso restrito a administradores.</p>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <MessageCircle size={20} className="text-green-500" />
          WhatsApp
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Gerencie contatos, automações e disparos de mensagens</p>
      </div>

      <WhatsAppContactsSection members={members || []} />
      <WhatsAppAutomationsPanel />
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
        <Phone size={14} className="text-green-500" />
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
                <div className="w-8 h-8 rounded-full bg-green-500/15 flex items-center justify-center">
                  <Phone size={12} className="text-green-500" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-card-foreground">
                    {m.name} <span className="ml-1 text-[9px] text-muted-foreground">({m.member_role || "sdr"})</span>
                  </p>
                  <input type="tel" placeholder="5511999999999" defaultValue={contacts[m.id] || ""}
                    onBlur={e => { const val = e.target.value.replace(/\D/g, ""); if (val !== (contacts[m.id] || "")) handleSaveMemberPhone(m.id, val); }}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-[11px] text-secondary-foreground focus:ring-1 focus:ring-green-500 outline-none" />
                </div>
                {saving === m.id && <Loader2 size={12} className="animate-spin text-green-500" />}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test message */}
      <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3">
        <h4 className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Enviar Mensagem de Teste</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Número</label>
            <input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="5511999999999"
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-green-500 outline-none" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mensagem</label>
            <input type="text" value={testMsg} onChange={e => setTestMsg(e.target.value)} placeholder="Teste de mensagem..."
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-green-500 outline-none" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleTestMessage} disabled={sending}
            className="px-4 py-1.5 text-[10px] rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
            {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            Enviar Teste
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Automations Panel ---
function WhatsAppAutomationsPanel() {
  const [triggeringReport, setTriggeringReport] = useState(false);
  const [lastResult, setLastResult] = useState<any>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedAutomation, setGeneratedAutomation] = useState<any>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [savingAutomation, setSavingAutomation] = useState(false);
  const [automations, setAutomations] = useState<any[]>([]);
  const [loadingAutomations, setLoadingAutomations] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => { loadAutomations(); }, []);

  const loadAutomations = async () => {
    setLoadingAutomations(true);
    const { data } = await supabase.from("whatsapp_automations").select("*").order("created_at", { ascending: false });
    setAutomations(data || []);
    setLoadingAutomations(false);
  };

  const handleTriggerDailyReport = async () => {
    setTriggeringReport(true); setLastResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("daily-whatsapp-report", { body: {} });
      if (error) { toast.error("Erro: " + error.message); setLastResult({ error: error.message }); }
      else if (data?.error) { toast.error("Erro: " + data.error); setLastResult({ error: data.error }); }
      else {
        const sc = data?.results?.filter((r: any) => r.success).length || 0;
        toast.success(`Relatório enviado para ${sc}/${data?.results?.length || 0} contatos!`);
        setLastResult(data);
      }
    } catch (e: any) { toast.error("Erro: " + e.message); setLastResult({ error: e.message }); }
    setTriggeringReport(false);
  };

  const handleGenerateAutomation = async () => {
    if (aiPrompt.trim().length < 5) { toast.error("Descreva melhor a automação"); return; }
    setGenerating(true); setGeneratedAutomation(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-automation", { body: { prompt: aiPrompt.trim() } });
      if (error) toast.error("Erro: " + error.message);
      else if (data?.error) toast.error("Erro: " + data.error);
      else if (data?.automation) { setGeneratedAutomation(data.automation); toast.success("Automação gerada! Revise e salve."); }
    } catch (e: any) { toast.error("Erro: " + e.message); }
    setGenerating(false);
  };

  const handleSaveAutomation = async () => {
    if (!generatedAutomation) return;
    setSavingAutomation(true);
    const { error } = await supabase.from("whatsapp_automations").insert({
      name: generatedAutomation.name, description: generatedAutomation.description || "",
      message_template: generatedAutomation.message_template, schedule_cron: generatedAutomation.schedule_cron || null,
      target_audience: generatedAutomation.target_audience || "all", target_role: generatedAutomation.target_role || null,
      include_metrics: generatedAutomation.include_metrics ?? true, include_ai_tips: generatedAutomation.include_ai_tips ?? true,
    });
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Automação salva! 🎉"); setGeneratedAutomation(null); setAiPrompt(""); setShowGenerator(false); loadAutomations(); }
    setSavingAutomation(false);
  };

  const handleToggle = async (id: string, active: boolean) => {
    const { error } = await supabase.from("whatsapp_automations").update({ active: !active }).eq("id", id);
    if (error) toast.error(error.message);
    else { setAutomations(prev => prev.map(a => a.id === id ? { ...a, active: !active } : a)); toast.success(active ? "Desativada" : "Ativada"); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta automação permanentemente?")) return;
    const { error } = await supabase.from("whatsapp_automations").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { setAutomations(prev => prev.filter(a => a.id !== id)); toast.success("Excluída"); }
  };

  const handleStartEdit = (a: any) => { setEditingId(a.id); setEditForm({ ...a }); setExpandedId(a.id); };
  const handleCancelEdit = () => { setEditingId(null); setEditForm(null); };

  const handleSaveEdit = async () => {
    if (!editForm || !editingId) return;
    setSavingEdit(true);
    const { error } = await supabase.from("whatsapp_automations").update({
      name: editForm.name, description: editForm.description, message_template: editForm.message_template,
      schedule_cron: editForm.schedule_cron || null, target_audience: editForm.target_audience || "all",
      target_role: editForm.target_role || null, include_metrics: editForm.include_metrics, include_ai_tips: editForm.include_ai_tips,
    }).eq("id", editingId);
    if (error) toast.error("Erro: " + error.message);
    else { toast.success("Atualizada! ✅"); setAutomations(prev => prev.map(a => a.id === editingId ? { ...a, ...editForm } : a)); setEditingId(null); setEditForm(null); }
    setSavingEdit(false);
  };

  const cronToLabel = (cron: string | null) => {
    if (!cron) return "Manual";
    const match = cron.match(/^(\d+)\s+(\d+)\s+/);
    if (match) {
      const hour = Math.max(0, parseInt(match[2]) - 3);
      if (cron.includes("1-5")) return `${hour}h Seg-Sex`;
      if (cron.includes("* *")) return `${hour}h Diário`;
    }
    return cron;
  };

  const audienceLabel = (a: string) => ({ all: "Todos", sdrs: "Só SDRs", closers: "Só Closers", admins: "Só Admins", team: "Só Equipe" }[a] || a);

  const AUDIENCE_OPTIONS = [
    { value: "all", label: "Todos (Equipe + Admins)" },
    { value: "team", label: "Só Equipe (SDRs + Closers)" },
    { value: "sdrs", label: "Só SDRs" },
    { value: "closers", label: "Só Closers" },
    { value: "admins", label: "Só Administradores" },
  ];

  const renderForm = (form: any, setForm: (fn: (prev: any) => any) => void) => (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Nome</label>
          <input value={form.name || ""} onChange={e => setForm((p: any) => ({ ...p, name: e.target.value }))}
            className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
        </div>
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Descrição</label>
          <input value={form.description || ""} onChange={e => setForm((p: any) => ({ ...p, description: e.target.value }))}
            className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none" />
        </div>
      </div>
      <div>
        <label className="text-[9px] font-semibold text-muted-foreground uppercase">Template da Mensagem</label>
        <textarea value={form.message_template || ""} onChange={e => setForm((p: any) => ({ ...p, message_template: e.target.value }))}
          rows={6} className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-[11px] text-secondary-foreground focus:ring-1 focus:ring-primary outline-none resize-none font-mono" />
        <p className="text-[9px] text-muted-foreground mt-1">
          Variáveis: {"{{nome}}"} {"{{data}}"} {"{{role}}"} {"{{metricas_hoje}}"} {"{{metricas_mes}}"} {"{{progresso_meta}}"} {"{{falta_meta}}"} {"{{dicas_ia}}"}
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Agendamento (Cron)</label>
          <input value={form.schedule_cron || ""} onChange={e => setForm((p: any) => ({ ...p, schedule_cron: e.target.value || null }))}
            placeholder="0 21 * * 1-5" className="mt-0.5 w-full rounded-lg border border-border bg-secondary px-3 py-1.5 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none font-mono" />
          <p className="text-[9px] text-muted-foreground mt-0.5">{cronToLabel(form.schedule_cron)}</p>
        </div>
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Público Alvo</label>
          <div className="relative mt-0.5">
            <select value={form.target_audience || "all"} onChange={e => setForm((p: any) => ({ ...p, target_audience: e.target.value }))}
              className="appearance-none w-full bg-secondary text-secondary-foreground text-[10px] font-medium px-3 py-1.5 pr-6 rounded-lg border border-border cursor-pointer focus:ring-1 focus:ring-primary outline-none">
              {AUDIENCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Métricas</label>
          <button onClick={() => setForm((p: any) => ({ ...p, include_metrics: !p.include_metrics }))}
            className="mt-0.5 flex items-center gap-1.5 text-[10px] text-card-foreground">
            {form.include_metrics ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
            {form.include_metrics ? "Sim" : "Não"}
          </button>
        </div>
        <div>
          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Dicas IA</label>
          <button onClick={() => setForm((p: any) => ({ ...p, include_ai_tips: !p.include_ai_tips }))}
            className="mt-0.5 flex items-center gap-1.5 text-[10px] text-card-foreground">
            {form.include_ai_tips ? <ToggleRight size={16} className="text-green-500" /> : <ToggleLeft size={16} className="text-muted-foreground" />}
            {form.include_ai_tips ? "Sim" : "Não"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Zap size={14} className="text-green-500" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Automações</h3>
          <span className="px-2 py-0.5 text-[9px] rounded-full bg-accent text-accent-foreground">{automations.length + 1}</span>
        </div>
        <button onClick={() => setShowGenerator(!showGenerator)}
          className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Sparkles size={10} /> Criar com IA
        </button>
      </div>

      {/* AI Generator */}
      {showGenerator && (
        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <Sparkles size={12} className="text-primary" />
            <h4 className="text-[10px] font-semibold text-primary uppercase tracking-wider">Gerador com IA</h4>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Ex: "Resumo semanal toda sexta às 17h para os admins" ou "Motivação diária às 8h para SDRs"
          </p>
          <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Descreva a automação..."
            rows={3} className="w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-1 focus:ring-primary outline-none resize-none" />
          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowGenerator(false); setGeneratedAutomation(null); setAiPrompt(""); }}
              className="px-3 py-1.5 text-[10px] rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancelar</button>
            <button onClick={handleGenerateAutomation} disabled={generating || aiPrompt.trim().length < 5}
              className="px-4 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
              {generating ? <Loader2 size={10} className="animate-spin" /> : <Sparkles size={10} />}
              {generating ? "Gerando..." : "Gerar Automação"}
            </button>
          </div>

          {generatedAutomation && (
            <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center gap-2">
                <Eye size={12} className="text-green-600" />
                <h4 className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Preview — Revise antes de salvar</h4>
              </div>
              {renderForm(generatedAutomation, setGeneratedAutomation)}
              <div className="flex justify-end gap-2 pt-2 border-t border-border">
                <button onClick={() => setGeneratedAutomation(null)} className="px-3 py-1.5 text-[10px] rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80">Descartar</button>
                <button onClick={handleSaveAutomation} disabled={savingAutomation}
                  className="px-4 py-1.5 text-[10px] rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5">
                  {savingAutomation ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
                  Salvar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Built-in: Daily Report */}
      <div className="rounded-lg border border-border bg-secondary/20 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/15 flex items-center justify-center">
              <Send size={16} className="text-green-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-card-foreground">📊 Relatório Diário com IA</p>
              <p className="text-[10px] text-muted-foreground">Métricas + progresso + dicas IA para cada membro às 18h</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-green-500/15 text-green-600">⏰ 18:00</span>
            <span className="px-2 py-0.5 text-[9px] rounded-full bg-green-500/15 text-green-600">Equipe</span>
            <span className="px-2 py-0.5 text-[9px] rounded-full bg-green-500/15 text-green-600">Ativa</span>
          </div>
        </div>
        <div className="flex items-center gap-2 pt-2 border-t border-border">
          <button onClick={handleTriggerDailyReport} disabled={triggeringReport}
            className="px-4 py-2 text-[10px] rounded-lg font-medium bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors">
            {triggeringReport ? <Loader2 size={10} className="animate-spin" /> : <Play size={10} />}
            {triggeringReport ? "Enviando..." : "Disparar Agora"}
          </button>
          <p className="text-[9px] text-muted-foreground">Sistema embutido</p>
        </div>
        {lastResult && (
          <div className="rounded-lg border border-border bg-secondary/50 p-3 space-y-1">
            <p className="text-[10px] font-semibold text-card-foreground">Resultado:</p>
            {lastResult.error ? <p className="text-[10px] text-destructive">❌ {lastResult.error}</p> : (
              <div className="space-y-1">
                {lastResult.results?.map((r: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-[10px]">
                    <span>{r.success ? "✅" : "❌"}</span>
                    <span className="text-card-foreground font-medium">{r.member}</span>
                    <span className="text-muted-foreground">→ {r.phone}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Custom Automations */}
      {loadingAutomations ? (
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
      ) : automations.length > 0 ? (
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Automações Customizadas</p>
          {automations.map(a => {
            const isEditing = editingId === a.id;
            const isExpanded = expandedId === a.id;
            return (
              <div key={a.id} className={`rounded-lg border transition-all ${a.active ? "border-border bg-secondary/20" : "border-border/50 bg-secondary/5 opacity-70"}`}>
                <div className="p-4 cursor-pointer" onClick={() => !isEditing && setExpandedId(isExpanded ? null : a.id)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${a.active ? "bg-primary/10" : "bg-muted"}`}>
                        <Zap size={16} className={a.active ? "text-primary" : "text-muted-foreground"} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-card-foreground">{a.name}</p>
                        <p className="text-[10px] text-muted-foreground">{a.description || "Sem descrição"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 text-[9px] font-semibold rounded-full bg-accent/50 text-accent-foreground">
                        <Clock size={8} className="inline mr-0.5" /> {cronToLabel(a.schedule_cron)}
                      </span>
                      <span className="px-2 py-0.5 text-[9px] rounded-full bg-accent/50 text-accent-foreground">
                        <Target size={8} className="inline mr-0.5" /> {audienceLabel(a.target_audience)}
                      </span>
                      {a.include_metrics && <span className="text-[9px]" title="Métricas">📊</span>}
                      {a.include_ai_tips && <span className="text-[9px]" title="Dicas IA">💡</span>}
                      <ChevronDown size={12} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-border pt-3 animate-in fade-in duration-200">
                    {isEditing && editForm ? (
                      <>
                        {renderForm(editForm, setEditForm)}
                        <div className="flex justify-end gap-2 pt-2 border-t border-border">
                          <button onClick={handleCancelEdit} className="px-3 py-1.5 text-[10px] rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80">Cancelar</button>
                          <button onClick={handleSaveEdit} disabled={savingEdit}
                            className="px-4 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
                            {savingEdit ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />} Salvar
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="text-[9px] font-semibold text-muted-foreground uppercase">Template da Mensagem</label>
                          <pre className="mt-1 p-3 rounded-lg bg-secondary text-[10px] text-secondary-foreground whitespace-pre-wrap font-mono border border-border">{a.message_template}</pre>
                        </div>
                        <div className="grid grid-cols-4 gap-3">
                          <div><label className="text-[9px] font-semibold text-muted-foreground uppercase">Agendamento</label><p className="text-[10px] text-card-foreground mt-0.5">{cronToLabel(a.schedule_cron)}</p></div>
                          <div><label className="text-[9px] font-semibold text-muted-foreground uppercase">Público</label><p className="text-[10px] text-card-foreground mt-0.5">{audienceLabel(a.target_audience)}</p></div>
                          <div><label className="text-[9px] font-semibold text-muted-foreground uppercase">Métricas</label><p className="text-[10px] mt-0.5">{a.include_metrics ? "✅ Sim" : "❌ Não"}</p></div>
                          <div><label className="text-[9px] font-semibold text-muted-foreground uppercase">Dicas IA</label><p className="text-[10px] mt-0.5">{a.include_ai_tips ? "✅ Sim" : "❌ Não"}</p></div>
                        </div>
                        <p className="text-[9px] text-muted-foreground">Criada em {new Date(a.created_at).toLocaleDateString("pt-BR")} · Atualizada: {new Date(a.updated_at).toLocaleDateString("pt-BR")}</p>
                        <div className="flex items-center gap-2 pt-2 border-t border-border">
                          <button onClick={() => handleToggle(a.id, a.active)}
                            className={`px-3 py-1.5 text-[10px] rounded-lg font-medium flex items-center gap-1.5 ${a.active ? "bg-green-500/10 text-green-600 hover:bg-green-500/20" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"}`}>
                            {a.active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />} {a.active ? "Ativa" : "Inativa"}
                          </button>
                          <button onClick={() => handleStartEdit(a)}
                            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary/10 text-primary hover:bg-primary/20 flex items-center gap-1.5">
                            <Save size={10} /> Editar
                          </button>
                          <button onClick={() => handleDelete(a.id)}
                            className="px-3 py-1.5 text-[10px] rounded-lg font-medium text-destructive hover:bg-destructive/10 flex items-center gap-1.5">
                            <Trash2 size={10} /> Excluir
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-6 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Zap size={20} className="mx-auto text-muted-foreground" />
            <p className="text-xs text-muted-foreground">Nenhuma automação customizada</p>
            <p className="text-[10px] text-muted-foreground">Clique em "Criar com IA" para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}
