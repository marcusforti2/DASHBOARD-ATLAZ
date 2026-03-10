import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Eye, Sparkles, Code, LayoutTemplate } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface TemplateEditorProps {
  template: { id: string; name: string; subject: string; body_html: string } | null;
  onSave: () => void;
  onClose: () => void;
}

const APPLE_TEMPLATE = `<div style="background-color: #f5f5f7; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <h1 style="font-size: 20px; font-weight: 600; color: #1d1d1f; margin: 0; letter-spacing: -0.3px;">SUA EMPRESA</h1>
    </div>
    
    <!-- Main Card -->
    <div style="background: #ffffff; border-radius: 16px; padding: 48px 40px; margin-bottom: 16px;">
      <h2 style="font-size: 28px; font-weight: 700; color: #1d1d1f; margin: 0 0 8px 0; letter-spacing: -0.5px; line-height: 1.2;">
        Olá, {{nome}} 👋
      </h2>
      <p style="font-size: 16px; color: #86868b; margin: 0 0 32px 0; line-height: 1.6;">
        Temos novidades incríveis para compartilhar com você.
      </p>
      
      <div style="border-top: 1px solid #e5e5ea; padding-top: 32px; margin-bottom: 32px;">
        <h3 style="font-size: 20px; font-weight: 600; color: #1d1d1f; margin: 0 0 12px 0;">
          Sua performance hoje
        </h3>
        <p style="font-size: 16px; color: #424245; margin: 0 0 24px 0; line-height: 1.6;">
          Você está no caminho certo para bater suas metas. Continue assim! 🚀
        </p>
      </div>
      
      <!-- CTA Button -->
      <div style="text-align: center; padding: 8px 0;">
        <a href="#" style="display: inline-block; background: linear-gradient(135deg, #6C63FF, #4F46E5); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 12px; font-size: 16px; font-weight: 600; letter-spacing: -0.2px;">
          Ver Dashboard →
        </a>
      </div>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0;">
      <p style="font-size: 12px; color: #8e8e93; margin: 0; line-height: 1.5;">
        Enviado com ❤️ pela sua equipe de gestão.<br/>
        Se não deseja mais receber estes emails, entre em contato com seu gestor.
      </p>
    </div>
  </div>
</div>`;

const NUBANK_TEMPLATE = `<div style="background-color: #f0ecfc; padding: 40px 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto;">
    <!-- Header -->
    <div style="text-align: center; padding: 24px 0;">
      <div style="display: inline-block; background: #8B5CF6; width: 48px; height: 48px; border-radius: 12px; line-height: 48px; text-align: center;">
        <span style="color: white; font-size: 24px; font-weight: 700;">S</span>
      </div>
    </div>
    
    <!-- Main Card -->
    <div style="background: #ffffff; border-radius: 20px; padding: 48px 40px; margin-bottom: 16px; box-shadow: 0 2px 16px rgba(139, 92, 246, 0.08);">
      <p style="font-size: 14px; color: #8B5CF6; font-weight: 600; text-transform: uppercase; letter-spacing: 1.5px; margin: 0 0 16px 0;">
        {{role}}
      </p>
      <h2 style="font-size: 32px; font-weight: 800; color: #1a1a2e; margin: 0 0 16px 0; letter-spacing: -0.8px; line-height: 1.15;">
        {{nome}}, seu resumo está pronto.
      </h2>
      <p style="font-size: 17px; color: #6b7280; margin: 0 0 40px 0; line-height: 1.7;">
        Preparamos uma análise completa da sua performance. Confira seus números e descubra como melhorar ainda mais.
      </p>
      
      <!-- Metrics Cards -->
      <div style="display: flex; gap: 12px; margin-bottom: 40px;">
        <div style="flex: 1; background: #f5f3ff; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="font-size: 28px; font-weight: 800; color: #7c3aed; margin: 0;">12</p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Conexões</p>
        </div>
        <div style="flex: 1; background: #ecfdf5; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="font-size: 28px; font-weight: 800; color: #059669; margin: 0;">5</p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Reuniões</p>
        </div>
        <div style="flex: 1; background: #fef3c7; border-radius: 12px; padding: 20px; text-align: center;">
          <p style="font-size: 28px; font-weight: 800; color: #d97706; margin: 0;">87%</p>
          <p style="font-size: 12px; color: #6b7280; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 0.5px;">Meta</p>
        </div>
      </div>
      
      <!-- CTA -->
      <a href="#" style="display: block; background: linear-gradient(135deg, #8B5CF6, #6D28D9); color: #ffffff; text-decoration: none; padding: 18px 32px; border-radius: 14px; font-size: 16px; font-weight: 700; text-align: center; letter-spacing: -0.2px;">
        Acessar meu dashboard completo
      </a>
    </div>
    
    <!-- Footer -->
    <div style="text-align: center; padding: 24px 0;">
      <p style="font-size: 12px; color: #9ca3af; margin: 0; line-height: 1.6;">
        Este email foi gerado automaticamente.<br/>
        © 2026 • Sistema de Gestão Comercial
      </p>
    </div>
  </div>
</div>`;

const STARTER_TEMPLATES = [
  { label: 'Apple Clean', value: 'apple', preview: '🍎 Minimalista, tipografia elegante' },
  { label: 'Nubank Card', value: 'nubank', preview: '💜 Cards coloridos, métricas visuais' },
  { label: 'Em branco', value: 'blank', preview: '📝 Começar do zero' },
];

export default function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [aiEmailPrompt, setAiEmailPrompt] = useState('');
  const [showStarterPicker, setShowStarterPicker] = useState(!template && !bodyHtml);
  const { toast } = useToast();

  const handlePickStarter = (value: string) => {
    if (value === 'apple') setBodyHtml(APPLE_TEMPLATE);
    else if (value === 'nubank') setBodyHtml(NUBANK_TEMPLATE);
    setShowStarterPicker(false);
  };

  const handleGenerateEmailBody = async () => {
    if (!aiEmailPrompt.trim()) return;
    setIsGeneratingAi(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email-campaign', {
        body: { prompt: `Gere APENAS o HTML de um único email (sem fluxo): ${aiEmailPrompt}`, sources: ['knowledge'] },
      });
      if (error) throw error;
      if (data?.flow?.nodes) {
        const emailNode = data.flow.nodes.find((n: any) => n.type === 'email');
        if (emailNode?.data?.body) {
          setBodyHtml(emailNode.data.body);
          toast({ title: "HTML gerado com sucesso!" });
        }
      }
    } catch (e: any) {
      toast({ title: "Erro ao gerar", description: e.message, variant: "destructive" });
    } finally {
      setIsGeneratingAi(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim() || !subject.trim() || !bodyHtml.trim()) {
      toast({ title: "Preencha todos os campos", variant: "destructive" });
      return;
    }
    setIsSaving(true);
    try {
      if (template) {
        const { error } = await supabase
          .from('email_templates' as any)
          .update({ name, subject, body_html: bodyHtml } as any)
          .eq('id', template.id);
        if (error) throw error;
        toast({ title: "Template atualizado!" });
      } else {
        const { error } = await supabase
          .from('email_templates' as any)
          .insert({ name, subject, body_html: bodyHtml } as any);
        if (error) throw error;
        toast({ title: "Template criado!" });
      }
      onSave();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const getPreviewHtml = () => {
    return bodyHtml
      .replace(/\{\{nome\}\}/g, 'João Silva')
      .replace(/\{\{email\}\}/g, 'joao@email.com')
      .replace(/\{\{role\}\}/g, 'SDR')
      .replace(/\{\{metricas_hoje\}\}/g, '12 conexões, 5 reuniões')
      .replace(/\{\{progresso_meta\}\}/g, '87%');
  };

  if (showStarterPicker) {
    return (
      <div className="h-[calc(100vh-4rem)] flex flex-col">
        <div className="flex items-center gap-3 p-4 border-b bg-background">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">Novo Template</h2>
            <p className="text-sm text-muted-foreground">Escolha um estilo para começar</p>
          </div>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="grid gap-4 md:grid-cols-3 max-w-3xl w-full">
            {STARTER_TEMPLATES.map((st) => (
              <button
                key={st.value}
                onClick={() => handlePickStarter(st.value)}
                className="group p-6 rounded-2xl border-2 border-border hover:border-primary hover:bg-primary/5 transition-all text-left"
              >
                <div className="text-3xl mb-3">{st.preview.split(' ')[0]}</div>
                <h3 className="font-bold text-foreground mb-1">{st.label}</h3>
                <p className="text-xs text-muted-foreground">{st.preview.substring(st.preview.indexOf(' ') + 1)}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h2 className="text-xl font-bold">{template ? 'Editar Template' : 'Novo Template'}</h2>
            <p className="text-sm text-muted-foreground">Editor de Email</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsPreviewOpen(true)}>
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Salvar
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Template</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas Equipe" />
            </div>
            <div className="space-y-2">
              <Label>Assunto do Email</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Bem-vindo à equipe, {{nome}}!" />
            </div>
          </div>

          {/* AI Generator */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Gerar corpo com IA</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={aiEmailPrompt}
                onChange={(e) => setAiEmailPrompt(e.target.value)}
                placeholder="Ex: Email de boas-vindas motivacional para novos SDRs..."
                className="flex-1"
              />
              <Button size="sm" onClick={handleGenerateEmailBody} disabled={isGeneratingAi || !aiEmailPrompt.trim()}>
                {isGeneratingAi ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <Tabs defaultValue="code">
            <TabsList>
              <TabsTrigger value="code" className="gap-1.5"><Code className="h-3.5 w-3.5" />HTML</TabsTrigger>
              <TabsTrigger value="preview" className="gap-1.5"><Eye className="h-3.5 w-3.5" />Preview</TabsTrigger>
            </TabsList>
            <TabsContent value="code" className="mt-3">
              <Textarea
                value={bodyHtml}
                onChange={(e) => setBodyHtml(e.target.value)}
                placeholder="<h1>Olá {{nome}}!</h1><p>Seja bem-vindo...</p>"
                rows={20}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-2">
                Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{role}}"}, {"{{metricas_hoje}}"}, {"{{progresso_meta}}"}
              </p>
            </TabsContent>
            <TabsContent value="preview" className="mt-3">
              <div className="rounded-xl border overflow-hidden">
                <div className="p-3 bg-muted border-b flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-destructive/60" />
                    <div className="w-3 h-3 rounded-full bg-yellow-500/60" />
                    <div className="w-3 h-3 rounded-full bg-green-500/60" />
                  </div>
                  <p className="text-xs text-muted-foreground ml-2 truncate">
                    <strong>Assunto:</strong> {subject.replace(/\{\{nome\}\}/g, 'João Silva')}
                  </p>
                </div>
                <div className="bg-white">
                  <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>Preview do Email</DialogTitle>
          </DialogHeader>
          <div className="p-3 mx-6 bg-muted rounded-lg">
            <p className="text-sm"><strong>Assunto:</strong> {subject.replace(/\{\{nome\}\}/g, 'João Silva')}</p>
          </div>
          <div className="bg-white mx-6 mb-6 rounded-lg overflow-hidden border">
            <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
