import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, Pencil, BookOpen, Loader2, Save, Sparkles, Upload, FileText, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Knowledge {
  id: string;
  title: string;
  content: string;
  category: string;
  active: boolean;
  file_url?: string | null;
  file_name?: string | null;
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
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiCategory, setAiCategory] = useState("general");
  const [aiLoading, setAiLoading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const aiFileInputRef = useRef<HTMLInputElement>(null);
  const [aiFile, setAiFile] = useState<File | null>(null);

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
    // Also delete associated file
    const item = items.find(i => i.id === id);
    if (item?.file_url) {
      const path = item.file_url.split("/knowledge-files/")[1];
      if (path) await supabase.storage.from("knowledge-files").remove([path]);
    }
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

  const handleFileUpload = async (file: File, knowledgeId?: string) => {
    setUploadingFile(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("knowledge-files")
        .upload(path, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from("knowledge-files")
        .getPublicUrl(path);

      if (knowledgeId && editing) {
        setEditing({ ...editing, file_url: publicUrl, file_name: file.name });
      }

      return { url: publicUrl, name: file.name };
    } catch (err: any) {
      toast.error("Erro ao enviar arquivo: " + err.message);
      return null;
    } finally {
      setUploadingFile(false);
    }
  };

  const handleSave = async () => {
    if (!editing) return;
    const { id, ...data } = editing;

    if (id) {
      await supabase.from("company_knowledge").update(data as any).eq("id", id);
      toast.success("Atualizado");
    } else {
      await supabase.from("company_knowledge").insert(data as any);
      toast.success("Conhecimento adicionado");
    }
    setDialogOpen(false);
    fetchItems();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editing) return;
    await handleFileUpload(file, editing.id);
    e.target.value = "";
  };

  const removeFile = () => {
    if (!editing) return;
    setEditing({ ...editing, file_url: null, file_name: null });
  };

  // Read file as text for AI
  const readFileAsText = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt.trim() && !aiFile) {
      toast.error("Digite um prompt ou envie um arquivo");
      return;
    }
    setAiLoading(true);
    try {
      let fileContent = "";
      let uploadedFile: { url: string; name: string } | null = null;

      if (aiFile) {
        fileContent = await readFileAsText(aiFile);
        uploadedFile = await handleFileUpload(aiFile);
      }

      const { data, error } = await supabase.functions.invoke("generate-knowledge", {
        body: {
          prompt: aiPrompt || `Estruture o conteúdo do arquivo "${aiFile?.name}" como conhecimento da empresa`,
          category: aiCategory,
          fileContent: fileContent.slice(0, 15000), // Limit to avoid token overflow
        },
      });

      if (error) throw error;

      // Save the generated knowledge
      const insertData: any = {
        title: data.title,
        content: data.content,
        category: data.category || aiCategory,
        active: true,
      };

      if (uploadedFile) {
        insertData.file_url = uploadedFile.url;
        insertData.file_name = uploadedFile.name;
      }

      await supabase.from("company_knowledge").insert(insertData);

      toast.success("Conhecimento gerado e salvo!");
      setAiDialogOpen(false);
      setAiPrompt("");
      setAiFile(null);
      setAiCategory("general");
      fetchItems();
    } catch (err: any) {
      toast.error("Erro ao gerar: " + err.message);
    } finally {
      setAiLoading(false);
    }
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
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAiDialogOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-accent text-accent-foreground text-xs font-semibold hover:bg-accent/90 transition-colors"
          >
            <Sparkles size={14} /> Criar com IA
          </button>
          <button
            onClick={openNew}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} /> Adicionar
          </button>
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        Cadastre informações sobre sua empresa, produto, processos e scripts. O Coach IA usará esse contexto para dar respostas personalizadas. Você pode criar manualmente, com IA ou subir arquivos.
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
                  <div className="flex items-center gap-2">
                    <h4 className="text-sm font-semibold text-card-foreground">{item.title}</h4>
                    {item.file_name && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-secondary text-[9px] text-muted-foreground">
                        <FileText size={10} /> {item.file_name}
                      </span>
                    )}
                  </div>
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

      {/* Edit/Create Dialog */}
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
                  placeholder="Descreva detalhadamente..."
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground resize-none"
                />
              </div>

              {/* File upload */}
              <div>
                <label className="text-[9px] font-semibold text-muted-foreground uppercase">Arquivo (opcional)</label>
                {editing.file_name ? (
                  <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary">
                    <FileText size={14} className="text-muted-foreground" />
                    <span className="text-xs text-secondary-foreground flex-1 truncate">{editing.file_name}</span>
                    <button onClick={removeFile} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingFile}
                    className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                  >
                    {uploadingFile ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    {uploadingFile ? "Enviando..." : "Enviar arquivo"}
                  </button>
                )}
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileSelect} accept=".txt,.md,.csv,.json,.pdf,.doc,.docx" />
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

      {/* AI Generate Dialog */}
      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
              <Sparkles size={16} className="text-accent" /> Criar com IA
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Descreva o que quer cadastrar ou envie um arquivo. A IA vai estruturar o conhecimento automaticamente.
            </p>

            <div>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Categoria preferida</label>
              <select
                value={aiCategory}
                onChange={(e) => setAiCategory(e.target.value)}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.emoji} {c.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Descreva ou cole o conteúdo</label>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                rows={6}
                placeholder="Ex: Nosso produto é uma plataforma SaaS de gestão comercial que ajuda equipes de vendas a..."
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground resize-none"
              />
            </div>

            {/* AI file upload */}
            <div>
              <label className="text-[9px] font-semibold text-muted-foreground uppercase">Ou envie um arquivo</label>
              {aiFile ? (
                <div className="mt-1 flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary">
                  <FileText size={14} className="text-muted-foreground" />
                  <span className="text-xs text-secondary-foreground flex-1 truncate">{aiFile.name}</span>
                  <button onClick={() => setAiFile(null)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => aiFileInputRef.current?.click()}
                  className="mt-1 w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-dashed border-border text-xs text-muted-foreground hover:bg-secondary transition-colors"
                >
                  <Upload size={14} /> Enviar arquivo
                </button>
              )}
              <input
                ref={aiFileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => { setAiFile(e.target.files?.[0] || null); e.target.value = ""; }}
                accept=".txt,.md,.csv,.json,.pdf,.doc,.docx"
              />
            </div>

            <button
              onClick={handleAiGenerate}
              disabled={aiLoading || (!aiPrompt.trim() && !aiFile)}
              className="w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {aiLoading ? (
                <><Loader2 size={14} className="animate-spin" /> Gerando...</>
              ) : (
                <><Sparkles size={14} /> Gerar Conhecimento</>
              )}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
