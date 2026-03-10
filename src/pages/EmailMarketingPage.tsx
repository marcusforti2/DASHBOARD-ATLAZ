import { useState, useEffect, useRef, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Plus, Loader2, Mail, Workflow, Sparkles, Play, Pause, Trash2, Edit3,
  LayoutTemplate, Zap, Clock, Users, TrendingUp, Copy, History, CheckCircle2,
  XCircle, Send, Upload, FileText, UserPlus, X,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const FlowEditor = lazy(() => import("@/components/email/FlowEditor"));
const TemplateEditor = lazy(() => import("@/components/email/TemplateEditor"));

interface EmailFlow {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  nodes: any;
  edges: any;
  created_at: string;
  audience_type?: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body_html: string;
  created_at: string;
}

interface FlowStats {
  flow_id: string;
  total_executions: number;
  last_sent: string | null;
  success_count: number;
  error_count: number;
}

interface ExecutionRecord {
  id: string;
  flow_id: string;
  member_id: string | null;
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

interface SendLog {
  id: string;
  flow_id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  error_message: string | null;
  sent_at: string;
}

export default function EmailMarketingPage() {
  const [flows, setFlows] = useState<EmailFlow[]>([]);
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("flows");
  const [totalEmailsSent, setTotalEmailsSent] = useState(0);
  const [flowStatsMap, setFlowStatsMap] = useState<Map<string, FlowStats>>(new Map());

  const [selectedFlow, setSelectedFlow] = useState<EmailFlow | null>(null);
  const [isFlowEditorOpen, setIsFlowEditorOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<EmailTemplate | null>(null);
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false);

  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiContext, setAiContext] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [isNewFlowDialogOpen, setIsNewFlowDialogOpen] = useState(false);
  const [newFlowName, setNewFlowName] = useState("");
  const [newFlowDescription, setNewFlowDescription] = useState("");

  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [historyFlowId, setHistoryFlowId] = useState<string | null>(null);
  const [sendLogs, setSendLogs] = useState<SendLog[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const [isSending, setIsSending] = useState<string | null>(null);

  // Import contacts state
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFlowId, setImportFlowId] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importText, setImportText] = useState("");
  const [flowContactCounts, setFlowContactCounts] = useState<Map<string, number>>(new Map());
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [contactsFlowId, setContactsFlowId] = useState<string | null>(null);
  const [flowContacts, setFlowContacts] = useState<{ id: string; email: string; name: string | null; source_file: string | null }[]>([]);
  const [isContactsLoading, setIsContactsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { toast } = useToast();

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const { data: flowsData } = await supabase
        .from('email_flows' as any)
        .select('*')
        .order('created_at', { ascending: false });
      setFlows((flowsData as any[]) || []);

      const { data: templatesData } = await supabase
        .from('email_templates' as any)
        .select('*')
        .order('created_at', { ascending: false });
      setTemplates((templatesData as any[]) || []);

      if (flowsData && flowsData.length > 0) {
        const flowIds = (flowsData as any[]).map((f: any) => f.id);
        const { data: executions } = await supabase
          .from('email_flow_executions' as any)
          .select('id, flow_id, status, started_at')
          .in('flow_id', flowIds);

        if (executions) {
          setTotalEmailsSent(executions.length);
          const statsMap = new Map<string, FlowStats>();
          for (const exec of executions as any[]) {
            const existing = statsMap.get(exec.flow_id);
            if (existing) {
              existing.total_executions++;
              if (exec.status === 'completed') existing.success_count++;
              else if (exec.status === 'failed') existing.error_count++;
              if (exec.started_at && (!existing.last_sent || exec.started_at > existing.last_sent)) existing.last_sent = exec.started_at;
            } else {
              statsMap.set(exec.flow_id, {
                flow_id: exec.flow_id,
                total_executions: 1,
                last_sent: exec.started_at,
                success_count: exec.status === 'completed' ? 1 : 0,
                error_count: exec.status === 'failed' ? 1 : 0,
              });
            }
          }
          setFlowStatsMap(statsMap);
        }
      }

      // Fetch contact counts per flow
      if (flowsData && flowsData.length > 0) {
        const flowIds = (flowsData as any[]).map((f: any) => f.id);
        const { data: contacts } = await supabase
          .from('email_flow_contacts' as any)
          .select('flow_id')
          .in('flow_id', flowIds);
        if (contacts) {
          const countMap = new Map<string, number>();
          for (const c of contacts as any[]) {
            countMap.set(c.flow_id, (countMap.get(c.flow_id) || 0) + 1);
          }
          setFlowContactCounts(countMap);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFlow = async () => {
    if (!newFlowName.trim()) return;
    try {
      const { data, error } = await supabase
        .from('email_flows' as any)
        .insert({ name: newFlowName, description: newFlowDescription || null, nodes: [], edges: [] } as any)
        .select()
        .single();
      if (error) throw error;
      setFlows([data as any, ...flows]);
      setIsNewFlowDialogOpen(false);
      setNewFlowName("");
      setNewFlowDescription("");
      setSelectedFlow(data as any);
      setIsFlowEditorOpen(true);
      toast({ title: "Fluxo criado!" });
    } catch (error: any) {
      toast({ title: "Erro ao criar fluxo", description: error.message, variant: "destructive" });
    }
  };

  const handleDuplicateFlow = async (flow: EmailFlow) => {
    try {
      const { data, error } = await supabase
        .from('email_flows' as any)
        .insert({ name: `Cópia de ${flow.name}`, description: flow.description, nodes: flow.nodes, edges: flow.edges, audience_type: flow.audience_type, is_active: false } as any)
        .select()
        .single();
      if (error) throw error;
      setFlows([data as any, ...flows]);
      toast({ title: "Fluxo duplicado!" });
    } catch (error: any) {
      toast({ title: "Erro ao duplicar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleFlowActive = async (flowId: string, currentState: boolean) => {
    try {
      const { error } = await supabase.from('email_flows' as any).update({ is_active: !currentState } as any).eq('id', flowId);
      if (error) throw error;
      setFlows(flows.map(f => f.id === flowId ? { ...f, is_active: !currentState } : f));
      toast({ title: !currentState ? "Fluxo ativado!" : "Fluxo pausado" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleDeleteFlow = async (flowId: string) => {
    try {
      const { error } = await supabase.from('email_flows' as any).delete().eq('id', flowId);
      if (error) throw error;
      setFlows(flows.filter(f => f.id !== flowId));
      toast({ title: "Fluxo removido" });
    } catch (error: any) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    }
  };

  const handleExecuteFlow = async (flowId: string) => {
    setIsSending(flowId);
    try {
      const { data, error } = await supabase.functions.invoke('execute-email-flow', {
        body: { flowId, immediate: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "Emails enviados!", description: data.message });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao enviar", description: error.message, variant: "destructive" });
    } finally {
      setIsSending(null);
    }
  };

  const handleOpenHistory = async (flowId: string) => {
    setHistoryFlowId(flowId);
    setIsHistoryOpen(true);
    setIsHistoryLoading(true);
    try {
      const { data } = await supabase
        .from('email_send_logs' as any)
        .select('*')
        .eq('flow_id', flowId)
        .order('sent_at', { ascending: false })
        .limit(100);
      setSendLogs((data as any[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleGenerateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast({ title: "Digite uma descrição para a campanha", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-email-campaign', {
        body: { prompt: aiPrompt, context: aiContext || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (data?.flow) {
        setFlows([data.flow, ...flows]);
        toast({ title: "Campanha gerada com sucesso!", description: data.flow.name });
      }
      setIsAIDialogOpen(false);
      setAiPrompt("");
    } catch (error: any) {
      toast({ title: "Erro ao gerar campanha", description: error.message || "Tente novamente", variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveFlow = async (flowId: string, nodes: any[], edges: any[], audienceType: string, name?: string, description?: string) => {
    try {
      const updateData: any = { nodes, edges, audience_type: audienceType };
      if (name) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      const { error } = await supabase.from('email_flows' as any).update(updateData).eq('id', flowId);
      if (error) throw error;
      setFlows(flows.map(f => f.id === flowId ? { ...f, ...updateData } : f));
      toast({ title: "Fluxo salvo!" });
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  // === Import Contacts Handlers ===
  const handleOpenImport = (flowId: string) => {
    setImportFlowId(flowId);
    setImportText("");
    setIsImportOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !importFlowId) return;
    const fileName = file.name;
    try {
      const content = await file.text();
      setIsImporting(true);
      const { data, error } = await supabase.functions.invoke('parse-email-list', {
        body: { flowId: importFlowId, content: content.substring(0, 100000), fileName },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `${data.count} emails importados!`, description: `Arquivo: ${fileName}` });
      setIsImportOpen(false);
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportFromText = async () => {
    if (!importText.trim() || !importFlowId) return;
    setIsImporting(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-email-list', {
        body: { flowId: importFlowId, content: importText, fileName: 'texto-colado.txt' },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: `${data.count} emails importados!` });
      setIsImportOpen(false);
      setImportText("");
      fetchData();
    } catch (err: any) {
      toast({ title: "Erro ao importar", description: err.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  const handleViewContacts = async (flowId: string) => {
    setContactsFlowId(flowId);
    setIsContactsOpen(true);
    setIsContactsLoading(true);
    try {
      const { data } = await supabase
        .from('email_flow_contacts' as any)
        .select('id, email, name, source_file')
        .eq('flow_id', flowId)
        .order('created_at', { ascending: false });
      setFlowContacts((data as any[]) || []);
    } catch (e) {
      console.error(e);
    } finally {
      setIsContactsLoading(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await supabase.from('email_flow_contacts' as any).delete().eq('id', contactId);
      setFlowContacts(prev => prev.filter(c => c.id !== contactId));
      fetchData();
    } catch (e) { console.error(e); }
  };

  const handleClearContacts = async (flowId: string) => {
    try {
      await supabase.from('email_flow_contacts' as any).delete().eq('flow_id', flowId);
      setFlowContacts([]);
      setIsContactsOpen(false);
      fetchData();
      toast({ title: "Contatos removidos" });
    } catch (e) { console.error(e); }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  if (isFlowEditorOpen && selectedFlow) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <FlowEditor
          flow={selectedFlow}
          templates={templates}
          onSave={(nodes, edges, audienceType, name, description) => handleSaveFlow(selectedFlow.id, nodes, edges, audienceType, name, description)}
          onClose={() => { setIsFlowEditorOpen(false); setSelectedFlow(null); }}
        />
      </Suspense>
    );
  }

  if (isTemplateEditorOpen) {
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-[calc(100vh-8rem)]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}>
        <TemplateEditor
          template={selectedTemplate}
          onSave={() => { fetchData(); setIsTemplateEditorOpen(false); setSelectedTemplate(null); }}
          onClose={() => { setIsTemplateEditorOpen(false); setSelectedTemplate(null); }}
        />
      </Suspense>
    );
  }

  const successRate = totalEmailsSent > 0
    ? Math.round(([...flowStatsMap.values()].reduce((acc, s) => acc + s.success_count, 0) / totalEmailsSent) * 100)
    : 0;

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Email Marketing</h1>
          <p className="text-sm text-muted-foreground">Crie fluxos de automação e campanhas inteligentes para sua equipe</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAIDialogOpen(true)}>
            <Sparkles className="h-4 w-4 mr-2" />
            Criar com IA
          </Button>
          <Button onClick={() => setIsNewFlowDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Fluxo
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center"><Workflow className="h-5 w-5 text-primary" /></div><div><p className="text-2xl font-bold">{flows.length}</p><p className="text-xs text-muted-foreground">Fluxos</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center"><Zap className="h-5 w-5 text-green-500" /></div><div><p className="text-2xl font-bold text-green-500">{flows.filter(f => f.is_active).length}</p><p className="text-xs text-muted-foreground">Ativos</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-accent/20 flex items-center justify-center"><Send className="h-5 w-5 text-accent" /></div><div><p className="text-2xl font-bold">{totalEmailsSent}</p><p className="text-xs text-muted-foreground">Enviados</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-4"><div className="flex items-center gap-3"><div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center"><TrendingUp className="h-5 w-5 text-amber-500" /></div><div><p className="text-2xl font-bold">{successRate}%</p><p className="text-xs text-muted-foreground">Sucesso</p></div></div></CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="flows" className="gap-2"><Workflow className="h-4 w-4" />Fluxos</TabsTrigger>
          <TabsTrigger value="templates" className="gap-2"><LayoutTemplate className="h-4 w-4" />Templates</TabsTrigger>
        </TabsList>

        <TabsContent value="flows" className="mt-4">
          {flows.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Workflow className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Nenhum fluxo criado</p><Button className="mt-4" onClick={() => setIsNewFlowDialogOpen(true)}><Plus className="h-4 w-4 mr-2" />Criar Fluxo</Button></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {flows.map((flow) => {
                const stats = flowStatsMap.get(flow.id);
                const emailNodes = (flow.nodes || []).filter((n: any) => n.type === 'email');
                return (
                  <Card key={flow.id} className="hover:shadow-lg transition-all group">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate">{flow.name}</h3>
                          {flow.description && <p className="text-xs text-muted-foreground mt-0.5 truncate">{flow.description}</p>}
                        </div>
                        <Badge variant={flow.is_active ? "default" : "secondary"} className="text-[10px] shrink-0 ml-2">
                          {flow.is_active ? "Ativo" : "Pausado"}
                        </Badge>
                      </div>

                      {/* Contacts & Stats row */}
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{emailNodes.length} emails</span>
                        {stats && <span className="flex items-center gap-1"><Send className="h-3 w-3" />{stats.total_executions} envios</span>}
                        {(flowContactCounts.get(flow.id) || 0) > 0 && (
                          <button
                            className="flex items-center gap-1 text-primary hover:underline cursor-pointer"
                            onClick={() => handleViewContacts(flow.id)}
                          >
                            <UserPlus className="h-3 w-3" />
                            {flowContactCounts.get(flow.id)} contatos
                          </button>
                        )}
                      </div>

                      <div className="flex gap-1.5 flex-wrap">
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => { setSelectedFlow(flow); setIsFlowEditorOpen(true); }}>
                          <Edit3 className="h-3 w-3 mr-1" />Editar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleOpenImport(flow.id)}>
                          <Upload className="h-3 w-3 mr-1" />Importar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleToggleFlowActive(flow.id, flow.is_active)}>
                          {flow.is_active ? <Pause className="h-3 w-3 mr-1" /> : <Play className="h-3 w-3 mr-1" />}
                          {flow.is_active ? "Pausar" : "Ativar"}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-[10px]"
                          onClick={() => handleExecuteFlow(flow.id)}
                          disabled={isSending === flow.id || emailNodes.length === 0}
                        >
                          {isSending === flow.id ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Send className="h-3 w-3 mr-1" />}
                          Enviar
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleDuplicateFlow(flow)}>
                          <Copy className="h-3 w-3 mr-1" />
                        </Button>
                        <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleOpenHistory(flow.id)}>
                          <History className="h-3 w-3 mr-1" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-[10px] text-destructive hover:text-destructive" onClick={() => handleDeleteFlow(flow.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="templates" className="mt-4">
          <div className="flex justify-end mb-4">
            <Button size="sm" onClick={() => { setSelectedTemplate(null); setIsTemplateEditorOpen(true); }}>
              <Plus className="h-4 w-4 mr-2" />
              Novo Template
            </Button>
          </div>
          {templates.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><LayoutTemplate className="h-12 w-12 text-muted-foreground mx-auto mb-4" /><p className="text-muted-foreground">Nenhum template criado</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((tpl) => (
                <Card key={tpl.id} className="hover:shadow-lg transition-all cursor-pointer" onClick={() => { setSelectedTemplate(tpl); setIsTemplateEditorOpen(true); }}>
                  <CardContent className="p-5">
                    <h3 className="font-bold text-sm mb-1">{tpl.name}</h3>
                    <p className="text-xs text-muted-foreground truncate">{tpl.subject}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {format(new Date(tpl.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* AI Campaign Dialog */}
      <Dialog open={isAIDialogOpen} onOpenChange={setIsAIDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Criar Campanha com IA</DialogTitle>
            <DialogDescription>Descreva a campanha e escolha de onde a IA puxa o contexto</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              placeholder="Ex: Campanha de boas-vindas para novos SDRs com 3 emails motivacionais espaçados de 2 dias..."
              rows={4}
            />
            <div className="space-y-2">
              <Label className="text-sm font-medium">Fontes de Conhecimento</Label>
              <p className="text-xs text-muted-foreground">Selecione de onde a IA deve puxar contexto para gerar os emails</p>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {[
                  { id: 'knowledge', label: 'Base de Conhecimento', desc: 'ICP, produtos, objeções', icon: '📚' },
                  { id: 'metrics', label: 'Métricas & Metas', desc: 'Performance da equipe', icon: '📊' },
                  { id: 'team', label: 'Dados do Time', desc: 'SDRs, Closers ativos', icon: '👥' },
                  { id: 'playbooks', label: 'Playbooks', desc: 'Roteiros e processos', icon: '📋' },
                ].map((source) => {
                  const isSelected = aiSources.includes(source.id);
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setAiSources(prev => isSelected ? prev.filter(s => s !== source.id) : [...prev, source.id])}
                      className={`flex items-start gap-2 p-3 rounded-lg border text-left transition-all ${
                        isSelected ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <span className="text-lg">{source.icon}</span>
                      <div>
                        <p className="text-xs font-medium">{source.label}</p>
                        <p className="text-[10px] text-muted-foreground">{source.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAIDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleGenerateWithAI} disabled={isGenerating}>
              {isGenerating ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Gerando...</> : <><Sparkles className="h-4 w-4 mr-2" />Gerar Campanha</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Flow Dialog */}
      <Dialog open={isNewFlowDialogOpen} onOpenChange={setIsNewFlowDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Fluxo de Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Fluxo</Label>
              <Input value={newFlowName} onChange={(e) => setNewFlowName(e.target.value)} placeholder="Ex: Onboarding SDRs" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={newFlowDescription} onChange={(e) => setNewFlowDescription(e.target.value)} placeholder="Descrição do fluxo..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewFlowDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateFlow} disabled={!newFlowName.trim()}>Criar Fluxo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><History className="h-5 w-5" />Histórico de Envios</DialogTitle>
            <DialogDescription>
              {sendLogs.length > 0 && `${sendLogs.filter(l => l.status === 'sent').length} enviados · ${sendLogs.filter(l => l.status === 'failed').length} falharam`}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px]">
            {isHistoryLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : sendLogs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum envio registrado</p>
            ) : (
              <div className="space-y-2">
                {sendLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg border">
                    {log.status === 'sent' ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">{log.recipient_name || log.recipient_email}</p>
                        <Badge variant={log.status === 'sent' ? 'default' : 'destructive'} className="text-[9px] h-4 shrink-0">
                          {log.status === 'sent' ? 'Enviado' : 'Falhou'}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground truncate">{log.recipient_email}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">Assunto: {log.subject}</p>
                      <p className="text-[10px] text-muted-foreground">{format(new Date(log.sent_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
                      {log.error_message && <p className="text-[10px] text-destructive truncate mt-0.5">{log.error_message}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Import Contacts Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Upload className="h-5 w-5 text-primary" />Importar Lista de Emails</DialogTitle>
            <DialogDescription>Suba um arquivo (CSV, TXT, Excel) ou cole o texto com os emails. A IA vai extrair e organizar automaticamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* File upload */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Upload de Arquivo</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt,.xlsx,.xls,.tsv,.md"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button
                variant="outline"
                className="w-full h-20 border-dashed flex flex-col gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
              >
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">CSV, TXT, Excel, TSV</span>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">ou</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Paste text */}
            <div>
              <Label className="text-sm font-medium mb-2 block">Cole o Texto</Label>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder={"Exemplo:\nJoão Silva, joao@empresa.com\nMaria Souza, maria@teste.com\n\nOu cole qualquer formato — a IA organiza"}
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsImportOpen(false)}>Cancelar</Button>
            <Button onClick={handleImportFromText} disabled={isImporting || !importText.trim()}>
              {isImporting ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />Processando...</> : <><Sparkles className="h-4 w-4 mr-2" />Extrair Emails</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Contacts List Dialog */}
      <Dialog open={isContactsOpen} onOpenChange={setIsContactsOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Users className="h-5 w-5" />Contatos Importados</DialogTitle>
            <DialogDescription>{flowContacts.length} contato(s) nesta campanha</DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[350px]">
            {isContactsLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
            ) : flowContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum contato importado</p>
            ) : (
              <div className="space-y-1.5">
                {flowContacts.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-lg border group">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {(c.name || c.email).charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      {c.name && <p className="text-xs font-medium truncate">{c.name}</p>}
                      <p className="text-[10px] text-muted-foreground truncate">{c.email}</p>
                      {c.source_file && <p className="text-[9px] text-muted-foreground/60">{c.source_file}</p>}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-destructive"
                      onClick={() => handleDeleteContact(c.id)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
          {flowContacts.length > 0 && contactsFlowId && (
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => handleOpenImport(contactsFlowId)}>
                <Plus className="h-3 w-3 mr-1" />Adicionar Mais
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleClearContacts(contactsFlowId)}>
                <Trash2 className="h-3 w-3 mr-1" />Limpar Todos
              </Button>
            </DialogFooter>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
