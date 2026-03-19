import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import {
  Bot, Brain, MessageSquare, Zap, Users, Phone, Mail, FileText,
  Sparkles, Shield, AlertTriangle, CheckCircle2, XCircle, Eye,
  Linkedin, Search, TrendingUp, Clock, Target, Mic, Image,
  ArrowRight, ChevronDown, ChevronUp, RefreshCw, Loader2,
  Activity, Globe, Workflow, BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { WaInstance } from '@/hooks/use-wa-hub';

interface Props {
  instances: WaInstance[];
  teamMembers: { id: string; name: string; member_role: string }[];
}

// Agent catalog definition
const AGENTS = [
  {
    id: 'ai-sdr-agent',
    name: 'SDR IA',
    icon: Bot,
    category: 'core',
    description: 'Prospecção, qualificação e agendamento de reuniões via WhatsApp',
    capabilities: ['Resposta automática', 'Qualificação por score A/B/C', 'Agendamento Google Calendar', 'Follow-up automático', 'Handoff para humano', 'Lead scoring'],
    contextSources: ['company_knowledge (Master Prompt)', 'ai_sdr_config por instância', 'linkedin_context por conversa', 'wa_tags', 'Google Calendar'],
    model: 'google/gemini-3-flash-preview',
    triggerType: 'Webhook (mensagem recebida) ou Proativo (cadastro)',
    status: 'active' as const,
  },
  {
    id: 'jarvis-agent',
    name: 'TITAN',
    icon: Brain,
    category: 'core',
    description: 'Assistente estratégico do gestor com 40+ funções do sistema',
    capabilities: ['Diagnóstico comercial', 'CRUD em metas/conhecimento', 'Consultas históricas', 'Navegação por Action Markers', 'Automações do sistema'],
    contextSources: ['company_knowledge', 'daily_metrics', 'monthly_goals', 'team_members', 'training_courses'],
    model: 'google/gemini-3-flash-preview',
    triggerType: 'Chat direto (User Hub)',
    status: 'active' as const,
  },
  {
    id: 'ai-coach',
    name: 'AI Coach',
    icon: Target,
    category: 'core',
    description: 'Coaching personalizado para SDRs e Closers',
    capabilities: ['Coaching de vendas', 'Análise de performance', 'Dicas personalizadas', 'Roleplay de objeções'],
    contextSources: ['company_knowledge', 'daily_metrics', 'coach_conversations', 'agent_memory'],
    model: 'google/gemini-3-flash-preview',
    triggerType: 'Chat direto (User Hub)',
    status: 'active' as const,
  },
  {
    id: 'analyze-metrics',
    name: 'Análise de Métricas',
    icon: BarChart3,
    category: 'analytics',
    description: 'Relatórios analíticos sobre performance da equipe',
    capabilities: ['Relatório mensal', 'Comparativo semanal', 'Tendências', 'Recomendações'],
    contextSources: ['daily_metrics', 'monthly_goals', 'team_members'],
    model: 'google/gemini-2.5-flash',
    triggerType: 'Botão no Dashboard',
    status: 'active' as const,
  },
  {
    id: 'analyze-closer',
    name: 'Análise de Closer',
    icon: Phone,
    category: 'analytics',
    description: 'Análise de áudios/transcrições de ligações do closer',
    capabilities: ['Transcrição de áudio', 'Avaliação de técnica', 'Score de qualidade', 'Pontos de melhoria'],
    contextSources: ['closer_analyses', 'company_knowledge'],
    model: 'google/gemini-2.5-flash',
    triggerType: 'Upload de arquivo',
    status: 'active' as const,
  },
  {
    id: 'analyze-test',
    name: 'DNA Vendedor',
    icon: Sparkles,
    category: 'analytics',
    description: 'Análise de perfil comportamental de vendedores',
    capabilities: ['Perfil DISC adaptado', 'Pontos fortes/fracos', 'Recomendações de desenvolvimento'],
    contextSources: ['test_submissions', 'test_answers', 'dna-questions'],
    model: 'google/gemini-2.5-flash',
    triggerType: 'Conclusão de teste',
    status: 'active' as const,
  },
  {
    id: 'rewrite-message',
    name: 'Reescritor de Mensagens',
    icon: FileText,
    category: 'tools',
    description: 'Reescrita inteligente de mensagens para WhatsApp',
    capabilities: ['Tom profissional', 'Tom casual', 'Encurtamento', 'Persuasão'],
    contextSources: ['Mensagem original do usuário'],
    model: 'google/gemini-2.5-flash',
    triggerType: 'Botão no chat',
    status: 'active' as const,
  },
  {
    id: 'linkedin-scraper',
    name: 'Enriquecimento LinkedIn',
    icon: Linkedin,
    category: 'tools',
    description: 'Busca dados do perfil LinkedIn via Piloterr',
    capabilities: ['Nome/Cargo/Empresa', 'Headline', 'Experiência', 'Localização'],
    contextSources: ['Piloterr API', 'linkedin_url do lead'],
    model: 'N/A (API externa)',
    triggerType: 'Botão no CRM ou automático no cadastro',
    status: 'active' as const,
  },
  {
    id: 'generate-knowledge',
    name: 'Gerador de Knowledge Base',
    icon: Globe,
    category: 'tools',
    description: 'Gera documentos de conhecimento da empresa via IA',
    capabilities: ['Master Prompt', 'ICP', 'Dores/Desejos', 'FAQ'],
    contextSources: ['company_knowledge existente'],
    model: 'google/gemini-2.5-flash',
    triggerType: 'Botão no Admin',
    status: 'active' as const,
  },
  {
    id: 'daily-whatsapp-report',
    name: 'Relatório Diário WhatsApp',
    icon: Mail,
    category: 'automation',
    description: 'Envia relatório diário de métricas da equipe via WhatsApp',
    capabilities: ['Ranking do dia', 'Métricas consolidadas', 'Dicas de coaching'],
    contextSources: ['daily_metrics', 'monthly_goals', 'team_members', 'WhatsApp templates'],
    model: 'google/gemini-2.5-flash',
    triggerType: 'Cron / Manual',
    status: 'active' as const,
  },
  {
    id: 'generate-sticker',
    name: 'Gerador de Stickers',
    icon: Image,
    category: 'tools',
    description: 'Gera stickers personalizados para WhatsApp',
    capabilities: ['Stickers com IA', 'Formato WebP'],
    contextSources: ['Prompt do usuário'],
    model: 'google/gemini-3-pro-image-preview',
    triggerType: 'Botão no chat',
    status: 'active' as const,
  },
  {
    id: 'elevenlabs-tts',
    name: 'Voz (TTS/STT)',
    icon: Mic,
    category: 'tools',
    description: 'Transcrição de áudios e síntese de voz',
    capabilities: ['Transcrição de áudio (STT)', 'Geração de voz (TTS)'],
    contextSources: ['ElevenLabs API'],
    model: 'ElevenLabs Scribe v2 / Turbo v2.5',
    triggerType: 'Áudio recebido no chat',
    status: 'active' as const,
  },
];

const CATEGORY_LABELS: Record<string, { label: string; icon: typeof Bot }> = {
  core: { label: 'Agentes Core', icon: Brain },
  analytics: { label: 'Análise & Relatórios', icon: BarChart3 },
  tools: { label: 'Ferramentas', icon: Zap },
  automation: { label: 'Automações', icon: Workflow },
};

export function AiCommandCenter({ instances, teamMembers }: Props) {
  const [activeTab, setActiveTab] = useState('agents');
  const [contextStats, setContextStats] = useState<{
    total: number; withContext: number; withProfile: number; withoutContext: number;
  }>({ total: 0, withContext: 0, withProfile: 0, withoutContext: 0 });
  const [knowledgeStats, setKnowledgeStats] = useState<{ category: string; count: number; hasContent: boolean }[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoadingStats(true);
    try {
      const [convsResult, knowledgeResult] = await Promise.all([
        supabase.from('wa_conversations').select('id, linkedin_context, linkedin_profile, lead_stage, conversation_mode').limit(1000),
        supabase.from('company_knowledge').select('category, content, active'),
      ]);

      const convs = convsResult.data || [];
      const withCtx = convs.filter(c => (c as any).linkedin_context && (c as any).linkedin_context.trim().length > 0);
      const withProfile = convs.filter(c => {
        const lp = (c as any).linkedin_profile;
        return lp && typeof lp === 'object' && Object.keys(lp).length > 0;
      });

      setContextStats({
        total: convs.length,
        withContext: withCtx.length,
        withProfile: withProfile.length,
        withoutContext: convs.length - withCtx.length,
      });

      const knowledge = knowledgeResult.data || [];
      const categories = ['master_prompt', 'icp', 'pain_points', 'desires', 'faq', 'general', 'objections'];
      const stats = categories.map(cat => {
        const items = knowledge.filter(k => k.category === cat && k.active);
        return {
          category: cat,
          count: items.length,
          hasContent: items.some(k => k.content && k.content.trim().length > 10),
        };
      });
      setKnowledgeStats(stats);
    } catch (err) {
      console.error('Error fetching AI stats:', err);
    } finally {
      setLoadingStats(false);
    }
  };

  const categoryLabels: Record<string, string> = {
    master_prompt: 'Master Prompt',
    icp: 'ICP (Perfil Ideal)',
    pain_points: 'Dores do Público',
    desires: 'Desejos do Público',
    faq: 'FAQ',
    general: 'Conhecimento Geral',
    objections: 'Objeções',
  };

  const groupedAgents = useMemo(() => {
    const groups: Record<string, typeof AGENTS> = {};
    for (const agent of AGENTS) {
      if (!groups[agent.category]) groups[agent.category] = [];
      groups[agent.category].push(agent);
    }
    return groups;
  }, []);

  const sdrInstances = useMemo(() => 
    instances.filter(i => i.ai_sdr_enabled),
  [instances]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            AI Command Center
          </h2>
          <p className="text-xs text-muted-foreground">Visão completa de todos os agentes, contextos e fluxos de IA</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchStats} className="gap-1.5 text-xs">
          <RefreshCw className="w-3.5 h-3.5" /> Atualizar
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Agentes Ativos</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{AGENTS.length}</p>
          </CardContent>
        </Card>
        <Card className="bg-accent/50 border-accent">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Instâncias SDR</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">{sdrInstances.length}</p>
          </CardContent>
        </Card>
        <Card className={`border ${contextStats.withContext > 0 ? 'bg-primary/5 border-primary/20' : 'bg-destructive/5 border-destructive/20'}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Leads c/ Contexto</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {contextStats.withContext}<span className="text-sm text-muted-foreground">/{contextStats.total}</span>
            </p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-3">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Knowledge Base</span>
            </div>
            <p className="text-2xl font-bold text-foreground mt-1">
              {knowledgeStats.filter(k => k.hasContent).length}<span className="text-sm text-muted-foreground">/{knowledgeStats.length}</span>
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="agents" className="text-xs gap-1.5">
            <Bot className="w-3.5 h-3.5" /> Agentes
          </TabsTrigger>
          <TabsTrigger value="sdr-context" className="text-xs gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" /> SDR Config
          </TabsTrigger>
          <TabsTrigger value="lead-context" className="text-xs gap-1.5">
            <Users className="w-3.5 h-3.5" /> Contexto Leads
          </TabsTrigger>
          <TabsTrigger value="flow" className="text-xs gap-1.5">
            <Workflow className="w-3.5 h-3.5" /> Fluxo
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: Agent Catalog */}
        <TabsContent value="agents" className="mt-4 space-y-4">
          {Object.entries(groupedAgents).map(([category, agents]) => {
            const catInfo = CATEGORY_LABELS[category];
            return (
              <div key={category} className="space-y-2">
                <div className="flex items-center gap-2">
                  {catInfo && <catInfo.icon className="w-4 h-4 text-primary" />}
                  <h3 className="text-sm font-semibold text-foreground">{catInfo?.label || category}</h3>
                  <Badge variant="secondary" className="text-[10px]">{agents.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {agents.map(agent => {
                    const isExpanded = expandedAgent === agent.id;
                    return (
                      <Card key={agent.id} className="border hover:border-primary/30 transition-colors cursor-pointer"
                        onClick={() => setExpandedAgent(isExpanded ? null : agent.id)}>
                        <CardContent className="p-3">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                              <agent.icon className="w-4 h-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-foreground">{agent.name}</span>
                                <Badge className="text-[9px] bg-primary/15 text-primary border-primary/30 px-1.5 py-0">
                                  Ativo
                                </Badge>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{agent.description}</p>
                              
                              {isExpanded && (
                                <div className="mt-3 space-y-2 border-t pt-2">
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Modelo</p>
                                    <p className="text-xs text-foreground">{agent.model}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Gatilho</p>
                                    <p className="text-xs text-foreground">{agent.triggerType}</p>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Capacidades</p>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {agent.capabilities.map(cap => (
                                        <Badge key={cap} variant="outline" className="text-[9px] px-1.5 py-0">{cap}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Fontes de Contexto</p>
                                    <div className="flex flex-wrap gap-1 mt-0.5">
                                      {agent.contextSources.map(src => (
                                        <Badge key={src} variant="secondary" className="text-[9px] px-1.5 py-0">{src}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </TabsContent>

        {/* TAB 2: SDR Config per Instance */}
        <TabsContent value="sdr-context" className="mt-4 space-y-3">
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" /> Knowledge Base Global
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {knowledgeStats.map(k => (
                <Card key={k.category} className={`border ${k.hasContent ? 'border-primary/20' : 'border-destructive/30 bg-destructive/5'}`}>
                  <CardContent className="p-2.5">
                    <div className="flex items-center gap-1.5">
                      {k.hasContent ? <CheckCircle2 className="w-3.5 h-3.5 text-primary shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-destructive shrink-0" />}
                      <span className="text-[11px] font-medium text-foreground truncate">{categoryLabels[k.category] || k.category}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {k.hasContent ? `${k.count} documento${k.count !== 1 ? 's' : ''}` : 'Não configurado'}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" /> Configuração por Instância
            </h3>
            {instances.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma instância cadastrada</p>
            ) : (
              <div className="space-y-2">
                {instances.map(inst => {
                  const config = (inst as any).ai_sdr_config || {};
                  const closer = teamMembers.find(t => t.id === inst.closer_id);
                  const sdr = teamMembers.find(t => t.id === (inst as any).sdr_id);
                  const hasPrompt = !!config.ai_prompts?.trim();
                  const hasSources = (config.lead_sources || []).length > 0;
                  const hasQuestions = (config.qualification_questions || []).length > 0;
                  const hasTone = !!config.tone?.trim();
                  const checklist = [
                    { label: 'Prompts/Contexto', ok: hasPrompt },
                    { label: 'Fontes de Lead', ok: hasSources },
                    { label: 'Perguntas Qualificação', ok: hasQuestions },
                    { label: 'Tom de Voz', ok: hasTone },
                    { label: 'Closer', ok: !!inst.closer_id },
                    { label: 'SDR', ok: !!(inst as any).sdr_id },
                  ];
                  const score = checklist.filter(c => c.ok).length;
                  const pct = Math.round((score / checklist.length) * 100);

                  return (
                    <Card key={inst.id} className="border">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${inst.is_connected ? 'bg-primary' : 'bg-destructive'}`} />
                            <span className="text-sm font-semibold text-foreground">{inst.instance_name}</span>
                            {inst.ai_sdr_enabled && <Badge className="text-[9px] bg-primary/15 text-primary border-primary/30 px-1.5 py-0">SDR IA</Badge>}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{pct}% configurado</span>
                            <Progress value={pct} className="w-16 h-1.5" />
                          </div>
                        </div>
                        <div className="grid grid-cols-3 gap-1.5">
                          {checklist.map(item => (
                            <div key={item.label} className="flex items-center gap-1">
                              {item.ok ? <CheckCircle2 className="w-3 h-3 text-primary shrink-0" /> : <XCircle className="w-3 h-3 text-muted-foreground shrink-0" />}
                              <span className={`text-[10px] ${item.ok ? 'text-foreground' : 'text-muted-foreground'}`}>{item.label}</span>
                            </div>
                          ))}
                        </div>
                        <div className="mt-2 flex items-center gap-3 text-[10px] text-muted-foreground">
                          {closer && <span>Closer: <strong className="text-foreground">{closer.name}</strong></span>}
                          {sdr && <span>SDR: <strong className="text-foreground">{sdr.name}</strong></span>}
                          {config.tone && <span>Tom: <strong className="text-foreground">{config.tone}</strong></span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: Lead Context Status */}
        <TabsContent value="lead-context" className="mt-4">
          <LeadContextTab />
        </TabsContent>

        {/* TAB 4: Flow Diagram */}
        <TabsContent value="flow" className="mt-4">
          <AiFlowDiagram />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LeadContextTab() {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, []);

  const fetchLeads = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('wa_conversations')
      .select('id, lead_stage, conversation_mode, linkedin_context, linkedin_profile, last_message, last_message_at, wa_contacts!inner(name, phone)')
      .order('last_message_at', { ascending: false })
      .limit(100);
    setLeads((data || []) as any[]);
    setLoading(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (leads.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">Nenhum lead cadastrado</p>;

  const withContext = leads.filter(l => l.linkedin_context?.trim());
  const withProfile = leads.filter(l => l.linkedin_profile && Object.keys(l.linkedin_profile).length > 0);
  const withoutContext = leads.filter(l => !l.linkedin_context?.trim());

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{withContext.length}</p>
            <p className="text-[10px] text-muted-foreground">Com Contexto LinkedIn</p>
          </CardContent>
        </Card>
        <Card className="border">
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{withProfile.length}</p>
            <p className="text-[10px] text-muted-foreground">Com Perfil Enriquecido</p>
          </CardContent>
        </Card>
        <Card className={`border ${withoutContext.length > 0 ? 'border-destructive/30 bg-destructive/5' : 'border-primary/20'}`}>
          <CardContent className="p-3 text-center">
            <p className="text-2xl font-bold text-foreground">{withoutContext.length}</p>
            <p className="text-[10px] text-muted-foreground">Sem Contexto</p>
          </CardContent>
        </Card>
      </div>

      <ScrollArea className="h-[400px]">
        <div className="space-y-1.5">
          {leads.map(lead => {
            const contact = (lead as any).wa_contacts;
            const hasCtx = !!lead.linkedin_context?.trim();
            const hasProfile = lead.linkedin_profile && Object.keys(lead.linkedin_profile).length > 0;
            return (
              <div key={lead.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 border border-transparent hover:border-border">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-primary-foreground shrink-0 ${hasCtx ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                  {contact?.name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground truncate">{contact?.name || 'Sem nome'}</span>
                    <Badge variant="outline" className="text-[9px] px-1 py-0">{lead.lead_stage}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {hasCtx ? `📝 ${lead.linkedin_context.substring(0, 80)}...` : '⚠️ Sem contexto LinkedIn'}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {hasCtx && <Badge className="text-[8px] bg-primary/15 text-primary border-primary/30 px-1 py-0">CTX</Badge>}
                  {hasProfile && <Badge className="text-[8px] bg-accent text-accent-foreground px-1 py-0">LI</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}

function AiFlowDiagram() {
  const steps = [
    { id: 'trigger', icon: Zap, label: 'Gatilho', desc: 'Mensagem recebida ou lead cadastrado', color: 'bg-yellow-500/15 text-yellow-600 border-yellow-500/30' },
    { id: 'webhook', icon: Globe, label: 'Webhook', desc: 'Debounce 8s + double-check 3s', color: 'bg-blue-500/15 text-blue-600 border-blue-500/30' },
    { id: 'eligibility', icon: Shield, label: 'Eligibilidade', desc: 'Mode check + stage check + rate limit', color: 'bg-purple-500/15 text-purple-600 border-purple-500/30' },
    { id: 'context', icon: FileText, label: 'Contexto', desc: 'Knowledge + LinkedIn + Tags + Calendar', color: 'bg-primary/15 text-primary border-primary/30' },
    { id: 'ai', icon: Brain, label: 'IA Processa', desc: 'Gemini 3 Flash → resposta + score + tags', color: 'bg-primary/15 text-primary border-primary/30' },
    { id: 'send', icon: MessageSquare, label: 'Envio', desc: 'Typing simulation + split "|||" + Evolution API', color: 'bg-primary/15 text-primary border-primary/30' },
  ];

  const branches = [
    { from: 'ai', label: 'Score A (≥80)', desc: 'Propõe ligação → agenda reunião', icon: Phone, color: 'bg-primary/15 text-primary' },
    { from: 'ai', label: 'Score B (50-79)', desc: 'Continua qualificação + follow-up', icon: TrendingUp, color: 'bg-yellow-500/15 text-yellow-600' },
    { from: 'ai', label: 'Score C (<50)', desc: 'Encerra educadamente', icon: XCircle, color: 'bg-muted text-muted-foreground' },
    { from: 'ai', label: 'Handoff', desc: 'Limite atingido → humano assume', icon: Users, color: 'bg-destructive/15 text-destructive' },
    { from: 'ai', label: 'Urgente', desc: 'Lead quer ligar agora → alerta closer', icon: AlertTriangle, color: 'bg-destructive/15 text-destructive' },
  ];

  return (
    <div className="space-y-6">
      {/* Main Flow */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Workflow className="w-4 h-4 text-primary" /> Fluxo Principal da SDR IA
        </h3>
        <div className="flex flex-col gap-1">
          {steps.map((step, i) => (
            <div key={step.id}>
              <div className="flex items-center gap-3 p-3 rounded-lg border bg-card">
                <div className={`p-2 rounded-lg ${step.color} shrink-0`}>
                  <step.icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <span className="text-xs font-semibold text-foreground">{step.label}</span>
                  <p className="text-[10px] text-muted-foreground">{step.desc}</p>
                </div>
                <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{i + 1}</Badge>
              </div>
              {i < steps.length - 1 && (
                <div className="flex justify-center py-0.5">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground rotate-90" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Decision Branches */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" /> Decisões Pós-Processamento
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {branches.map(branch => (
            <div key={branch.label} className="flex items-center gap-3 p-2.5 rounded-lg border bg-card">
              <div className={`p-1.5 rounded-lg ${branch.color} shrink-0`}>
                <branch.icon className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="text-[11px] font-semibold text-foreground">{branch.label}</span>
                <p className="text-[10px] text-muted-foreground">{branch.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Concurrency Protection */}
      <Card className="border-primary/20">
        <CardContent className="p-3">
          <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5 mb-2">
            <Shield className="w-3.5 h-3.5 text-primary" /> Proteções de Concorrência
          </h4>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Debounce: <strong className="text-foreground">8s + 3s</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Concurrency Guard: <strong className="text-foreground">15s</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Activity className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Rate Limit: <strong className="text-foreground">50/hr</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Retry automático: <strong className="text-foreground">16s</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageSquare className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Batch Window: <strong className="text-foreground">60s</strong></span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-3 h-3 text-muted-foreground" />
              <span className="text-muted-foreground">Handoff: <strong className="text-foreground">10 msgs</strong></span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
