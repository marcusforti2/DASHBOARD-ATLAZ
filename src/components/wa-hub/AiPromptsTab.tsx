import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Brain, Save, Plus, Trash2, Loader2, FileText, Sparkles,
  MessageSquare, Target, ShieldAlert, BookOpen, Pencil, Check, X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AiPrompt {
  id: string;
  title: string;
  content: string;
  category: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  { value: 'identity', label: 'Identidade', emoji: '🤖', desc: 'Quem é a IA, nome, personalidade' },
  { value: 'product', label: 'Produto/Serviço', emoji: '📦', desc: 'O que vocês vendem, preços, diferenciais' },
  { value: 'qualification', label: 'Qualificação', emoji: '🎯', desc: 'Critérios para qualificar leads' },
  { value: 'objections', label: 'Objeções', emoji: '🛡️', desc: 'Como lidar com objeções comuns' },
  { value: 'rules', label: 'Regras e Limites', emoji: '⚠️', desc: 'O que a IA NÃO deve fazer' },
  { value: 'scripts', label: 'Scripts de Venda', emoji: '📝', desc: 'Roteiros e fluxos de conversa' },
  { value: 'faq', label: 'FAQ', emoji: '❓', desc: 'Perguntas frequentes e respostas' },
  { value: 'custom', label: 'Personalizado', emoji: '✨', desc: 'Prompts livres' },
];

const CATEGORY_ICONS: Record<string, typeof Brain> = {
  identity: Brain,
  product: FileText,
  qualification: Target,
  objections: ShieldAlert,
  rules: ShieldAlert,
  scripts: MessageSquare,
  faq: BookOpen,
  custom: Sparkles,
};

export function AiPromptsTab() {
  const [prompts, setPrompts] = useState<AiPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);

  // New prompt form
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('custom');

  // Edit state
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('custom');

  useEffect(() => { loadPrompts(); }, []);

  const loadPrompts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('company_knowledge')
      .select('*')
      .eq('category', 'ai_prompt')
      .order('created_at', { ascending: false });

    // Map to our format - using file_name for sub-category
    setPrompts((data || []).map((d: any) => ({
      id: d.id,
      title: d.title,
      content: d.content,
      category: d.file_name || 'custom', // reuse file_name for prompt category
      active: d.active,
      created_at: d.created_at,
      updated_at: d.updated_at,
    })));
    setLoading(false);
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      toast.error('Preencha título e conteúdo');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('company_knowledge').insert({
      title: newTitle.trim(),
      content: newContent.trim(),
      category: 'ai_prompt',
      file_name: newCategory, // store prompt category here
      active: true,
    });
    setSaving(false);
    if (error) { toast.error('Erro ao criar'); return; }
    toast.success('Prompt criado! A IA já vai usar nas próximas conversas.');
    setNewTitle('');
    setNewContent('');
    setNewCategory('custom');
    setShowNew(false);
    loadPrompts();
  };

  const handleUpdate = async (id: string) => {
    setSaving(true);
    const { error } = await supabase.from('company_knowledge').update({
      title: editTitle.trim(),
      content: editContent.trim(),
      file_name: editCategory,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    setSaving(false);
    if (error) { toast.error('Erro ao atualizar'); return; }
    toast.success('Prompt atualizado!');
    setEditingId(null);
    loadPrompts();
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    await supabase.from('company_knowledge').update({ active: !currentActive }).eq('id', id);
    loadPrompts();
    toast.success(currentActive ? 'Prompt desativado' : 'Prompt ativado');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este prompt?')) return;
    await supabase.from('company_knowledge').delete().eq('id', id);
    toast.success('Prompt excluído');
    loadPrompts();
  };

  const startEdit = (p: AiPrompt) => {
    setEditingId(p.id);
    setEditTitle(p.title);
    setEditContent(p.content);
    setEditCategory(p.category);
  };

  const activeCount = prompts.filter(p => p.active).length;
  const getCat = (cat: string) => CATEGORIES.find(c => c.value === cat);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Brain className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                Prompts do Negócio
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                  {activeCount} ativo{activeCount !== 1 ? 's' : ''}
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Configure aqui todas as informações do seu negócio que a IA deve saber. Esses prompts são usados por <strong>todas as ferramentas de IA</strong> — SDR IA, Coach, reescrita de mensagens, etc.
              </p>
            </div>
          </div>

          {/* Category overview */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-4">
            {CATEGORIES.slice(0, 4).map(cat => {
              const count = prompts.filter(p => p.category === cat.value && p.active).length;
              return (
                <div key={cat.value} className="rounded-lg bg-card border border-border p-2.5 text-center">
                  <span className="text-lg">{cat.emoji}</span>
                  <p className="text-[10px] font-medium text-foreground mt-0.5">{cat.label}</p>
                  <p className="text-[10px] text-muted-foreground">{count} prompt{count !== 1 ? 's' : ''}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add new */}
      <div className="flex gap-2">
        {!showNew && (
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Prompt
          </Button>
        )}
      </div>

      {showNew && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Novo Prompt</CardTitle>
              <button onClick={() => setShowNew(false)} className="text-xs text-muted-foreground hover:text-foreground">Cancelar</button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Título</label>
                <Input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Ex: Informações sobre preços" className="text-sm" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Categoria</label>
                <Select value={newCategory} onValueChange={setNewCategory}>
                  <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.emoji} {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Conteúdo do Prompt</label>
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder={`Escreva as informações que a IA precisa saber.\n\nExemplo:\nNosso produto principal é o Plano Premium a R$ 497/mês.\nTemos 3 planos: Starter (R$ 97), Pro (R$ 297) e Premium (R$ 497).\nNão fazemos desconto, mas oferecemos 30 dias de garantia.\nNosso diferencial é o suporte 24h com closer dedicado.`}
                rows={8}
                className="text-sm resize-none"
              />
            </div>
            <Button onClick={handleCreate} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Salvar Prompt
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Existing prompts */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : prompts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Nenhum prompt cadastrado</p>
            <p className="text-[10px] text-muted-foreground mt-1">Crie prompts para que a IA saiba tudo sobre seu negócio</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {prompts.map(p => {
            const cat = getCat(p.category);
            const Icon = CATEGORY_ICONS[p.category] || Sparkles;
            const isEditing = editingId === p.id;

            return (
              <Card key={p.id} className={`transition-all ${!p.active ? 'opacity-50' : ''}`}>
                <CardContent className="p-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="text-sm" />
                        <Select value={editCategory} onValueChange={setEditCategory}>
                          <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>
                            ))}</SelectContent>
                        </Select>
                      </div>
                      <Textarea value={editContent} onChange={e => setEditContent(e.target.value)} rows={6} className="text-sm resize-none" />
                      <div className="flex gap-2">
                        <Button onClick={() => handleUpdate(p.id)} disabled={saving} size="sm" className="gap-1">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} Salvar
                        </Button>
                        <Button onClick={() => setEditingId(null)} variant="outline" size="sm" className="gap-1">
                          <X className="w-3.5 h-3.5" /> Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3">
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${p.active ? 'bg-primary/10' : 'bg-muted'}`}>
                        <Icon className={`w-4 h-4 ${p.active ? 'text-primary' : 'text-muted-foreground'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-foreground">{p.title}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            {cat?.emoji} {cat?.label || p.category}
                          </Badge>
                          {p.active && <Badge className="text-[10px] bg-green-500/10 text-green-600 border-green-500/20">Ativo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{p.content}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          Atualizado em {new Date(p.updated_at).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button onClick={() => startEdit(p)} variant="ghost" size="sm" className="h-7 w-7 p-0">
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button onClick={() => handleToggleActive(p.id, p.active)} variant="ghost" size="sm" className="h-7 w-7 p-0">
                          {p.active ? <Check className="w-3.5 h-3.5 text-green-500" /> : <X className="w-3.5 h-3.5 text-muted-foreground" />}
                        </Button>
                        <Button onClick={() => handleDelete(p.id)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
