import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers, useMonths, useMonthlyGoals, useDailyMetrics } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, METRIC_KEYS, DbTeamMember, getMemberAvatar, memberHasRole, getMemberRoles, isDualRole } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, Plus, Edit2, Trash2, UserCheck, UserX, Loader2,
  Sparkles, Upload, FileText, ChevronDown, X, Brain, TrendingUp, Medal,
  Camera, Copy, Check, Shield, Zap, Phone, Mail, Key, Image as ImageIcon,
  MessageCircle, ClipboardList, FileSpreadsheet
} from "lucide-react";
import { AdminMetricsEditor } from "@/components/admin/AdminMetricsEditor";
import { ClipboardEdit } from "lucide-react";

// ─── Registration Form Dialog ────────────────────────────────────────────
function MemberFormDialog({
  member,
  onClose,
  onSaved,
}: {
  member?: DbTeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member?.name || "");
  const [email, setEmail] = useState(member?.email || "");
  const [phone, setPhone] = useState(member?.phone || "");
  const [password, setPassword] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(() => {
    if (member?.member_role) {
      return new Set(member.member_role.split(",").map(r => r.trim()).filter(Boolean));
    }
    return new Set(["sdr"]);
  });
  const [saving, setSaving] = useState(false);
  const [welcomeMsg, setWelcomeMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [whatsappSent, setWhatsappSent] = useState(false);
  const [sendingWhatsapp, setSendingWhatsapp] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

  const isEditing = !!member;

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let pwd = "";
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setPassword(pwd);
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);

    if (isEditing) {
      const newRole = Array.from(selectedRoles).join(",");
      const { error } = await supabase.from("team_members").update({ name: name.trim(), member_role: newRole }).eq("id", member.id);
      if (error) toast.error(error.message); else { toast.success("Membro atualizado!"); onSaved(); onClose(); }
      setSaving(false);
      return;
    }

    // New member
    if (!email.trim()) { toast.error("Email é obrigatório"); setSaving(false); return; }
    if (!password || password.length < 6) { toast.error("Senha deve ter no mínimo 6 caracteres"); setSaving(false); return; }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-sdr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password, member_role: Array.from(selectedRoles).join(",") }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erro ao criar membro");

      // Upload avatar if selected
      if (avatarFile && result.team_member_id) {
        const ext = avatarFile.name.split('.').pop();
        const filePath = `${result.team_member_id}/avatar.${ext}`;
        await supabase.storage.from("member-avatars").upload(filePath, avatarFile, { upsert: true });
        const { data: urlData } = supabase.storage.from("member-avatars").getPublicUrl(filePath);
        const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
        await supabase.from("team_members").update({ avatar_url: avatarUrl }).eq("id", result.team_member_id);
      }

      // Save WhatsApp contact if phone provided
      if (phone.trim() && result.team_member_id) {
        await supabase.from("whatsapp_contacts").insert({
          phone: phone.trim().replace(/\D/g, ""),
          team_member_id: result.team_member_id,
        });
      }

      toast.success("Membro cadastrado com sucesso!");
      onSaved();

      const appUrl = window.location.origin;
      const roleName = selectedRoles.has("sdr") && selectedRoles.has("closer") ? "SDR + Closer" : selectedRoles.has("closer") ? "Closer" : "SDR";
      const msg =
`🎉 *Bem-vindo(a) ao time, ${name.trim()}!*

Você foi cadastrado(a) como *${roleName}* no nosso sistema de gestão.

🔗 *Acesse aqui:* ${appUrl}/login
📧 *Email:* ${email.trim()}
🔑 *Senha:* ${password}

Faça login e comece a registrar suas métricas. Bora pra cima! 🚀`;
      setWelcomeMsg(msg);

      // Auto-send via WhatsApp if phone provided
      if (phone.trim()) {
        setSendingWhatsapp(true);
        try {
          const { data: { session: s } } = await supabase.auth.getSession();
          const whatsResp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-whatsapp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${s?.access_token}` },
            body: JSON.stringify({ phone: phone.trim().replace(/\D/g, ""), message: msg }),
          });
          if (whatsResp.ok) {
            setWhatsappSent(true);
            toast.success("✅ Mensagem enviada no WhatsApp!");
          } else {
            toast.error("Não foi possível enviar no WhatsApp automaticamente");
          }
        } catch {
          toast.error("Erro ao enviar WhatsApp automático");
        } finally {
          setSendingWhatsapp(false);
        }
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = () => {
    if (welcomeMsg) {
      navigator.clipboard.writeText(welcomeMsg);
      setCopied(true);
      toast.success("Mensagem copiada!");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleWhatsApp = () => {
    if (welcomeMsg) {
      window.open(`https://wa.me/?text=${encodeURIComponent(welcomeMsg)}`, "_blank");
    }
  };

  // ── Welcome message screen ──
  if (welcomeMsg) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
        <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-lg shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center">
              <Check size={16} className="text-accent" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-card-foreground">Membro Cadastrado!</h3>
              <p className="text-[10px] text-muted-foreground">
                {whatsappSent
                  ? "✅ Mensagem enviada automaticamente no WhatsApp!"
                  : sendingWhatsapp
                    ? "⏳ Enviando mensagem no WhatsApp..."
                    : phone.trim()
                      ? "Enviando credenciais via WhatsApp..."
                      : "Copie e envie as credenciais abaixo"}
              </p>
            </div>
          </div>

          {/* WhatsApp auto-send status */}
          {whatsappSent && (
            <div className="rounded-xl bg-accent/10 border border-accent/30 p-3 mb-3 flex items-center gap-2">
              <MessageCircle size={14} className="text-accent shrink-0" />
              <span className="text-[10px] text-accent font-medium">
                Mensagem de boas-vindas enviada para {phone.trim()} via WhatsApp automaticamente!
              </span>
            </div>
          )}

          <div className="rounded-xl bg-secondary/50 border border-border p-4 max-h-56 overflow-y-auto">
            <pre className="text-xs text-secondary-foreground whitespace-pre-wrap font-sans leading-relaxed">{welcomeMsg}</pre>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 mt-4">
            <button onClick={handleWhatsApp} className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center justify-center gap-2">
              <MessageCircle size={14} />
              {whatsappSent ? "Enviar Novamente" : "Abrir WhatsApp"}
            </button>
            <button onClick={handleCopy} className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors flex items-center justify-center gap-2">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copiado!" : "Copiar Mensagem"}
            </button>
          </div>
          <button onClick={onClose} className="w-full mt-2 px-4 py-2 text-[10px] text-muted-foreground hover:text-foreground transition-colors text-center">
            Fechar
          </button>
        </div>
      </div>
    );
  }

  // ── Registration form ──
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-bold text-card-foreground">
            {isEditing ? "Editar Membro" : "Novo Membro da Equipe"}
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4">
          {/* Avatar upload */}
          {!isEditing && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                className="relative w-20 h-20 rounded-full border-2 border-dashed border-border hover:border-primary transition-colors group overflow-hidden"
              >
                {avatarPreview ? (
                  <img src={avatarPreview} alt="Preview" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-muted-foreground group-hover:text-primary transition-colors">
                    <Camera size={20} />
                    <span className="text-[8px] mt-0.5 font-medium">FOTO</span>
                  </div>
                )}
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
              </button>
            </div>
          )}

          {/* Role selection - available for both new and editing */}
          <div>
              <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1.5">Função(ões)</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => {
                  const next = new Set(selectedRoles);
                  if (next.has("sdr")) { if (next.size > 1) next.delete("sdr"); }
                  else next.add("sdr");
                  setSelectedRoles(next);
                }}
                  className={`px-3 py-3 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                    selectedRoles.has("sdr")
                      ? "bg-primary/10 border-primary text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                      : "bg-secondary border-border text-muted-foreground hover:border-muted-foreground/50"
                  }`}>
                  <Zap size={16} />
                  <span>SDR</span>
                  <span className="text-[8px] font-normal opacity-70">Prospecção</span>
                  {selectedRoles.has("sdr") && <Check size={12} className="absolute top-1.5 right-1.5 text-primary" />}
                </button>
                <button type="button" onClick={() => {
                  const next = new Set(selectedRoles);
                  if (next.has("closer")) { if (next.size > 1) next.delete("closer"); }
                  else next.add("closer");
                  setSelectedRoles(next);
                }}
                  className={`px-3 py-3 text-xs font-bold rounded-xl border-2 transition-all flex flex-col items-center gap-1 relative ${
                    selectedRoles.has("closer")
                      ? "bg-[hsl(280,65%,60%)]/10 border-[hsl(280,65%,60%)] text-[hsl(280,65%,65%)] shadow-[0_0_0_1px_hsl(280,65%,60%,0.3)]"
                      : "bg-secondary border-border text-muted-foreground hover:border-muted-foreground/50"
                  }`}>
                  <Shield size={16} />
                  <span>Closer</span>
                  <span className="text-[8px] font-normal opacity-70">Fechamento</span>
                  {selectedRoles.has("closer") && <Check size={12} className="absolute top-1.5 right-1.5 text-[hsl(280,65%,65%)]" />}
                </button>
              </div>
              {selectedRoles.size === 2 && (
                <p className="text-[9px] text-accent mt-1.5 font-semibold text-center">
                  ⚡ Função dupla — verá métricas de SDR e Closer
                </p>
              )}
            </div>

          {/* Name */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
              <Users size={10} /> Nome completo
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: João Silva"
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
              autoFocus
            />
          </div>

          {!isEditing && (
            <>
              {/* Email */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Mail size={10} /> Email de acesso
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="email@exemplo.com"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                />
              </div>

              {/* Password */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Key size={10} /> Senha
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="flex-1 rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none font-mono transition-all"
                  />
                  <button
                    type="button"
                    onClick={generatePassword}
                    className="px-3 py-2 text-[10px] rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/30 font-semibold whitespace-nowrap"
                  >
                    Gerar Senha
                  </button>
                </div>
              </div>

              {/* Phone (WhatsApp) */}
              <div>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                  <Phone size={10} /> WhatsApp <span className="text-[8px] font-normal opacity-60">(opcional — envia credenciais automático)</span>
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 focus:border-primary outline-none transition-all"
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 mt-6">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {isEditing ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── AI Performance Analysis ─────────────────────────────────────────────
function AiCloserAnalysis({ member, monthId, monthLabel }: { member: DbTeamMember; monthId?: string; monthLabel?: string }) {
  const { data: dailyMetrics } = useDailyMetrics(monthId);
  const { data: goals } = useMonthlyGoals(monthId, member.id);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");

  const memberMetrics = dailyMetrics ? sumMetrics(dailyMetrics, member.id) : {};

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysis("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-closer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "performance", member_name: member.name, metrics: memberMetrics, goals: goals ? { ...goals } : null, month_label: monthLabel || "atual" }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({ error: "Erro" })); toast.error(err.error); setAnalyzing(false); return; }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "", fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nlIdx); buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { fullContent += c; setAnalysis(fullContent); } } catch {}
        }
      }
    } catch { toast.error("Erro ao gerar análise"); } finally { setAnalyzing(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Performance IA</span>
        </div>
        <button onClick={runAnalysis} disabled={analyzing}
          className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center gap-1.5">
          {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {analyzing ? "Analisando..." : "Gerar Análise"}
        </button>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {["follow_up", "conexoes", "reuniao_realizada", "lig_realizada", "abordagens"].map(k => (
          <div key={k} className="rounded-lg bg-secondary/50 p-2 text-center">
            <span className="text-[8px] text-muted-foreground uppercase tracking-wider block">{METRIC_LABELS[k]}</span>
            <span className="text-sm font-bold tabular-nums text-card-foreground">{memberMetrics[k] || 0}</span>
          </div>
        ))}
      </div>
      {(analysis || analyzing) && (
        <div className="rounded-lg bg-secondary/50 p-4 max-h-80 overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
            {analysis || "Analisando métricas..."}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Behavioral PDF Analysis ─────────────────────────────────────────────
function BehavioralAnalysis({ member, monthId }: { member: DbTeamMember; monthId?: string }) {
  const { data: dailyMetrics } = useDailyMetrics(monthId);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [existingAnalyses, setExistingAnalyses] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const memberMetrics = dailyMetrics ? sumMetrics(dailyMetrics, member.id) : {};

  useEffect(() => {
    supabase.from("closer_analyses").select("*").eq("member_id", member.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setExistingAnalyses(data); });
  }, [member.id]);

  const extractTextFromPdf = async (file: File): Promise<string> => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    let text = "", current = "";
    for (let i = 0; i < uint8Array.length; i++) {
      const char = uint8Array[i];
      if (char >= 32 && char <= 126) current += String.fromCharCode(char);
      else { if (current.length > 3) text += current + " "; current = ""; }
    }
    if (current.length > 3) text += current;
    return text.replace(/\s+/g, " ").trim().slice(0, 15000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Apenas PDFs"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
    setUploading(true);
    const filePath = `${member.id}/${Date.now()}_${file.name}`;
    const { error: uploadError } = await supabase.storage.from("closer-documents").upload(filePath, file);
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return; }
    toast.success("PDF enviado!");
    setUploading(false);
    const text = await extractTextFromPdf(file);
    // Run behavioral analysis
    setAnalyzing(true); setAnalysis("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-closer`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ type: "behavioral", member_name: member.name, metrics: memberMetrics, behavioral_text: text }),
      });
      if (!resp.ok) { toast.error("Erro na análise"); setAnalyzing(false); return; }
      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "", fullContent = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nlIdx); buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { fullContent += c; setAnalysis(fullContent); } } catch {}
        }
      }
      if (fullContent) {
        const { error } = await supabase.from("closer_analyses").insert({ member_id: member.id, file_path: filePath, file_name: file.name, ai_analysis: fullContent, analysis_type: "behavioral" });
        if (!error) { setExistingAnalyses(prev => [{ file_name: file.name, ai_analysis: fullContent, created_at: new Date().toISOString() }, ...prev]); toast.success("Análise salva!"); }
      }
    } catch { toast.error("Erro na análise comportamental"); } finally { setAnalyzing(false); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain size={14} className="text-[hsl(var(--chart-3))]" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Análise Comportamental</span>
        </div>
        <div className="flex gap-2">
          {existingAnalyses.length > 0 && (
            <button onClick={() => setShowHistory(!showHistory)} className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80">
              {showHistory ? "Ocultar" : `Histórico (${existingAnalyses.length})`}
            </button>
          )}
          <label className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-[hsl(var(--chart-3))] text-foreground hover:opacity-90 cursor-pointer flex items-center gap-1.5">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "Enviando..." : "Upload PDF"}
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground">Upload de PDFs DISC ou perfil comportamental para análise IA.</p>
      {(analysis || analyzing) && (
        <div className="rounded-lg bg-secondary/50 p-4 max-h-80 overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">{analysis || "Analisando..."}</div>
        </div>
      )}
      {showHistory && existingAnalyses.map((a, i) => (
        <div key={i} className="rounded-lg bg-secondary/30 p-4 max-h-52 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2"><FileText size={10} className="text-muted-foreground" /><span className="text-[10px] text-muted-foreground">{a.file_name}</span></div>
            <span className="text-[10px] text-muted-foreground">{new Date(a.created_at).toLocaleDateString("pt-BR")}</span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">{a.ai_analysis}</div>
        </div>
      ))}
    </div>
  );
}

function TeamMemberMetricsButton({ memberId, memberName, memberRole }: { memberId: string; memberName: string; memberRole: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 text-xs font-bold text-primary hover:bg-primary/5 transition-colors rounded-lg"
      >
        <ClipboardEdit size={14} />
        Ver e Editar Métricas
      </button>
      <AdminMetricsEditor
        open={open}
        onOpenChange={setOpen}
        teamMemberId={memberId}
        memberName={memberName}
        memberRole={memberRole}
      />
    </>
  );
}


// ─── Member Card ─────────────────────────────────────────────────────────
function MemberCard({
  member,
  members,
  isExpanded,
  onToggle,
  onEdit,
  onToggleActive,
  onDelete,
  months,
}: {
  member: DbTeamMember;
  members: DbTeamMember[];
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  months?: { id: string; label: string }[];
}) {
  const queryClient = useQueryClient();
  const isCloser = memberHasRole(member, "closer");
  const isSdr = memberHasRole(member, "sdr");
  const hasDualRole = isCloser && isSdr;
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>(months?.[0]?.id);
  const activeMonthId = selectedMonthId || months?.[0]?.id;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  return (
    <div className={`rounded-xl border overflow-hidden transition-all ${
      hasDualRole ? "border-accent/30 bg-card" : isCloser ? "border-[hsl(280,65%,60%)]/30 bg-card" : "border-primary/30 bg-card"
    }`}>
      <div className="flex items-center justify-between p-3 sm:p-4 cursor-pointer hover:bg-secondary/20 transition-colors" onClick={onToggle}>
        <div className="flex items-center gap-3">
          {/* Avatar with upload */}
          <div className="relative group">
            <img src={getMemberAvatar(member, members.indexOf(member))} alt={member.name}
              className={`w-10 h-10 rounded-full object-cover border-2 ${hasDualRole ? "border-accent/50" : isCloser ? "border-[hsl(280,65%,60%)]/50" : "border-primary/50"}`} />
            <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={e => e.stopPropagation()}>
              <Camera size={14} className="text-white" />
              <input type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
                  const ext = file.name.split('.').pop();
                  const filePath = `${member.id}/avatar.${ext}`;
                  await supabase.storage.from("member-avatars").upload(filePath, file, { upsert: true });
                  const { data: urlData } = supabase.storage.from("member-avatars").getPublicUrl(filePath);
                  await supabase.from("team_members").update({ avatar_url: urlData.publicUrl + "?t=" + Date.now() }).eq("id", member.id);
                  toast.success("Foto atualizada!");
                  queryClient.invalidateQueries({ queryKey: ["team-members"] });
                }} />
            </label>
            {/* Status dot */}
            <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${member.active ? "bg-accent" : "bg-muted-foreground/50"}`} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-card-foreground">{member.name}</h4>
              {hasDualRole ? (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-accent/15 text-accent">
                  SDR + CLOSER
                </span>
              ) : (
                <span className={`text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md ${
                  isCloser ? "bg-[hsl(280,65%,60%)]/15 text-[hsl(280,65%,65%)]" : "bg-primary/15 text-primary"
                }`}>
                  {isCloser ? "CLOSER" : "SDR"}
                </span>
              )}
            </div>
            <span className={`text-[10px] font-medium ${member.active ? "text-accent" : "text-muted-foreground"}`}>
              {member.active ? "● Ativo" : "○ Inativo"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Editar">
            <Edit2 size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onToggleActive(); }}
            className={`p-2 rounded-lg transition-colors ${member.active ? "text-accent hover:bg-accent/10" : "text-muted-foreground hover:bg-secondary"}`} title={member.active ? "Desativar" : "Ativar"}>
            {member.active ? <UserCheck size={14} /> : <UserX size={14} />}
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" title="Excluir">
            <Trash2 size={14} />
          </button>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border p-4 sm:p-5 space-y-6 bg-secondary/5">
          {/* Month selector inside expanded */}
          {months && months.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Período:</span>
              <div className="relative">
                <select value={activeMonthId || ""} onChange={e => setSelectedMonthId(e.target.value)}
                  className="appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-2.5 py-1.5 pr-6 rounded-lg border border-border cursor-pointer focus:ring-1 focus:ring-primary outline-none">
                  {months.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
                <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}



          <AiCloserAnalysis member={member} monthId={activeMonthId} monthLabel={activeMonth?.label} />
          <div className="h-px bg-border" />
          <TeamMemberMetricsButton memberId={member.id} memberName={member.name} memberRole={member.member_role || "sdr"} />
        </div>
      )}
    </div>
  );
}

// ─── Admin Role Card ─────────────────────────────────────────────────────
interface AdminUser {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  team_member_id: string | null;
  roles: string[];
}

function AdminRoleCard({ admin, onRolesChanged }: { admin: AdminUser; onRolesChanged: () => void }) {
  const [saving, setSaving] = useState(false);
  const avatarRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const hasSdr = admin.roles.includes("sdr");
  const hasCloser = admin.roles.includes("closer");

  const toggleRole = async (role: "sdr" | "closer") => {
    setSaving(true);
    try {
      const has = admin.roles.includes(role);
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-admin-roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          admin_user_id: admin.user_id,
          ...(has ? { remove_roles: [role] } : { add_roles: [role] }),
        }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Erro");
      toast.success(has ? `Função ${role.toUpperCase()} removida` : `Função ${role.toUpperCase()} adicionada`);
      onRolesChanged();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border border-[hsl(38,92%,50%)]/30 bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative group">
            <img
              src={admin.avatar_url || "/placeholder.svg"}
              alt={admin.full_name}
              className="w-10 h-10 rounded-full object-cover border-2 border-[hsl(38,92%,50%)]/50"
            />
            <label className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              onClick={e => e.stopPropagation()}>
              <Camera size={14} className="text-white" />
              <input ref={avatarRef} type="file" accept="image/*" className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
                  const ext = file.name.split('.').pop();
                  const filePath = `admin-${admin.user_id}/avatar.${ext}`;
                  await supabase.storage.from("member-avatars").upload(filePath, file, { upsert: true });
                  const { data: urlData } = supabase.storage.from("member-avatars").getPublicUrl(filePath);
                  const newUrl = urlData.publicUrl + "?t=" + Date.now();
                  await supabase.from("profiles").update({ avatar_url: newUrl }).eq("id", admin.user_id);
                  if (admin.team_member_id) {
                    await supabase.from("team_members").update({ avatar_url: newUrl }).eq("id", admin.team_member_id);
                  }
                  toast.success("Foto atualizada!");
                  onRolesChanged();
                  queryClient.invalidateQueries({ queryKey: ["team-members"] });
                }} />
            </label>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-card-foreground">{admin.full_name || "Admin"}</h4>
              <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[hsl(38,92%,50%)]/15 text-[hsl(38,92%,50%)]">
                ADMIN
              </span>
              {hasSdr && (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/15 text-primary">SDR</span>
              )}
              {hasCloser && (
                <span className="text-[8px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-[hsl(280,65%,60%)]/15 text-[hsl(280,65%,65%)]">CLOSER</span>
              )}
            </div>
            <span className="text-[10px] text-muted-foreground">Gestor{(hasSdr || hasCloser) ? " + " + [hasSdr && "SDR", hasCloser && "Closer"].filter(Boolean).join(" + ") : ""}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => toggleRole("sdr")}
            disabled={saving}
            className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold transition-all flex items-center gap-1 ${
              hasSdr
                ? "bg-primary text-primary-foreground hover:bg-primary/80"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"
            }`}
          >
            <Zap size={10} />
            {hasSdr ? "SDR ✓" : "+ SDR"}
          </button>
          <button
            onClick={() => toggleRole("closer")}
            disabled={saving}
            className={`px-3 py-1.5 text-[10px] rounded-lg font-semibold transition-all flex items-center gap-1 ${
              hasCloser
                ? "bg-[hsl(280,65%,60%)] text-white hover:bg-[hsl(280,65%,55%)]"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80 border border-border"
            }`}
          >
            <Shield size={10} />
            {hasCloser ? "Closer ✓" : "+ Closer"}
          </button>
          {saving && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
        </div>
      </div>
    </div>
  );
}

// ─── Main Team Management Page ───────────────────────────────────────────
export default function TeamManagement() {
  const { data: members, isLoading } = useTeamMembers();
  const { data: months } = useMonths();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<DbTeamMember | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(true);

  const fetchAdmins = async () => {
    setLoadingAdmins(true);
    try {
      // Get all admin user_ids
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      if (!adminRoles?.length) { setAdminUsers([]); setLoadingAdmins(false); return; }

      const adminIds = adminRoles.map(r => r.user_id);
      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url, team_member_id").in("id", adminIds);
      // Get all roles for these users
      const { data: allRoles } = await supabase.from("user_roles").select("user_id, role").in("user_id", adminIds);

      const admins: AdminUser[] = (profiles || []).map(p => ({
        user_id: p.id,
        full_name: p.full_name,
        avatar_url: p.avatar_url,
        team_member_id: p.team_member_id,
        roles: (allRoles || []).filter(r => r.user_id === p.id).map(r => r.role),
      }));
      setAdminUsers(admins);
    } catch {
      console.error("Error fetching admins");
    } finally {
      setLoadingAdmins(false);
    }
  };

  useEffect(() => { fetchAdmins(); }, []);

  const sdrs = members?.filter(m => memberHasRole(m, "sdr") && !memberHasRole(m, "closer")) || [];
  const closers = members?.filter(m => memberHasRole(m, "closer") && !memberHasRole(m, "sdr")) || [];
  const dualRole = members?.filter(m => memberHasRole(m, "sdr") && memberHasRole(m, "closer")) || [];

  const handleToggleActive = async (member: DbTeamMember) => {
    const { error } = await supabase.from("team_members").update({ active: !member.active }).eq("id", member.id);
    if (error) toast.error(error.message);
    else { toast.success(member.active ? "Desativado" : "Ativado"); queryClient.invalidateQueries({ queryKey: ["team-members"] }); }
  };

  const handleDelete = async (member: DbTeamMember) => {
    if (!confirm(`Excluir ${member.name}? Esta ação não pode ser desfeita.`)) return;
    // Also try to delete the auth user via edge function
    try {
      const { data: profile } = await supabase.from("profiles").select("id").eq("team_member_id", member.id).single();
      if (profile) {
        const { data: { session } } = await supabase.auth.getSession();
        await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({ user_id: profile.id }),
        });
      }
    } catch {}
    // Update profile to unlink, then delete team member
    await supabase.from("profiles").update({ team_member_id: null }).eq("team_member_id", member.id);
    const { error } = await supabase.from("team_members").delete().eq("id", member.id);
    if (error) toast.error(error.message);
    else { toast.success("Membro excluído"); queryClient.invalidateQueries({ queryKey: ["team-members"] }); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Users size={20} className="text-primary" />
            Gestão de Equipe
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            <span className="text-primary font-semibold">{sdrs.length}</span> SDRs · <span className="text-[hsl(280,65%,65%)] font-semibold">{closers.length}</span> Closers · {dualRole.length > 0 && <><span className="text-accent font-semibold">{dualRole.length}</span> Dupla Função · </>}<span className="text-accent font-semibold">{members?.filter(m => m.active).length || 0}</span> Ativos
          </p>
        </div>
        <button onClick={() => { setEditingMember(null); setShowForm(true); }}
          className="px-4 py-2 text-xs rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Plus size={14} /> Novo Membro
        </button>
      </div>

      {/* Admin Section */}
      {adminUsers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Medal size={14} className="text-[hsl(38,92%,50%)]" />
            <h3 className="text-xs font-bold text-[hsl(38,92%,50%)] uppercase tracking-wider">Admins — Gestores</h3>
            <div className="flex-1 h-px bg-[hsl(38,92%,50%)]/20" />
            <span className="text-[10px] text-muted-foreground font-medium">{adminUsers.length} admins</span>
          </div>
          <p className="text-[10px] text-muted-foreground -mt-1">Adicione funções de SDR ou Closer aos admins para que também registrem métricas.</p>
          <div className="space-y-2">
            {adminUsers.map(admin => (
              <AdminRoleCard key={admin.user_id} admin={admin} onRolesChanged={() => {
                fetchAdmins();
                queryClient.invalidateQueries({ queryKey: ["team-members"] });
              }} />
            ))}
          </div>
        </div>
      )}

      {/* SDR Section */}
      {sdrs.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <h3 className="text-xs font-bold text-primary uppercase tracking-wider">SDRs — Prospecção</h3>
            <div className="flex-1 h-px bg-primary/20" />
            <span className="text-[10px] text-muted-foreground font-medium">{sdrs.length} membros</span>
          </div>
          <div className="space-y-2">
            {sdrs.map(member => (
              <MemberCard key={member.id} member={member} members={members || []}
                isExpanded={expandedMember === member.id}
                onToggle={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                onEdit={() => { setEditingMember(member); setShowForm(true); }}
                onToggleActive={() => handleToggleActive(member)}
                onDelete={() => handleDelete(member)}
                months={months} />
            ))}
          </div>
        </div>
      )}

      {/* Closer Section */}
      {closers.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Shield size={14} className="text-[hsl(280,65%,65%)]" />
            <h3 className="text-xs font-bold text-[hsl(280,65%,65%)] uppercase tracking-wider">Closers — Fechamento</h3>
            <div className="flex-1 h-px bg-[hsl(280,65%,60%)]/20" />
            <span className="text-[10px] text-muted-foreground font-medium">{closers.length} membros</span>
          </div>
          <div className="space-y-2">
            {closers.map(member => (
              <MemberCard key={member.id} member={member} members={members || []}
                isExpanded={expandedMember === member.id}
                onToggle={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                onEdit={() => { setEditingMember(member); setShowForm(true); }}
                onToggleActive={() => handleToggleActive(member)}
                onDelete={() => handleDelete(member)}
                months={months} />
            ))}
          </div>
        </div>
      )}

      {/* Dual Role Section */}
      {dualRole.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-accent" />
            <h3 className="text-xs font-bold text-accent uppercase tracking-wider">Dupla Função — SDR + Closer</h3>
            <div className="flex-1 h-px bg-accent/20" />
            <span className="text-[10px] text-muted-foreground font-medium">{dualRole.length} membros</span>
          </div>
          <div className="space-y-2">
            {dualRole.map(member => (
              <MemberCard key={member.id} member={member} members={members || []}
                isExpanded={expandedMember === member.id}
                onToggle={() => setExpandedMember(expandedMember === member.id ? null : member.id)}
                onEdit={() => { setEditingMember(member); setShowForm(true); }}
                onToggleActive={() => handleToggleActive(member)}
                onDelete={() => handleDelete(member)}
                months={months} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!members || members.length === 0) && (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <Users size={28} className="text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">Nenhum membro cadastrado</h3>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto">
            Cadastre SDRs e Closers para começar a acompanhar as métricas da equipe.
          </p>
          <button onClick={() => { setEditingMember(null); setShowForm(true); }}
            className="px-6 py-2.5 text-xs rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors inline-flex items-center gap-1.5">
            <Plus size={14} /> Cadastrar Primeiro Membro
          </button>
        </div>
      )}

      {/* Form Dialog */}
      {showForm && (
        <MemberFormDialog
          member={editingMember}
          onClose={() => setShowForm(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["team-members"] })}
        />
      )}
    </div>
  );
}
