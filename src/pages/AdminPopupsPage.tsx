import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Sparkles, Loader2, Save, X, Wand2, Check } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

interface Popup {
  id: string;
  title: string;
  message: string;
  emoji: string;
  category: string;
  active: boolean;
  target_role: string;
  frequency_minutes: number;
}

interface GeneratedPopup {
  title: string;
  message: string;
  emoji: string;
  selected: boolean;
}

const CATEGORIES = [
  { value: "motivation", label: "Motivação" },
  { value: "reminder", label: "Lembrete" },
  { value: "tip", label: "Dica" },
];

const ROLES = [
  { value: "all", label: "Todos" },
  { value: "sdr", label: "SDR" },
  { value: "closer", label: "Closer" },
];

export default function AdminPopupsPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Popup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // AI Generator state
  const [aiOpen, setAiOpen] = useState(false);
  const [aiCategory, setAiCategory] = useState("motivation");
  const [aiRole, setAiRole] = useState("all");
  const [aiQuantity, setAiQuantity] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResults, setAiResults] = useState<GeneratedPopup[]>([]);
  const [aiSaving, setAiSaving] = useState(false);

  const fetchPopups = async () => {
    const { data } = await supabase
      .from("motivational_popups")
      .select("*")
      .order("created_at", { ascending: false });
    setPopups((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchPopups(); }, []);

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("motivational_popups").update({ active }).eq("id", id);
    setPopups((prev) => prev.map((p) => (p.id === id ? { ...p, active } : p)));
  };

  const deletePopup = async (id: string) => {
    await supabase.from("motivational_popups").delete().eq("id", id);
    setPopups((prev) => prev.filter((p) => p.id !== id));
    toast.success("Popup removido");
  };

  const openNew = () => {
    setEditing({
      id: "", title: "", message: "", emoji: "🔥",
      category: "motivation", active: true, target_role: "all", frequency_minutes: 120,
    });
    setDialogOpen(true);
  };

  const openEdit = (p: Popup) => {
    setEditing({ ...p });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { id, ...data } = editing;
    if (id) {
      await supabase.from("motivational_popups").update(data).eq("id", id);
      toast.success("Popup atualizado");
    } else {
      await supabase.from("motivational_popups").insert(data);
      toast.success("Popup criado");
    }
    setDialogOpen(false);
    fetchPopups();
  };

  // AI Generator
  const handleGenerate = async () => {
    setAiGenerating(true);
    setAiResults([]);
    try {
      const resp = await supabase.functions.invoke("generate-popups", {
        body: { category: aiCategory, target_role: aiRole, quantity: aiQuantity },
      });
      if (resp.error) throw resp.error;
      const data = resp.data as { popups: { title: string; message: string; emoji: string }[] };
      setAiResults((data.popups || []).map(p => ({ ...p, selected: true })));
    } catch (e: any) {
      toast.error(e?.message || "Erro ao gerar popups com IA");
    } finally {
      setAiGenerating(false);
    }
  };

  const toggleAiResult = (idx: number) => {
    setAiResults(prev => prev.map((r, i) => i === idx ? { ...r, selected: !r.selected } : r));
  };

  const saveAiResults = async () => {
    const selected = aiResults.filter(r => r.selected);
    if (!selected.length) { toast.error("Selecione ao menos um popup"); return; }
    setAiSaving(true);
    const rows = selected.map(r => ({
      title: r.title,
      message: r.message,
      emoji: r.emoji,
      category: aiCategory,
      target_role: aiRole,
      active: true,
      frequency_minutes: 120,
    }));
    const { error } = await supabase.from("motivational_popups").insert(rows);
    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success(`${selected.length} popup(s) salvos!`);
      setAiResults([]);
      setAiOpen(false);
      fetchPopups();
    }
    setAiSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles size={16} className="text-chart-4" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Popups Motivacionais</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setAiOpen(true); setAiResults([]); }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/80 transition-colors"
          >
            <Wand2 size={14} /> Gerar com IA
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Novo Popup
          </button>
        </div>
      </div>

      {/* AI Generator Panel */}
      {aiOpen && (
        <div className="rounded-xl border border-accent/30 bg-accent/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wand2 size={14} className="text-accent" />
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">Gerador IA de Popups</span>
            </div>
            <button onClick={() => setAiOpen(false)} className="p-1 rounded hover:bg-secondary text-muted-foreground">
              <X size={14} />
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Categoria</label>
              <select
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
              >
                {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Público-alvo</label>
              <select
                value={aiRole}
                onChange={(e) => setAiRole(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
              >
                {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Quantidade</label>
              <select
                value={aiQuantity}
                onChange={(e) => setAiQuantity(parseInt(e.target.value))}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
              >
                {[3, 5, 8, 10].map(n => <option key={n} value={n}>{n} popups</option>)}
              </select>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={aiGenerating}
            className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {aiGenerating ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {aiGenerating ? "Gerando..." : "Gerar Popups"}
          </button>

          {/* AI Results */}
          {aiResults.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {aiResults.filter(r => r.selected).length} de {aiResults.length} selecionados
                </span>
                <button
                  onClick={saveAiResults}
                  disabled={aiSaving || !aiResults.some(r => r.selected)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 disabled:opacity-50"
                >
                  {aiSaving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                  Salvar Selecionados
                </button>
              </div>
              {aiResults.map((r, i) => (
                <div
                  key={i}
                  onClick={() => toggleAiResult(i)}
                  className={cn(
                    "rounded-lg border p-3 flex items-start gap-3 cursor-pointer transition-all",
                    r.selected
                      ? "border-primary/40 bg-primary/5"
                      : "border-border bg-card opacity-50"
                  )}
                >
                  <div className={cn(
                    "w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors",
                    r.selected ? "border-primary bg-primary" : "border-muted-foreground"
                  )}>
                    {r.selected && <Check size={12} className="text-primary-foreground" />}
                  </div>
                  <span className="text-xl shrink-0">{r.emoji}</span>
                  <div className="min-w-0">
                    <h4 className="text-sm font-bold text-card-foreground">{r.title}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">{r.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {popups.map((p) => (
          <div
            key={p.id}
            className={cn(
              "rounded-xl border bg-card p-4 flex items-start gap-3 transition-opacity",
              !p.active && "opacity-50"
            )}
          >
            <span className="text-2xl mt-0.5">{p.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-card-foreground truncate">{p.title}</h3>
                <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {CATEGORIES.find((c) => c.value === p.category)?.label}
                </span>
                <span className="text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                  {ROLES.find((r) => r.value === p.target_role)?.label}
                </span>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2">{p.message}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Switch checked={p.active} onCheckedChange={(v) => toggleActive(p.id, v)} />
              <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                <Pencil size={14} />
              </button>
              <button onClick={() => deletePopup(p.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}

        {popups.length === 0 && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum popup cadastrado. Clique em "Novo Popup" ou "Gerar com IA" para começar.
          </div>
        )}
      </div>

      {/* Edit/Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-card-foreground">
              {editing?.id ? "Editar Popup" : "Novo Popup"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-20">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase">Emoji</label>
                  <input
                    value={editing.emoji}
                    onChange={(e) => setEditing({ ...editing, emoji: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xl text-center"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase">Título</label>
                  <input
                    value={editing.title}
                    onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Mensagem</label>
                <textarea
                  value={editing.message}
                  onChange={(e) => setEditing({ ...editing, message: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase">Categoria</label>
                  <select
                    value={editing.category}
                    onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
                  >
                    {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase">Público</label>
                  <select
                    value={editing.target_role}
                    onChange={(e) => setEditing({ ...editing, target_role: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
                  >
                    {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase">Freq. (min)</label>
                  <input
                    type="number"
                    value={editing.frequency_minutes}
                    onChange={(e) => setEditing({ ...editing, frequency_minutes: parseInt(e.target.value) || 60 })}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                  />
                </div>
              </div>

              <button
                onClick={handleSave}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
              >
                <Save size={14} /> Salvar
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
