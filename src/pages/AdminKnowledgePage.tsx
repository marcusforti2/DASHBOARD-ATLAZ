import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, BookOpen, Loader2, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

interface Knowledge {
  id: string;
  title: string;
  content: string;
  category: string;
  active: boolean;
}

const CATEGORIES = [
  { value: "general", label: "Geral", emoji: "📋" },
  { value: "product", label: "Produto/Serviço", emoji: "🎯" },
  { value: "process", label: "Processo de Vendas", emoji: "🔄" },
  { value: "objections", label: "Objeções", emoji: "🛡️" },
  { value: "scripts", label: "Scripts Base", emoji: "📝" },
  { value: "culture", label: "Cultura/Valores", emoji: "💎" },
  { value: "icp", label: "ICP/Persona", emoji: "👤" },
  { value: "competitors", label: "Concorrentes", emoji: "⚔️" },
];

export default function AdminKnowledgePage() {
  const [items, setItems] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Knowledge | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchItems = async () => {
    const { data } = await supabase
      .from("company_knowledge")
      .select("*")
      .order("category")
      .order("created_at", { ascending: false });
    setItems((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, []);

  const deleteItem = async (id: string) => {
    await supabase.from("company_knowledge").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success("Conhecimento removido");
  };

  const openNew = () => {
    setEditing({ id: "", title: "", content: "", category: "general", active: true });
    setDialogOpen(true);
  };

  const openEdit = (item: Knowledge) => {
    setEditing({ ...item });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!editing) return;
    const { id, ...data } = editing;

    if (id) {
      await supabase.from("company_knowledge").update(data).eq("id", id);
      toast.success("Atualizado");
    } else {
      await supabase.from("company_knowledge").insert(data);
      toast.success("Conhecimento adicionado");
    }
    setDialogOpen(false);
    fetchItems();
  };

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: items.filter((i) => i.category === cat.value),
  })).filter((g) => g.items.length > 0);

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
          <BookOpen size={16} className="text-accent" />
          <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Base de Conhecimento</h2>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Adicionar
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Cadastre informações sobre sua empresa, produto, processos e scripts. O Coach IA usará esse contexto para dar respostas personalizadas.
      </p>

      {grouped.length === 0 && items.length === 0 && (
        <div className="text-center py-16 space-y-3">
          <BookOpen size={32} className="text-muted-foreground mx-auto" />
          <p className="text-sm text-muted-foreground">Nenhum conhecimento cadastrado.</p>
          <p className="text-xs text-muted-foreground">Adicione informações para que a IA conheça sua empresa.</p>
        </div>
      )}

      {grouped.map((group) => (
        <div key={group.value} className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-base">{group.emoji}</span>
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">{group.label}</h3>
            <span className="text-[9px] text-muted-foreground">{group.items.length}</span>
          </div>
          <div className="grid gap-2">
            {group.items.map((item) => (
              <div key={item.id} className="rounded-xl border border-border bg-card p-4 flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-semibold text-card-foreground">{item.title}</h4>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.content}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-card-foreground">
              {editing?.id ? "Editar" : "Novo Conhecimento"}
            </DialogTitle>
          </DialogHeader>

          {editing && (
            <div className="space-y-3">
              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Categoria</label>
                <select
                  value={editing.category}
                  onChange={(e) => setEditing({ ...editing, category: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Título</label>
                <input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  placeholder="Ex: Nosso Produto Principal"
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground"
                />
              </div>
              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Conteúdo</label>
                <textarea
                  value={editing.content}
                  onChange={(e) => setEditing({ ...editing, content: e.target.value })}
                  rows={8}
                  placeholder="Descreva detalhadamente. A IA usará essas informações para contextualizar suas respostas..."
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground resize-none"
                />
              </div>

              <button
                onClick={handleSave}
                disabled={!editing.title.trim() || !editing.content.trim()}
                className="w-full rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
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
