import { useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save, Loader2, Eye } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

interface TemplateEditorProps {
  template: { id: string; name: string; subject: string; body_html: string } | null;
  onSave: () => void;
  onClose: () => void;
}

export default function TemplateEditor({ template, onSave, onClose }: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [subject, setSubject] = useState(template?.subject || '');
  const [bodyHtml, setBodyHtml] = useState(template?.body_html || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const { toast } = useToast();

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
      .replace(/\{\{role\}\}/g, 'SDR');
  };

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
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="space-y-2">
            <Label>Nome do Template</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Boas-vindas Equipe" />
          </div>
          <div className="space-y-2">
            <Label>Assunto do Email</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Bem-vindo à equipe, {{nome}}!" />
          </div>
          <div className="space-y-2">
            <Label>Corpo do Email (HTML)</Label>
            <Textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              placeholder="<h1>Olá {{nome}}!</h1><p>Seja bem-vindo...</p>"
              rows={15}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Variáveis: {"{{nome}}"}, {"{{email}}"}, {"{{role}}"}, {"{{metricas_hoje}}"}, {"{{progresso_meta}}"}
            </p>
          </div>
        </div>
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Preview do Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm"><strong>Assunto:</strong> {subject.replace(/\{\{nome\}\}/g, 'João Silva')}</p>
            </div>
            <div className="p-4 border rounded-lg bg-white text-black">
              <div dangerouslySetInnerHTML={{ __html: getPreviewHtml() }} />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
