import { useState, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Users, Loader2, Linkedin, Send, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { WaInstance } from '@/hooks/use-wa-hub';
import type { WaTag } from '@/hooks/use-wa-tags';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instances: WaInstance[];
  tags: WaTag[];
  teamMembers: { id: string; name: string; member_role: string }[];
  onRefresh?: () => void;
}

interface LeadInput {
  name: string;
  phone: string;
  linkedinUrl: string;
}

export function LeadRegistrationSheet({ open, onOpenChange, instances, tags, teamMembers, onRefresh }: Props) {
  // Single lead
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [linkedinUrl, setLinkedinUrl] = useState('');
  const [selectedTagId, setSelectedTagId] = useState<string>('none');
  const [triggerAi, setTriggerAi] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Batch
  const [batchText, setBatchText] = useState('');
  const [batchTagId, setBatchTagId] = useState<string>('none');
  const [batchTriggerAi, setBatchTriggerAi] = useState(true);
  const [batchSubmitting, setBatchSubmitting] = useState(false);

  // Auto-resolve instance by SDR
  const sdrInstances = useMemo(() => {
    return instances.filter(i => i.sdr_id && i.ai_sdr_enabled);
  }, [instances]);

  const defaultInstance = sdrInstances[0] || instances[0];

  const parseBatchLeads = (text: string): LeadInput[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        // Format: Name, Phone[, LinkedIn URL]
        const parts = line.split(/[,;\t]+/).map(p => p.trim());
        return {
          name: parts[0] || '',
          phone: parts[1] || '',
          linkedinUrl: parts[2] || '',
        };
      })
      .filter(l => l.name && l.phone);
  };

  const batchLeads = useMemo(() => parseBatchLeads(batchText), [batchText]);

  const normalizePhone = (p: string): string => {
    let clean = p.replace(/[^0-9+]/g, '');
    if (clean.startsWith('+')) clean = clean.substring(1);
    if (!clean.startsWith('55') && clean.length <= 11) clean = `55${clean}`;
    return clean;
  };

  const createLeadAndTrigger = async (lead: LeadInput, tagId: string, shouldTriggerAi: boolean): Promise<boolean> => {
    const normalizedPhone = normalizePhone(lead.phone);
    if (!normalizedPhone || normalizedPhone.length < 10) {
      toast.error(`Telefone inválido: ${lead.phone}`);
      return false;
    }

    const inst = defaultInstance;
    if (!inst) {
      toast.error('Nenhuma instância disponível com SDR vinculado');
      return false;
    }

    try {
      // Check if contact already exists
      const { data: existingContact } = await supabase
        .from('wa_contacts')
        .select('id')
        .eq('phone', normalizedPhone)
        .eq('instance_id', inst.id)
        .maybeSingle();

      let contactId: string;

      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact, error: contactErr } = await supabase
          .from('wa_contacts')
          .insert({
            phone: normalizedPhone,
            name: lead.name,
            instance_id: inst.id,
          } as any)
          .select('id')
          .single();
        if (contactErr) throw contactErr;
        contactId = newContact.id;
      }

      // Check if conversation already exists
      const { data: existingConv } = await supabase
        .from('wa_conversations')
        .select('id')
        .eq('contact_id', contactId)
        .eq('instance_id', inst.id)
        .maybeSingle();

      let conversationId: string;

      if (existingConv) {
        conversationId = existingConv.id;
      } else {
        const { data: newConv, error: convErr } = await supabase
          .from('wa_conversations')
          .insert({
            contact_id: contactId,
            instance_id: inst.id,
            status: 'active',
            lead_stage: 'novo',
            conversation_mode: 'ia_ativa',
            priority_level: 'normal',
          } as any)
          .select('id')
          .single();
        if (convErr) throw convErr;
        conversationId = newConv.id;
      }

      // Add tag if selected
      if (tagId && tagId !== 'none') {
        const { data: existingTag } = await supabase
          .from('wa_contact_tags')
          .select('id')
          .eq('contact_id', contactId)
          .eq('tag_id', tagId)
          .maybeSingle();

        if (!existingTag) {
          await supabase.from('wa_contact_tags').insert({
            contact_id: contactId,
            tag_id: tagId,
          } as any);
        }
      }

      // Store LinkedIn URL as a note if provided
      if (lead.linkedinUrl) {
        await supabase.from('wa_messages').insert({
          conversation_id: conversationId,
          sender: 'agent',
          agent_name: 'Sistema',
          text: `🔗 LinkedIn: ${lead.linkedinUrl}`,
          media_type: null,
          media_url: null,
        } as any);
      }

      // Trigger AI SDR
      if (shouldTriggerAi && inst.ai_sdr_enabled) {
        try {
          await supabase.functions.invoke('ai-sdr-agent', {
            body: {
              conversation_id: conversationId,
              instance_id: inst.id,
              instance_name: inst.instance_name,
              contact_phone: normalizedPhone,
              contact_name: lead.name,
              trigger_type: 'proactive',
              force: true,
            },
          });
        } catch (aiErr) {
          console.error('AI SDR trigger error:', aiErr);
          // Don't fail the whole operation
        }
      }

      return true;
    } catch (err) {
      console.error('Lead creation error:', err);
      toast.error(`Erro ao criar lead ${lead.name}`);
      return false;
    }
  };

  const handleSubmitSingle = async () => {
    if (!name.trim() || !phone.trim()) {
      toast.error('Nome e telefone são obrigatórios');
      return;
    }
    setSubmitting(true);
    const ok = await createLeadAndTrigger(
      { name: name.trim(), phone: phone.trim(), linkedinUrl: linkedinUrl.trim() },
      selectedTagId,
      triggerAi
    );
    setSubmitting(false);
    if (ok) {
      toast.success(`Lead "${name}" cadastrado${triggerAi ? ' e IA disparada!' : '!'}`);
      setName(''); setPhone(''); setLinkedinUrl(''); setSelectedTagId('none');
      onRefresh?.();
    }
  };

  const handleSubmitBatch = async () => {
    if (batchLeads.length === 0) {
      toast.error('Nenhum lead válido encontrado. Use formato: Nome, Telefone');
      return;
    }
    setBatchSubmitting(true);
    let ok = 0, fail = 0;
    for (const lead of batchLeads) {
      const result = await createLeadAndTrigger(lead, batchTagId, batchTriggerAi);
      if (result) ok++; else fail++;
    }
    setBatchSubmitting(false);
    toast.success(`${ok} leads cadastrados${fail > 0 ? `, ${fail} falharam` : ''}${batchTriggerAi ? ' — IA disparada!' : ''}`);
    if (ok > 0) {
      setBatchText('');
      onRefresh?.();
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Linkedin className="w-5 h-5 text-primary" />
            Cadastrar Leads
          </SheetTitle>
          <SheetDescription className="text-xs">
            Cadastre leads do LinkedIn e a IA dispara a primeira mensagem automaticamente.
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

          {/* Single Lead */}
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
              <Label className="text-xs">Tag / Label</Label>
              <Select value={selectedTagId} onValueChange={setSelectedTagId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecionar tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem tag</SelectItem>
                  {tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Batch */}
          <TabsContent value="batch" className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Lista de Leads</Label>
              <Textarea
                value={batchText}
                onChange={e => setBatchText(e.target.value)}
                placeholder={`Cole a lista no formato:\nJoão Silva, 11999998888, https://linkedin.com/in/joao\nMaria Santos, 21988887777\nPedro Costa, 31977776666`}
                className="min-h-[160px] text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                Formato: Nome, Telefone[, LinkedIn URL] — um por linha. Separador: vírgula, ponto-e-vírgula ou tab.
              </p>
            </div>
            {batchLeads.length > 0 && (
              <div className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                <p className="text-xs font-medium text-foreground">{batchLeads.length} leads detectados:</p>
                <div className="max-h-[120px] overflow-y-auto space-y-0.5">
                  {batchLeads.slice(0, 20).map((l, i) => (
                    <p key={i} className="text-[10px] text-muted-foreground truncate">
                      {l.name} — {l.phone} {l.linkedinUrl && `🔗`}
                    </p>
                  ))}
                  {batchLeads.length > 20 && (
                    <p className="text-[10px] text-muted-foreground">...e mais {batchLeads.length - 20}</p>
                  )}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs">Tag / Label</Label>
              <Select value={batchTagId} onValueChange={setBatchTagId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Selecionar tag" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem tag</SelectItem>
                  {tags.map(tag => (
                    <SelectItem key={tag.id} value={tag.id}>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
