import { useState, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Plus, BookOpen, Trash2, Edit2, Loader2, Sparkles, Eye, Search,
  Wand2, Copy, Check, RefreshCw, BookMarked, Globe, Lock, FileText,
} from "lucide-react";

type Playbook = {
  id: string;
  title: string;
  description: string | null;
  content: string;
  category: string;
  target_role: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
};

const QUICK_PROMPTS = [
  { label: "🚀 Onboarding SDR", prompt: "Crie um playbook completo de onboarding para novos SDRs, com primeiros passos, ferramentas, métricas e rotina diária" },
  { label: "💰 Processo de Vendas", prompt: "Crie um playbook de processo de vendas com funil, scripts de abordagem, quebra de objeções e follow-up" },
  { label: "📞 Cold Calling", prompt: "Crie um guia completo de cold calling com scripts, gatilhos mentais, contorno de objeções e métricas" },
  { label: "📱 Prospecção LinkedIn", prompt: "Crie um playbook de prospecção ativa no LinkedIn com templates de mensagens, sequências e boas práticas" },
  { label: "🎯 Qualificação de Leads", prompt: "Crie um framework de qualificação de leads com BANT, SPIN Selling e perguntas-chave" },
  { label: "🤝 Closer – Reunião", prompt: "Crie um playbook para closers sobre como conduzir reuniões de vendas com apresentação, descoberta e fechamento" },
];

const CATEGORIES = [
  { value: "geral", label: "Geral" },
  { value: "sdr", label: "SDR" },
  { value: "closer", label: "Closer" },
  { value: "onboarding", label: "Onboarding" },
  { value: "processos", label: "Processos" },
  { value: "scripts", label: "Scripts" },
];

export default function PlaybooksHub() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ["training-playbooks"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_playbooks")
        .select("*")
        .order("updated_at", { ascending: false });
      return (data || []) as Playbook[];
    },
  });

  const filtered = playbooks.filter((p) => {
    if (!search) return true;
    return p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.description?.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase());
  });

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este playbook permanentemente?")) return;
    await supabase.from("training_playbooks").delete().eq("id", id);
    toast.success("Playbook excluído");
    qc.invalidateQueries({ queryKey: ["training-playbooks"] });
    if (selectedPlaybook?.id === id) setSelectedPlaybook(null);
  };

  const handleTogglePublish = async (pb: Playbook) => {
    await supabase.from("training_playbooks").update({ is_published: !pb.is_published }).eq("id", pb.id);
    toast.success(pb.is_published ? "Playbook despublicado" : "Playbook publicado!");
    qc.invalidateQueries({ queryKey: ["training-playbooks"] });
  };

  if (selectedPlaybook) {
    return (
      <PlaybookEditor
        playbook={selectedPlaybook}
        onBack={() => { setSelectedPlaybook(null); qc.invalidateQueries({ queryKey: ["training-playbooks"] }); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-foreground flex items-center gap-2">
            <BookMarked size={18} className="text-primary" /> Playbooks
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">Guias e materiais de referência para a equipe</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar..."
              className="h-8 text-xs pl-8 w-48"
            />
          </div>
          <CreatePlaybookDialog
            open={createOpen}
            onOpenChange={setCreateOpen}
            onCreated={(pb) => { setSelectedPlaybook(pb); }}
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center">
          <BookMarked size={40} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum playbook criado ainda</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Clique em "+ Novo" para começar</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((pb) => (
            <Card
              key={pb.id}
              className="p-4 cursor-pointer hover:border-primary/30 hover:shadow-md transition-all group"
              onClick={() => setSelectedPlaybook(pb)}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{pb.title}</p>
                  {pb.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{pb.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 ml-2 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleTogglePublish(pb); }} className="p-1 rounded hover:bg-primary/10 text-muted-foreground hover:text-primary">
                    {pb.is_published ? <Globe size={12} /> : <Lock size={12} />}
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(pb.id); }} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant="outline" className="text-[9px]">{pb.category}</Badge>
                <Badge variant="outline" className="text-[9px]">
                  {pb.target_role === "all" ? "Todos" : pb.target_role.toUpperCase()}
                </Badge>
                {pb.is_published ? (
                  <Badge className="text-[9px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">Publicado</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px]">Rascunho</Badge>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground/60 mt-2">
                Atualizado {new Date(pb.updated_at).toLocaleDateString("pt-BR")}
              </p>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Playbook Dialog ──
function CreatePlaybookDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (pb: Playbook) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("geral");
  const [targetRole, setTargetRole] = useState("all");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) { toast.error("Título obrigatório"); return; }
    setSaving(true);
    const { data, error } = await supabase
      .from("training_playbooks")
      .insert({ title, description: description || null, category, target_role: targetRole })
      .select()
      .single();
    setSaving(false);
    if (error) { toast.error("Erro ao criar"); return; }
    toast.success("Playbook criado!");
    qc.invalidateQueries({ queryKey: ["training-playbooks"] });
    onOpenChange(false);
    setTitle(""); setDescription(""); setCategory("geral"); setTargetRole("all");
    if (data) onCreated(data as Playbook);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 text-xs h-8">
          <Plus size={14} /> Novo
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BookMarked size={16} className="text-primary" /> Novo Playbook
          </DialogTitle>
          <DialogDescription className="text-xs">Crie um playbook para sua equipe</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">Título</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Guia de Prospecção Ativa" className="h-9 text-sm" />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Descrição (opcional)</label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Breve descrição..." rows={2} className="text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Categoria</label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Público</label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="sdr">SDR</SelectItem>
                  <SelectItem value="closer">Closer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleSave} disabled={saving} className="w-full gap-1.5">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Criar Playbook
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Playbook Editor ──
function PlaybookEditor({ playbook, onBack }: { playbook: Playbook; onBack: () => void }) {
  const [content, setContent] = useState(playbook.content);
  const [title, setTitle] = useState(playbook.title);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(true);
  const [aiWriterOpen, setAiWriterOpen] = useState(false);
  const [isPreview, setIsPreview] = useState(false);
  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  const autoSave = (newContent: string) => {
    setContent(newContent);
    setSaved(false);
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(async () => {
      await supabase.from("training_playbooks").update({ content: newContent }).eq("id", playbook.id);
      setSaved(true);
    }, 1500);
  };

  const handleTitleSave = async () => {
    if (!title.trim() || title === playbook.title) return;
    await supabase.from("training_playbooks").update({ title }).eq("id", playbook.id);
    toast.success("Título salvo");
  };

  const handleInsertAI = (markdown: string) => {
    const newContent = content ? content + "\n\n" + markdown : markdown;
    autoSave(newContent);
    setAiWriterOpen(false);
    toast.success("Conteúdo inserido!");
  };

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="shrink-0 text-xs gap-1">
            ← Voltar
          </Button>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleTitleSave}
            className="text-base font-bold border-none bg-transparent shadow-none focus-visible:ring-0 px-0 h-auto flex-1"
            placeholder="Título do playbook"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8" onClick={() => setIsPreview(!isPreview)}>
            {isPreview ? <><Edit2 size={12} /> Editar</> : <><Eye size={12} /> Preview</>}
          </Button>
          <Button variant="outline" size="sm" className="text-xs gap-1.5 h-8 border-primary/30 text-primary hover:bg-primary/10" onClick={() => setAiWriterOpen(true)}>
            <Sparkles size={12} /> Escrever com IA
          </Button>
          {saved ? (
            <Badge variant="outline" className="text-[9px] gap-1 text-emerald-600 border-emerald-200">
              <Check size={10} /> Salvo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[9px] gap-1 text-amber-600 border-amber-200 animate-pulse">
              Salvando...
            </Badge>
          )}
        </div>
      </div>

      {/* Editor or Preview */}
      {isPreview ? (
        <Card className="p-6 min-h-[50vh]">
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{content || "*Playbook vazio — use o editor ou a IA para começar*"}</ReactMarkdown>
          </div>
        </Card>
      ) : (
        <Textarea
          value={content}
          onChange={(e) => autoSave(e.target.value)}
          placeholder="Comece a escrever seu playbook aqui... Use Markdown para formatação (## Título, **negrito**, - lista, etc.)"
          className="min-h-[50vh] font-mono text-sm leading-relaxed resize-none"
        />
      )}

      {/* AI Writer Dialog */}
      <AIPlaybookWriter
        open={aiWriterOpen}
        onOpenChange={setAiWriterOpen}
        onInsert={handleInsertAI}
        currentContent={content}
      />
    </div>
  );
}

// ── AI Playbook Writer (streaming) ──
function AIPlaybookWriter({ open, onOpenChange, onInsert, currentContent }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onInsert: (markdown: string) => void;
  currentContent?: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [result, setResult] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const handleGenerate = async (customPrompt?: string) => {
    const finalPrompt = customPrompt || prompt;
    if (!finalPrompt.trim()) { toast.error("Digite o que deseja gerar"); return; }

    setIsStreaming(true);
    setResult("");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-playbook-content`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            prompt: finalPrompt,
            context: context || undefined,
            currentContent: currentContent || undefined,
          }),
          signal: controller.signal,
        }
      );

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: "Erro desconhecido" }));
        throw new Error(err.error || `Erro ${resp.status}`);
      }

      if (!resp.body) throw new Error("No stream body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              accumulated += content;
              setResult(accumulated);
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        toast.error(err.message || "Erro ao gerar conteúdo");
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  };

  const handleCancel = () => {
    abortRef.current?.abort();
    setIsStreaming(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (isStreaming) return; onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <Sparkles size={16} className="text-primary" />
            Escrever com IA
          </DialogTitle>
          <DialogDescription className="text-xs">
            Descreva o que deseja gerar ou escolha um modelo rápido
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-4">
            {/* Quick prompts */}
            <div>
              <label className="text-xs text-muted-foreground uppercase tracking-wider mb-2 block font-medium">Modelos rápidos</label>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((qp) => (
                  <Badge
                    key={qp.label}
                    variant="outline"
                    className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors px-3 py-1.5 text-xs"
                    onClick={() => { setPrompt(qp.prompt); handleGenerate(qp.prompt); }}
                  >
                    {qp.label}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Custom prompt */}
            <div>
              <label className="text-xs font-medium mb-1 block">O que deseja gerar?</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ex: Crie um guia de prospecção ativa com scripts para LinkedIn e WhatsApp..."
                className="min-h-[100px] text-sm"
              />
            </div>

            {/* Context */}
            <div>
              <label className="text-xs font-medium mb-1 block">Contexto do seu negócio (opcional)</label>
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Ex: Vendemos SaaS B2B para PMEs, ticket médio R$2.000/mês..."
                className="min-h-[60px] text-xs"
              />
            </div>

            <Button onClick={() => handleGenerate()} disabled={!prompt.trim() || isStreaming} className="w-full gap-2">
              {isStreaming ? <><Loader2 size={14} className="animate-spin" /> Gerando...</> : <><Wand2 size={14} /> Gerar conteúdo</>}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <ScrollArea className="flex-1 border border-border rounded-lg p-4 bg-muted/20 max-h-[50vh]">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{result}</ReactMarkdown>
              </div>
              {isStreaming && <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />}
            </ScrollArea>

            <div className="flex gap-2">
              {isStreaming ? (
                <Button variant="outline" onClick={handleCancel} className="flex-1 text-xs">
                  Parar geração
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={() => setResult("")} className="gap-1.5 text-xs">
                    <RefreshCw size={12} /> Gerar novamente
                  </Button>
                  <Button variant="outline" size="icon" onClick={handleCopy} className="shrink-0">
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </Button>
                  <Button onClick={() => onInsert(result)} className="flex-1 gap-1.5 text-xs">
                    <Sparkles size={12} /> Inserir no Playbook
                  </Button>
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
