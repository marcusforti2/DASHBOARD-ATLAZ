import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Loader2, Linkedin, Send, AlertCircle, Sparkles, CheckCircle2, Tag, MessageSquare } from 'lucide-react';
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

  const [aiParsedLeads, setAiParsedLeads] = useState<LeadInput[] | null>(null);
  const [aiProcessing, setAiProcessing] = useState(false);

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

  const handleBatchTextChange = (text: string) => { setBatchText(text); setAiParsedLeads(null); };

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
      } else {
        const { data: newContact, error: contactErr } = await supabase
          .from('wa_contacts').insert({ phone: normalizedPhone, name: lead.name, instance_id: inst.id } as any)
          .select('id').single();
        if (contactErr) throw contactErr;
        contactId = newContact.id;
      }

      const { data: existingConv } = await supabase
        .from('wa_conversations').select('id').eq('contact_id', contactId).eq('instance_id', inst.id).maybeSingle();

      let conversationId: string;
      if (existingConv) {
        conversationId = existingConv.id;
        // Update linkedin context if provided
        if (lead.linkedinContext) {
          await supabase.from('wa_conversations').update({
            linkedin_context: lead.linkedinContext,
          } as any).eq('id', existingConv.id);
        }
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('wa_conversations').insert({
            contact_id: contactId, instance_id: inst.id, status: 'active',
            lead_stage: 'novo', conversation_mode: 'ia_ativa', priority_level: 'normal',
            linkedin_context: lead.linkedinContext || '',
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
    let ok = 0, fail = 0;
    for (const lead of batchLeads) {
      // Apply batch-level linkedin context to each lead if they don't have individual context
      const leadWithContext = { ...lead, linkedinContext: lead.linkedinContext || batchLinkedinContext };
      const result = await createLeadAndTrigger(leadWithContext, batchSourceId, batchTriggerAi);
      if (result) ok++; else fail++;
    }
    setBatchSubmitting(false);
    toast.success(`${ok} leads cadastrados${fail > 0 ? `, ${fail} falharam` : ''}${batchTriggerAi ? ' — IA disparada!' : ''}`);
    if (ok > 0) { setBatchText(''); setAiParsedLeads(null); setBatchLinkedinContext(''); onRefresh?.(); }
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
            {(selectedSourceId === 'linkedin' || linkedinUrl) && (
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Contexto da conversa no LinkedIn
                </Label>
                <Textarea
                  value={linkedinContext}
                  onChange={e => setLinkedinContext(e.target.value)}
                  placeholder="Ex: Conversamos sobre modelo de mentoria, ele perguntou sobre preço e formato. Demonstrou interesse em consultoria individual..."
                  className="min-h-[80px] text-xs"
                />
                <p className="text-[10px] text-muted-foreground">
                  A IA usará este contexto para não repetir assuntos e continuar a conversa naturalmente.
                </p>
              </div>
            )}
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
                className="min-h-[140px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Cole em qualquer formato — a IA extrai nomes, telefones e LinkedIn automaticamente.
              </p>
            </div>

            <Button variant="outline" onClick={handleAiProcess} disabled={aiProcessing || !batchText.trim()}
              className="w-full h-9 text-xs gap-2 border-primary/30 hover:bg-primary/5">
              {aiProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-primary" />}
              {aiProcessing ? 'Processando com IA...' : '✨ Processar com IA'}
            </Button>

            {batchLeads.length > 0 && (
              <div className={`rounded-lg p-2.5 space-y-1.5 ${aiParsedLeads ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'}`}>
                <div className="flex items-center gap-2">
                  {aiParsedLeads && <CheckCircle2 className="w-3.5 h-3.5 text-primary" />}
                  <p className="text-xs font-medium text-foreground">
                    {aiParsedLeads ? `✅ ${batchLeads.length} leads organizados pela IA:` : `${batchLeads.length} leads detectados:`}
                  </p>
                </div>
                <div className="max-h-[150px] overflow-y-auto space-y-1">
                  {batchLeads.slice(0, 30).map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] py-0.5 px-1.5 rounded bg-background/50">
                      <span className="text-foreground font-medium truncate max-w-[140px]">{l.name}</span>
                      <span className="text-muted-foreground">{l.phone}</span>
                      {l.linkedinUrl && <Linkedin className="w-2.5 h-2.5 text-primary shrink-0" />}
                      {l.linkedinContext && <MessageSquare className="w-2.5 h-2.5 text-primary shrink-0" />}
                    </div>
                  ))}
                  {batchLeads.length > 30 && (
                    <p className="text-[10px] text-muted-foreground pl-1.5">...e mais {batchLeads.length - 30}</p>
                  )}
                </div>
              </div>
            )}

            <SourceSelector value={batchSourceId} onChange={setBatchSourceId} />

            <div className="space-y-1.5">
              <Label className="text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3 h-3" /> Contexto da conversa (para todos os leads)
              </Label>
              <Textarea
                value={batchLinkedinContext}
                onChange={e => setBatchLinkedinContext(e.target.value)}
                placeholder="Ex: 'Conversamos sobre mentoria no LinkedIn, ele já tem modelo rodando, quer escalar...' ou qualquer contexto prévio da conversa."
                className="min-h-[60px] text-xs"
              />
              <p className="text-[10px] text-muted-foreground">
                A IA usará esse contexto para continuar a conversa naturalmente sem repetir assuntos.
              </p>
            </div>

            <label className="flex items-center gap-2 text-xs cursor-pointer py-1">
              <input type="checkbox" checked={batchTriggerAi} onChange={e => setBatchTriggerAi(e.target.checked)} className="rounded" />
              <Send className="w-3 h-3 text-primary" />
              Disparar IA SDR automaticamente
            </label>
            <Button onClick={handleSubmitBatch} disabled={batchSubmitting || batchLeads.length === 0 || !defaultInstance} className="w-full h-9 text-xs gap-2">
              {batchSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Users className="w-3.5 h-3.5" />}
              Cadastrar {batchLeads.length} Lead{batchLeads.length !== 1 ? 's' : ''}
            </Button>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}
