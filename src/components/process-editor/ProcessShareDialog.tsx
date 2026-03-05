import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Copy, RefreshCw, ExternalLink, Link2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props { open: boolean; onOpenChange: (o: boolean) => void; processId: string | null; processName: string; }

export function ProcessShareDialog({ open, onOpenChange, processId, processName }: Props) {
  const [isPublic, setIsPublic] = useState(false);
  const [publicToken, setPublicToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const APP_URL = 'https://dashboard-lsd.learningbrand.com.br';

  useEffect(() => { if (open && processId) loadSettings(); }, [open, processId]);

  const loadSettings = async () => {
    if (!processId) return;
    setLoading(true);
    try { const { data } = await supabase.from('process_flows').select('is_public, public_token').eq('id', processId).single(); setIsPublic(data?.is_public || false); setPublicToken(data?.public_token || null); } catch {} finally { setLoading(false); }
  };

  const togglePublic = async (enabled: boolean) => {
    if (!processId) return;
    setLoading(true);
    try {
      const token = enabled ? (publicToken || crypto.randomUUID().replace(/-/g, '').substring(0, 16)) : publicToken;
      await supabase.from('process_flows').update({ is_public: enabled, public_token: token }).eq('id', processId);
      setIsPublic(enabled); setPublicToken(token); toast.success(enabled ? 'Link público ativado!' : 'Desativado');
    } catch { toast.error('Erro'); } finally { setLoading(false); }
  };

  const regenerateToken = async () => {
    if (!processId) return;
    setLoading(true);
    try { const t = crypto.randomUUID().replace(/-/g, '').substring(0, 16); await supabase.from('process_flows').update({ public_token: t }).eq('id', processId); setPublicToken(t); toast.success('Novo link gerado!'); } catch { toast.error('Erro'); } finally { setLoading(false); }
  };

  const url = `${APP_URL}/processo/publico/${publicToken}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" />Compartilhar Processo</DialogTitle></DialogHeader>
      <div className="space-y-6 py-4">
        <div className="text-sm text-muted-foreground"><strong>{processName}</strong></div>
        <div className="flex items-center justify-between"><div><Label>Link Público</Label><p className="text-sm text-muted-foreground">Visualização sem login</p></div><Switch checked={isPublic} onCheckedChange={togglePublic} disabled={loading} /></div>
        {isPublic && publicToken && <>
          <div className="space-y-2"><Label>Link</Label><div className="flex gap-2"><Input readOnly value={url} className="text-sm" /><Button variant="outline" size="icon" onClick={() => { navigator.clipboard.writeText(url); toast.success('Copiado!'); }}><Copy className="h-4 w-4" /></Button><Button variant="outline" size="icon" onClick={() => window.open(url, '_blank')}><ExternalLink className="h-4 w-4" /></Button></div></div>
          <Button variant="outline" onClick={regenerateToken} disabled={loading} className="w-full"><RefreshCw className="h-4 w-4 mr-2" />Gerar Novo Link</Button>
          <div className="flex items-start gap-2 p-3 bg-muted rounded-lg"><AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" /><p className="text-xs text-muted-foreground">Qualquer pessoa com este link pode visualizar o processo.</p></div>
        </>}
      </div>
    </DialogContent></Dialog>
  );
}
