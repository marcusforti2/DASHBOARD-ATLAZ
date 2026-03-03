import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useTeamMembers, useMonths, useMonthlyGoals, useDailyMetrics } from "@/hooks/use-metrics";
import { sumMetrics, METRIC_LABELS, METRIC_KEYS, DbTeamMember, getMemberAvatar } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users, Plus, Edit2, Trash2, UserCheck, UserX, Loader2,
  Sparkles, Upload, FileText, ChevronDown, X, Brain, TrendingUp, Medal, Camera
} from "lucide-react";

// --- Add/Edit Closer Dialog ---
function CloserFormDialog({
  member,
  onClose,
  onSaved,
}: {
  member?: DbTeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member?.name || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) { toast.error("Nome é obrigatório"); return; }
    setSaving(true);
    if (member) {
      const { error } = await supabase.from("team_members").update({ name: name.trim() }).eq("id", member.id);
      if (error) toast.error(error.message); else { toast.success("SDR atualizado!"); onSaved(); }
    } else {
      const { error } = await supabase.from("team_members").insert({ name: name.trim() });
      if (error) toast.error(error.message); else { toast.success("SDR cadastrado!"); onSaved(); }
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-card-foreground mb-4 uppercase tracking-wider">
          {member ? "Editar SDR" : "Novo SDR"}
        </h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Nome do SDR"
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
              autoFocus
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {member ? "Salvar" : "Cadastrar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- AI Analysis Panel ---
function AiCloserAnalysis({ member, monthId, monthLabel }: { member: DbTeamMember; monthId?: string; monthLabel?: string }) {
  const { data: dailyMetrics } = useDailyMetrics(monthId);
  const { data: goals } = useMonthlyGoals(monthId);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");

  const memberMetrics = dailyMetrics ? sumMetrics(dailyMetrics, member.id) : {};

  const runAnalysis = async () => {
    setAnalyzing(true);
    setAnalysis("");

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-closer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: "performance",
          member_name: member.name,
          metrics: memberMetrics,
          goals: goals ? { ...goals } : null,
          month_label: monthLabel || "atual",
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao gerar análise");
        setAnalyzing(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullContent += content; setAnalysis(fullContent); }
          } catch {}
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar análise de IA");
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={14} className="text-primary" />
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Análise de Performance IA</span>
        </div>
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {analyzing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {analyzing ? "Analisando..." : "Gerar Análise"}
        </button>
      </div>

      {/* Quick metrics summary */}
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

// --- PDF Upload & Behavioral Analysis ---
function BehavioralAnalysis({ member, monthId }: { member: DbTeamMember; monthId?: string }) {
  const { data: dailyMetrics } = useDailyMetrics(monthId);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState("");
  const [existingAnalyses, setExistingAnalyses] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const memberMetrics = dailyMetrics ? sumMetrics(dailyMetrics, member.id) : {};

  useEffect(() => {
    supabase
      .from("closer_analyses")
      .select("*")
      .eq("member_id", member.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setExistingAnalyses(data); });
  }, [member.id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") { toast.error("Apenas arquivos PDF são aceitos"); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Arquivo deve ter no máximo 20MB"); return; }

    setUploading(true);
    const filePath = `${member.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("closer-documents")
      .upload(filePath, file);

    if (uploadError) {
      toast.error("Erro ao fazer upload: " + uploadError.message);
      setUploading(false);
      return;
    }

    toast.success("PDF enviado! Iniciando análise comportamental...");
    setUploading(false);

    // Read PDF text (simplified - send file name for context, AI will use the text we extract)
    const reader = new FileReader();
    reader.onload = async () => {
      const text = await extractTextFromPdf(file);
      await runBehavioralAnalysis(text, filePath, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  // Simple text extraction from PDF
  const extractTextFromPdf = async (file: File): Promise<string> => {
    // Read as text - for actual PDF parsing we'd need a library,
    // but we'll send the raw content and let AI make sense of it
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    // Extract readable text strings from PDF binary
    let text = "";
    let current = "";
    for (let i = 0; i < uint8Array.length; i++) {
      const char = uint8Array[i];
      if (char >= 32 && char <= 126) {
        current += String.fromCharCode(char);
      } else {
        if (current.length > 3) text += current + " ";
        current = "";
      }
    }
    if (current.length > 3) text += current;
    // Clean up common PDF artifacts
    text = text.replace(/\s+/g, " ").trim();
    return text.slice(0, 15000); // Limit to avoid token overflow
  };

  const runBehavioralAnalysis = async (pdfText: string, filePath: string, fileName: string) => {
    setAnalyzing(true);
    setAnalysis("");

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-closer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          type: "behavioral",
          member_name: member.name,
          metrics: memberMetrics,
          behavioral_text: pdfText,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        toast.error(err.error || "Erro ao gerar análise");
        setAnalyzing(false);
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) throw new Error("No reader");
      const decoder = new TextDecoder();
      let buffer = "";
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nlIdx: number;
        while ((nlIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nlIdx);
          buffer = buffer.slice(nlIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) { fullContent += content; setAnalysis(fullContent); }
          } catch {}
        }
      }

      // Save analysis to DB
      if (fullContent) {
        const { error } = await supabase.from("closer_analyses").insert({
          member_id: member.id,
          file_path: filePath,
          file_name: fileName,
          ai_analysis: fullContent,
          analysis_type: "behavioral",
        });
        if (!error) {
          setExistingAnalyses(prev => [{ file_name: fileName, ai_analysis: fullContent, created_at: new Date().toISOString() }, ...prev]);
          toast.success("Análise salva!");
        }
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro na análise comportamental");
    } finally {
      setAnalyzing(false);
    }
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
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
            >
              {showHistory ? "Ocultar" : `Histórico (${existingAnalyses.length})`}
            </button>
          )}
          <label className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-[hsl(var(--chart-3))] text-primary-foreground hover:opacity-90 transition-opacity cursor-pointer flex items-center gap-1.5">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "Enviando..." : "Upload PDF"}
            <input type="file" accept=".pdf" onChange={handleFileUpload} className="hidden" disabled={uploading} />
          </label>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Faça upload de PDFs de análise DISC, perfil comportamental ou avaliações de personalidade.
        A IA irá cruzar com as métricas de performance para gerar insights personalizados.
      </p>

      {(analysis || analyzing) && (
        <div className="rounded-lg bg-secondary/50 p-4 max-h-80 overflow-y-auto">
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
            {analysis || "Analisando perfil comportamental..."}
          </div>
        </div>
      )}

      {showHistory && existingAnalyses.map((a, i) => (
        <div key={i} className="rounded-lg bg-secondary/30 p-4 max-h-52 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <FileText size={10} className="text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{a.file_name}</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {new Date(a.created_at).toLocaleDateString("pt-BR")}
            </span>
          </div>
          <div className="prose prose-invert prose-sm max-w-none text-xs leading-relaxed text-secondary-foreground whitespace-pre-wrap">
            {a.ai_analysis}
          </div>
        </div>
      ))}
    </div>
  );
}

// --- Main Team Management Page ---
export default function TeamManagement() {
  const { data: members, isLoading } = useTeamMembers();
  const { data: months } = useMonths();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingMember, setEditingMember] = useState<DbTeamMember | null>(null);
  const [expandedMember, setExpandedMember] = useState<string | null>(null);
  const [selectedMonthId, setSelectedMonthId] = useState<string | undefined>();

  const activeMonthId = selectedMonthId || months?.[0]?.id;
  const activeMonth = months?.find(m => m.id === activeMonthId);

  const handleToggleActive = async (member: DbTeamMember) => {
    const { error } = await supabase.from("team_members").update({ active: !member.active }).eq("id", member.id);
    if (error) toast.error(error.message);
    else {
      toast.success(member.active ? "SDR desativado" : "SDR ativado");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    }
  };

  const handleDelete = async (member: DbTeamMember) => {
    if (!confirm(`Tem certeza que deseja excluir ${member.name}? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("team_members").delete().eq("id", member.id);
    if (error) toast.error(error.message);
    else {
      toast.success("SDR excluído");
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Gestão de Equipe</h2>
          <p className="text-xs text-muted-foreground mt-1">{members?.length || 0} SDRs cadastrados</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Month selector for analyses */}
          <div className="relative">
            <select
              value={activeMonthId || ""}
              onChange={e => setSelectedMonthId(e.target.value)}
              className="appearance-none bg-secondary text-secondary-foreground text-xs font-medium px-3 py-2 pr-7 rounded-lg border border-border cursor-pointer focus:ring-1 focus:ring-primary outline-none"
            >
              {months?.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>

          <button
            onClick={() => { setEditingMember(null); setShowForm(true); }}
            className="px-4 py-2 text-xs rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
          >
            <Plus size={14} /> Novo SDR
          </button>
        </div>
      </div>

      {/* Members list */}
      <div className="space-y-3">
        {members?.map(member => {
          const isExpanded = expandedMember === member.id;
          return (
            <div key={member.id} className="rounded-xl border border-border bg-card overflow-hidden transition-all">
              {/* Member header row */}
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedMember(isExpanded ? null : member.id)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar with upload overlay */}
                  <div className="relative group">
                    <img
                      src={getMemberAvatar(member, members?.indexOf(member) || 0)}
                      alt={member.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-border"
                    />
                    <label
                      className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      onClick={e => e.stopPropagation()}
                    >
                      <Camera size={14} className="text-white" />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (file.size > 5 * 1024 * 1024) { toast.error("Imagem deve ter no máximo 5MB"); return; }
                          const ext = file.name.split('.').pop();
                          const filePath = `${member.id}/avatar.${ext}`;
                          const { error: uploadErr } = await supabase.storage.from("member-avatars").upload(filePath, file, { upsert: true });
                          if (uploadErr) { toast.error("Erro no upload: " + uploadErr.message); return; }
                          const { data: urlData } = supabase.storage.from("member-avatars").getPublicUrl(filePath);
                          const avatarUrl = urlData.publicUrl + "?t=" + Date.now();
                          const { error: updateErr } = await supabase.from("team_members").update({ avatar_url: avatarUrl }).eq("id", member.id);
                          if (updateErr) { toast.error(updateErr.message); return; }
                          toast.success("Foto atualizada!");
                          queryClient.invalidateQueries({ queryKey: ["team-members"] });
                        }}
                      />
                    </label>
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-card-foreground">{member.name}</h4>
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${member.active ? "text-accent" : "text-muted-foreground"}`}>
                      {member.active ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingMember(member); setShowForm(true); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleToggleActive(member); }}
                    className={`p-2 rounded-lg transition-colors ${member.active ? "text-accent hover:text-accent/80 hover:bg-accent/10" : "text-muted-foreground hover:text-foreground hover:bg-secondary"}`}
                    title={member.active ? "Desativar" : "Ativar"}
                  >
                    {member.active ? <UserCheck size={14} /> : <UserX size={14} />}
                  </button>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(member); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded content */}
              {isExpanded && (
                <div className="border-t border-border p-5 space-y-6 bg-secondary/5">
                  {/* AI Performance Analysis */}
                  <AiCloserAnalysis member={member} monthId={activeMonthId} monthLabel={activeMonth?.label} />

                  <div className="h-px bg-border" />

                  {/* Behavioral PDF Upload & Analysis */}
                  <BehavioralAnalysis member={member} monthId={activeMonthId} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add/Edit form dialog */}
      {showForm && (
        <CloserFormDialog
          member={editingMember}
          onClose={() => setShowForm(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["team-members"] })}
        />
      )}
    </div>
  );
}
