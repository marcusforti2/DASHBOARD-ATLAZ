import { useState, useMemo, useCallback } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { UserPlus, Users, Loader2, Linkedin, Send, AlertCircle, Sparkles, CheckCircle2, Tag, MessageSquare, Pencil, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WaInstance } from '@/hooks/use-wa-hub';
import { type LeadSource, DEFAULT_AI_SDR_CONFIG } from '@/domains/ai-sdr/types';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: WaInstance[];
  tags: any[];
  teamMembers: { id: string; name: string; member_role: string }[];
  onRefresh?: () => void;
}

interface LeadInput {
  name: string;
  phone: string;
  linkedinUrl: string;
  linkedinContext: string;
}

export function LeadRegistrationSheet({ open, onOpenChange, instances, tags, teamMembers, onRefresh }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [linkedinContext, setLinkedinContext] = useState('');
  const [selectedSourceId, setSelectedSourceId] = useState<string>('none');
  const [triggerAi, setTriggerAi] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [batchText, setBatchText] = useState('');
  const [batchSourceId, setBatchSourceId] = useState<string>('none');
  const [batchTriggerAi, setBatchTriggerAi] = useState(false);
  const [batchSubmitting, setBatchSubmitting] = useState(false);
  const [batchLinkedinContext, setBatchLinkedinContext] = useState('');
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const [aiParsedLeads, setAiParsedLeads] = useState<LeadInput[] | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const sdrInstances = useMemo(() => instances.filter(i => i.sdr_id && i.ai_sdr_enabled), [instances]);
  const defaultInstance = sdrInstances[0] || instances[0];

  const leadSources: LeadSource[] = useMemo(() => {
    const config = (defaultInstance as any)?.ai_sdr_config;
    const sources = (config?.lead_sources || DEFAULT_AI_SDR_CONFIG.lead_sources || []);
    return sources.filter((s: LeadSource) => s.active);
  }, [defaultInstance]);

  const parseBatchLeads = (text: string): LeadInput[] => {
    return text.split('\n').map(l => l.trim()).filter(Boolean).map(line => {
      const parts = line.split(/[,;\t]+/).map(p => p.trim());
      return { name: parts[0] || '', phone: parts[1] || '', linkedinUrl: parts[2] || '', linkedinContext: '' };
    }).filter(l => l.name && l.phone);
  };

  const batchLeads = useMemo(() => aiParsedLeads ?? parseBatchLeads(batchText), [batchText, aiParsedLeads]);

  const handleAiProcess = async () => {
    if (!batchText.trim()) { toast.error('Cole o texto com os leads primeiro'); return; }
    setAiProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-lead-batch', { body: { text: batchText } });
      if (error) throw error;
      const leads: LeadInput[] = (data?.leads || []).map((l: any) => ({
        name: l.name || '', phone: l.phone || '', linkedinUrl: l.linkedin_url || l.linkedinUrl || '', linkedinContext: l.linkedin_context || '',
      })).filter((l: LeadInput) => l.name && l.phone);
      if (leads.length === 0) {
        toast.error('A IA não conseguiu extrair leads do texto.');
      } else {
        setAiParsedLeads(leads);
        toast.success(`IA organizou ${leads.length} lead${leads.length !== 1 ? 's' : ''}`);
      }
    } catch (err) {
      console.error('AI parse error:', err);
      toast.error('Erro ao processar com IA. Tente novamente.');
    } finally { setAiProcessing(false); }
  };

  const handleBatchTextChange = (text: string) => { setBatchText(text); setAiParsedLeads(null); setEditingIndex(null); setExpandedIndex(null); };

  const updateParsedLead = useCallback((index: number, field: keyof LeadInput, value: string) => {
    if (!aiParsedLeads) return;
    const updated = [...aiParsedLeads];
    updated[index] = { ...updated[index], [field]: value };
    setAiParsedLeads(updated);
  }, [aiParsedLeads]);

  const removeParsedLead = useCallback((index: number) => {
    if (!aiParsedLeads) return;
    const updated = aiParsedLeads.filter((_, i) => i !== index);
    setAiParsedLeads(updated.length > 0 ? updated : null);
    setEditingIndex(null);
    setExpandedIndex(null);
  }, [aiParsedLeads]);

  const normalizePhone = (p: string): string => {
    let clean = p.replace(/[^0-9+]/g, '');
    if (clean.startsWith('+')) clean = clean.substring(1);
    if (!clean.startsWith('55') && clean.length <= 11) clean = `55${clean}`;
    return clean;
  };

  const getSelectedSource = (sourceId: string): LeadSource | null => {
    if (sourceId === 'none') return null;
    return leadSources.find(s => s.id === sourceId) || null;
  };

  const createLeadAndTrigger = async (lead: LeadInput, sourceId: string, shouldTriggerAi: boolean): Promise<boolean> => {
    const normalizedPhone = normalizePhone(lead.phone);
    if (!normalizedPhone || normalizedPhone.length < 10) { toast.error(`Telefone inválido: ${lead.phone}`); return false; }
    const inst = defaultInstance;
    if (!inst) { toast.error('Nenhuma instância disponível com SDR vinculado'); return false; }
    const selectedSource = getSelectedSource(sourceId);

    try {
      const { data: existingContact } = await supabase
        .from('wa_contacts').select('id').eq('phone', normalizedPhone).eq('instance_id', inst.id).maybeSingle();

      let contactId: string;
      if (existingContact) {
        contactId = existingContact.id;
        // Update contact name and linkedin if provided
        const updateData: any = {};
        if (lead.name) updateData.name = lead.name;
        if (lead.linkedinUrl) updateData.linkedin_profile_url = lead.linkedinUrl;
        if (Object.keys(updateData).length > 0) {
          await supabase.from('wa_contacts').update(updateData).eq('id', contactId);
        }
      } else {
        const insertData: any = { phone: normalizedPhone, name: lead.name, instance_id: inst.id };
        if (lead.linkedinUrl) insertData.linkedin_profile_url = lead.linkedinUrl;
        const { data: newContact, error: contactErr } = await supabase
          .from('wa_contacts').insert(insertData)
          .select('id').single();
        if (contactErr) throw contactErr;
        contactId = newContact.id;
      }

      const { data: existingConv } = await supabase
        .from('wa_conversations').select('id').eq('contact_id', contactId).eq('instance_id', inst.id).maybeSingle();

      let conversationId: string;
      if (existingConv) {
        conversationId = existingConv.id;
        const convUpdate: any = {};
        if (lead.linkedinContext) convUpdate.linkedin_context = lead.linkedinContext;
        if (lead.linkedinUrl) convUpdate.linkedin_url = lead.linkedinUrl;
        if (Object.keys(convUpdate).length > 0) {
          await supabase.from('wa_conversations').update(convUpdate).eq('id', existingConv.id);
        }
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('wa_conversations').insert({
            contact_id: contactId, instance_id: inst.id, status: 'active',
            lead_stage: 'novo', conversation_mode: 'ia_ativa', priority_level: 'normal',
            linkedin_context: lead.linkedinContext || '',
            linkedin_url: lead.linkedinUrl || '',
          } as any).select('id').single();
        if (convErr) throw convErr;
        conversationId = newConv.id;
      }

      if (lead.linkedinUrl) {
        await supabase.from('wa_messages').insert({
          conversation_id: conversationId, sender: 'agent', agent_name: 'Sistema',
          text: `🔗 LinkedIn: ${lead.linkedinUrl}`, media_type: null, media_url: null,
        } as any);
      }

      if (shouldTriggerAi && inst.ai_sdr_enabled) {
        try {
          await supabase.functions.invoke('ai-sdr-agent', {
            body: {
              conversation_id: conversationId, instance_id: inst.id, instance_name: inst.instance_name,
              contact_phone: normalizedPhone, contact_name: lead.name,
              trigger_type: 'proactive', force: true,
              lead_source_name: selectedSource?.name || 'PROSPECÇÃO',
              lead_source_context: selectedSource?.context || '',
              linkedin_url: lead.linkedinUrl || '',
              linkedin_context: lead.linkedinContext || '',
            },
          });
        } catch (aiErr) { console.error('AI SDR trigger error:', aiErr); }
      }
      return true;
    } catch (err) {
      console.error('Lead creation error:', err);
      toast.error(`Erro ao criar lead ${lead.name}`);
      return false;
    }
  };

  const handleSubmitSingle = async () => {
    if (!name.trim() || !phone.trim()) { toast.error('Nome e telefone são obrigatórios'); return; }
    setSubmitting(true);
    const ok = await createLeadAndTrigger({ name: name.trim(), phone: phone.trim(), linkedinUrl: linkedinUrl.trim(), linkedinContext: linkedinContext.trim() }, selectedSourceId, triggerAi);
    setSubmitting(false);
    if (ok) {
      toast.success(`Lead "${name}" cadastrado${triggerAi ? ' e IA disparada!' : '!'}`);
      setName(''); setPhone(''); setLinkedinUrl(''); setLinkedinContext(''); setSelectedSourceId('none');
      onRefresh?.();
    }
  };

  const handleSubmitBatch = async () => {
    if (batchLeads.length === 0) { toast.error('Nenhum lead válido encontrado.'); return; }
    setBatchSubmitting(true);
    setBatchProgress({ current: 0, total: batchLeads.length });
    let ok = 0, fail = 0;
    for (let i = 0; i < batchLeads.length; i++) {
      const lead = batchLeads[i];
      const leadWithContext = { ...lead, linkedinContext: lead.linkedinContext || batchLinkedinContext };
      const result = await createLeadAndTrigger(leadWithContext, batchSourceId, batchTriggerAi);
      if (result) ok++; else fail++;
      setBatchProgress({ current: i + 1, total: batchLeads.length });
    }
    setBatchSubmitting(false);
    setBatchProgress({ current: 0, total: 0 });
    toast.success(`${ok} leads cadastrados${fail > 0 ? `, ${fail} falharam` : ''}${batchTriggerAi ? ' — IA disparada!' : ''}`);
    if (ok > 0) { setBatchText(''); setAiParsedLeads(null); setBatchLinkedinContext(''); setEditingIndex(null); setExpandedIndex(null); onRefresh?.(); }
  };

  const SourceSelector = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="space-y-1.5">
      <Label className="text-xs flex items-center gap-1.5">
        <Tag className="w-3 h-3" /> Origem do Lead
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs">
          <SelectValue placeholder="Selecionar origem" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem origem definida</SelectItem>
          {leadSources.map(src => (
            <SelectItem key={src.id} value={src.id}>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: src.color || '#6366f1' }} />
                {src.name}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value !== 'none' && (() => {
        const src = getSelectedSource(value);
        return src?.context ? (
          <p className="text-[10px] text-muted-foreground line-clamp-2 pl-1">
            IA usará: "{src.context.substring(0, 80)}..."
          </p>
        ) : null;
      })()}
    </div>
  );

  const leadsWithContext = useMemo(() => {
    return batchLeads.filter(l => l.linkedinContext).length;
  }, [batchLeads]);

  const leadsWithLinkedin = useMemo(() => {
    return batchLeads.filter(l => l.linkedinUrl).length;
  }, [batchLeads]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Linkedin className="w-5 h-5 text-primary" />
            Cadastrar Leads
          </SheetTitle>
          <SheetDescription className="text-xs">
            Cadastre leads e a IA dispara a primeira mensagem com o contexto da origem selecionada.
          </SheetDescription>
        </SheetHeader>

        {!defaultInstance && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 text-destructive text-xs mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            Nenhuma instância com SDR vinculado e IA habilitada encontrada.
          </div>
        )}

        {defaultInstance && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 text-xs mb-4">
            <span className="text-muted-foreground">Instância:</span>
            <Badge variant="secondary" className="text-[10px]">{defaultInstance.instance_name.replace(/^wpp_/i, '')}</Badge>
            <span className="text-muted-foreground ml-1">SDR:</span>
            <Badge variant="outline" className="text-[10px]">
              {teamMembers.find(m => m.id === defaultInstance.sdr_id)?.name || 'Não vinculado'}
            </Badge>
          </div>
        )}

        <Tabs defaultValue="single" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="single" className="text-xs gap-1.5">
              <UserPlus className="w-3.5 h-3.5" /> Individual
            </TabsTrigger>
            <TabsTrigger value="batch" className="text-xs gap-1.5">
              <Users className="w-3.5 h-3.5" /> Em lote
            </TabsTrigger>
          </TabsList>

          <TabsContent value="single" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Nome *</Label>
              <Input value={name} onChange={e => setName(e.target.value)} placeholder="João Silva" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Telefone (WhatsApp) *</Label>
              <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="11999998888" className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">LinkedIn URL</Label>
              <Input value={linkedinUrl} onChange={e => setLinkedinUrl(e.target.value)} placeholder="https://linkedin.com/in/..." className="h-8 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Contexto da conversa prévia
              </Label>
              <Textarea
                value={linkedinContext}
                onChange={e => setLinkedinContext(e.target.value)}
                placeholder="Ex: Conversamos sobre modelo de mentoria no LinkedIn, ele perguntou sobre preço e formato..."
                className="min-h-[80px] text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                A IA usará este contexto para continuar a conversa naturalmente sem repetir assuntos.
              </p>
            </div>
            <SourceSelector value={selectedSourceId} onChange={setSelectedSourceId} />
            <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
              <input type="checkbox" checked={triggerAi} onChange={e => setTriggerAi(e.target.checked)} className="rounded" />
              <Send className="w-3 h-3 text-primary" />
              Disparar IA SDR automaticamente
            </label>
            <Button onClick={handleSubmitSingle} disabled={submitting || !defaultInstance} className="w-full h-9 text-xs gap-2">
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UserPlus className="w-3.5 h-3.5" />}
              Cadastrar Lead
            </Button>
          </TabsContent>

          <TabsContent value="batch" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Cole os dados dos leads</Label>
              <Textarea
                value={batchText}
                onChange={e => handleBatchTextChange(e.target.value)}
                placeholder={`Cole aqui em qualquer formato:\nJoão Silva 11999998888 linkedin.com/in/joao\nMaria Santos - (21) 98888-7777\nPedro Costa, 31977776666, https://linkedin.com/in/pedro\n\nA IA organiza automaticamente!`}
                className="min-h-[120px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Cole em qualquer formato — a IA extrai nomes, telefones, LinkedIn e contexto automaticamente.
              </p>
            </div>

            <Button variant="outline" onClick={handleAiProcess} disabled={aiProcessing || !batchText.trim()}
              className="w-full h-9 text-xs gap-2 border-primary/30 hover:bg-primary/5">
              {aiProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
              {aiProcessing ? 'Processando com IA...' : '✨ Processar com IA'}
            </Button>

            {/* Parsed leads preview */}
            {batchLeads.length > 0 && (
              <div className={`rounded-lg border overflow-hidden ${aiParsedLeads ? 'border-primary/20 bg-primary/5' : 'border-border bg-muted/30'}`}>
                {/* Header with stats */}
                <div className="flex items-center justify-between p-2.5 border-b border-border/50">
                  <div className="flex items-center gap-2">
                    {aiParsedLeads && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                    <span className="text-xs font-medium">
                      {aiParsedLeads ? `${batchLeads.length} leads organizados pela IA` : `${batchLeads.length} leads detectados`}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {leadsWithLinkedin > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 gap-0.5 px-1.5">
                        <Linkedin className="w-2.5 h-2.5" /> {leadsWithLinkedin}
                      </Badge>
                    )}
                    {leadsWithContext > 0 && (
                      <Badge variant="secondary" className="text-[9px] h-4 gap-0.5 px-1.5">
                        <MessageSquare className="w-2.5 h-2.5" /> {leadsWithContext}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Lead list */}
                <div className="max-h-[220px] overflow-y-auto divide-y divide-border/30">
                  {batchLeads.slice(0, 30).map((l, i) => (
                    <div key={i} className="group">
                      {/* Lead row */}
                      <div
                        className="flex items-center gap-2 px-2.5 py-1.5 text-[11px] cursor-pointer hover:bg-background/60 transition-colors"
                        onClick={() => aiParsedLeads && setExpandedIndex(expandedIndex === i ? null : i)}
                      >
                        <span className="text-muted-foreground w-4 text-right text-[9px]">{i + 1}</span>
                        <span className="font-medium text-foreground truncate flex-1 min-w-0">{l.name}</span>
                        <span className="text-muted-foreground text-[10px] shrink-0">{l.phone}</span>
                        {l.linkedinUrl && <Linkedin className="w-2.5 h-2.5 text-primary shrink-0" />}
                        {l.linkedinContext && <MessageSquare className="w-2.5 h-2.5 text-emerald-500 shrink-0" />}
                        {aiParsedLeads && (
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); removeParsedLead(i); }}
                              className="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                              <Trash2 className="w-3 h-3" />
                            </button>
                            {expandedIndex === i
                              ? <ChevronUp className="w-3 h-3 text-muted-foreground" />
                              : <ChevronDown className="w-3 h-3 text-muted-foreground" />
                            }
                          </div>
                        )}
                      </div>

                      {/* Expanded edit view */}
                      {aiParsedLeads && expandedIndex === i && (
                        <div className="px-3 pb-2.5 pt-1 space-y-1.5 bg-background/40 border-t border-border/20">
                          <div className="grid grid-cols-2 gap-1.5">
                            <Input
                              value={l.name} onChange={e => updateParsedLead(i, 'name', e.target.value)}
                              placeholder="Nome" className="h-6 text-[10px] px-2"
                            />
                            <Input
                              value={l.phone} onChange={e => updateParsedLead(i, 'phone', e.target.value)}
                              placeholder="Telefone" className="h-6 text-[10px] px-2"
                            />
                          </div>
                          <Input
                            value={l.linkedinUrl} onChange={e => updateParsedLead(i, 'linkedinUrl', e.target.value)}
                            placeholder="LinkedIn URL" className="h-6 text-[10px] px-2"
                          />
                          <Textarea
                            value={l.linkedinContext} onChange={e => updateParsedLead(i, 'linkedinContext', e.target.value)}
                            placeholder="Contexto da conversa com este lead..."
                            className="min-h-[40px] text-[10px] px-2 py-1 resize-none"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                  {batchLeads.length > 30 && (
                    <p className="text-[10px] text-muted-foreground p-2 text-center">...e mais {batchLeads.length - 30}</p>
                  )}
                </div>

                {aiParsedLeads && (
                  <div className="px-2.5 py-1.5 border-t border-border/30 bg-background/30">
                    <p className="text-[9px] text-muted-foreground text-center">
                      Clique em um lead para expandir e editar • Passe o mouse para excluir
                    </p>
                  </div>
                )}
              </div>
            )}

            <SourceSelector value={batchSourceId} onChange={setBatchSourceId} />

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Contexto geral (aplicado a leads sem contexto individual)
              </Label>
              <Textarea
                value={batchLinkedinContext}
                onChange={e => setBatchLinkedinContext(e.target.value)}
                placeholder="Ex: 'Conversamos sobre mentoria no LinkedIn, ele já tem modelo rodando, quer escalar...'"
                className="min-h-[50px] text-xs"
              />
              {leadsWithContext > 0 && (
                <p className="text-[10px] text-emerald-500">
                  ✓ {leadsWithContext} lead{leadsWithContext !== 1 ? 's' : ''} já {leadsWithContext !== 1 ? 'possuem' : 'possui'} contexto individual extraído pela IA.
                  {batchLinkedinContext && ' O contexto geral será aplicado apenas aos demais.'}
                </p>
              )}
              {!leadsWithContext && (
                <p className="text-[10px] text-muted-foreground">
                  A IA usará esse contexto para continuar a conversa naturalmente sem repetir assuntos.
                </p>
              )}
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
              <input type="checkbox" checked={batchTriggerAi} onChange={e => setBatchTriggerAi(e.target.checked)} className="rounded" />
              <Send className="w-3 h-3 text-primary" />
              Disparar IA SDR automaticamente
            </label>

            {/* Progress bar during submission */}
            {batchSubmitting && batchProgress.total > 0 && (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">Cadastrando leads...</span>
                  <span className="text-foreground font-medium">{batchProgress.current}/{batchProgress.total}</span>
                </div>
                <Progress value={(batchProgress.current / batchProgress.total) * 100} className="h-1.5" />
              </div>
            )}

            <Button onClick={handleSubmitBatch} disabled={batchSubmitting || batchLeads.length === 0 || !defaultInstance} className="w-full h-9 text-xs gap-2">
              {batchSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              {batchSubmitting
                ? `Cadastrando ${batchProgress.current}/${batchProgress.total}...`
                : `Cadastrar ${batchLeads.length} Lead${batchLeads.length !== 1 ? 's' : ''}`
              }
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}