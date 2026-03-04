import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, Sparkles, Loader2, Save, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
      id: "",
      title: "",
      message: "",
      emoji: "🔥",
      category: "motivation",
      active: true,
      target_role: "all",
      frequency_minutes: 120,
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
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Novo Popup
        </button>
      </div>

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
            Nenhum popup cadastrado. Clique em "Novo Popup" para começar.
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
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[9px] font-semibold text-muted-foreground uppercase">Público</label>
                  <select
                    value={editing.target_role}
                    onChange={(e) => setEditing({ ...editing, target_role: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
                  >
                    {ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
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
