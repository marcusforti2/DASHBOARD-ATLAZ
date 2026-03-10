import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, RefreshCw, Link2, Copy, Trash2, Check, AlertCircle, ArrowDownUp, ExternalLink, Download } from 'lucide-react';

export function PipedriveTab() {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [webhooksLoading, setWebhooksLoading] = useState(false);
  const [stats, setStats] = useState({ deals: 0, persons: 0, activities: 0, notes: 0 });
  const [logs, setLogs] = useState<any[]>([]);
  const [importingStages, setImportingStages] = useState(false);
  const [pipelines, setPipelines] = useState<any[]>([]);

  const WEBHOOK_URL = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/pipedrive-webhook`;

  useEffect(() => {
    loadStats();
    loadLogs();
    loadWebhooks();
  }, []);

  const callPipedriveApi = async (action: string, params: any = {}) => {
    const { data, error } = await supabase.functions.invoke('pipedrive-api', {
      body: { action, params },
    });
    if (error) throw error;
    return data;
  };

  const loadStats = async () => {
    const [deals, persons, activities, notes] = await Promise.all([
      supabase.from('pipedrive_deals' as any).select('id', { count: 'exact', head: true }),
      supabase.from('pipedrive_persons' as any).select('id', { count: 'exact', head: true }),
      supabase.from('pipedrive_activities' as any).select('id', { count: 'exact', head: true }),
      supabase.from('pipedrive_notes' as any).select('id', { count: 'exact', head: true }),
    ]);
    setStats({
      deals: deals.count || 0,
      persons: persons.count || 0,
      activities: activities.count || 0,
      notes: notes.count || 0,
    });
  };

  const loadLogs = async () => {
    const { data } = await supabase
      .from('pipedrive_webhook_logs' as any)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);
    setLogs(data || []);
  };

  const loadWebhooks = async () => {
    setWebhooksLoading(true);
    try {
      const result = await callPipedriveApi('get_webhooks');
      setWebhooks(result?.data || []);
    } catch {
      // Token may not be set
    }
    setWebhooksLoading(false);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await callPipedriveApi('sync_all');
      toast.success(`Sync completo: ${result.synced?.deals || 0} deals, ${result.synced?.persons || 0} contatos`);
      loadStats();
    } catch (err: any) {
      toast.error(err.message || 'Erro na sincronização');
    }
    setSyncing(false);
  };

  const handleCreateWebhook = async (eventAction: string, eventObject: string) => {
    setLoading(true);
    try {
      await callPipedriveApi('create_webhook', {
        subscription_url: WEBHOOK_URL,
        event_action: eventAction,
        event_object: eventObject,
      });
      toast.success(`Webhook criado: ${eventAction}.${eventObject}`);
      loadWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar webhook');
    }
    setLoading(false);
  };

  const handleDeleteWebhook = async (id: number) => {
    try {
      await callPipedriveApi('delete_webhook', { id });
      toast.success('Webhook removido');
      loadWebhooks();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao remover webhook');
    }
  };

  const handleCreateAllWebhooks = async () => {
    setLoading(true);
    const events = [
      { action: '*', object: 'deal' },
      { action: '*', object: 'person' },
      { action: '*', object: 'activity' },
      { action: '*', object: 'note' },
    ];
    let ok = 0;
    for (const e of events) {
      try {
        await callPipedriveApi('create_webhook', {
          subscription_url: WEBHOOK_URL,
          event_action: e.action,
          event_object: e.object,
        });
        ok++;
      } catch { /* continue */ }
    }
    toast.success(`${ok} webhooks criados!`);
    loadWebhooks();
    setLoading(false);
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(WEBHOOK_URL);
    toast.success('URL copiada!');
  };

  const handleImportStages = async () => {
    setImportingStages(true);
    try {
      // 1. Get pipelines
      const pipelinesRes = await callPipedriveApi('get_pipelines');
      const allPipelines = pipelinesRes?.data || [];
      setPipelines(allPipelines);

      // 2. Get stages for each pipeline
      let allStages: { name: string; pipeline: string; order: number }[] = [];
      for (const p of allPipelines) {
        const stagesRes = await callPipedriveApi('get_stages', { pipeline_id: p.id });
        const stages = stagesRes?.data || [];
        stages.forEach((s: any) => {
          allStages.push({ name: s.name, pipeline: p.name, order: s.order_nr || 0 });
        });
      }

      // 3. Get existing stage tags to avoid duplicates
      const { data: existingTags } = await supabase.from('wa_tags').select('name').eq('is_stage', true);
      const existingNames = new Set((existingTags || []).map(t => t.name.toLowerCase()));

      // 4. Create missing stages as tags
      const STAGE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#06b6d4', '#6b7280'];
      let created = 0;
      for (const stage of allStages) {
        const tagName = allPipelines.length > 1 ? `${stage.pipeline} → ${stage.name}` : stage.name;
        if (!existingNames.has(tagName.toLowerCase())) {
          await supabase.from('wa_tags').insert({
            name: tagName,
            color: STAGE_COLORS[created % STAGE_COLORS.length],
            is_stage: true,
            sort_order: stage.order,
          });
          created++;
        }
      }

      toast.success(`Importação concluída! ${created} etapas novas criadas, ${allStages.length - created} já existiam.`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao importar etapas');
    }
    setImportingStages(false);
  };

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ExternalLink className="w-4 h-4 text-primary" />
              Integração Pipedrive
            </CardTitle>
            <Badge variant="outline" className="text-xs">
              <Check className="w-3 h-3 mr-1" /> API Token Configurado
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Deals', value: stats.deals, color: 'text-blue-500' },
              { label: 'Contatos', value: stats.persons, color: 'text-green-500' },
              { label: 'Atividades', value: stats.activities, color: 'text-amber-500' },
              { label: 'Notas', value: stats.notes, color: 'text-purple-500' },
            ].map(s => (
              <div key={s.label} className="rounded-lg bg-muted/50 p-3 text-center">
                <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-muted-foreground">{s.label} sincronizados</div>
              </div>
            ))}
          </div>

          {/* Sync Button */}
          <div className="flex gap-2">
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowDownUp className="w-4 h-4" />}
              {syncing ? 'Sincronizando...' : 'Sincronizar Tudo'}
            </Button>
            <Button onClick={() => { loadStats(); loadLogs(); }} variant="outline" className="gap-2">
              <RefreshCw className="w-4 h-4" /> Atualizar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Webhook Config */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Link2 className="w-4 h-4 text-primary" />
            Webhooks do Pipedrive
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">URL do Webhook (copie para o Pipedrive)</label>
            <div className="flex gap-2">
              <Input value={WEBHOOK_URL} readOnly className="text-xs font-mono" />
              <Button onClick={copyUrl} variant="outline" size="sm" className="gap-1">
                <Copy className="w-3.5 h-3.5" /> Copiar
              </Button>
            </div>
          </div>

          {/* Quick setup */}
          <div className="flex gap-2 flex-wrap">
            <Button onClick={handleCreateAllWebhooks} disabled={loading} variant="default" className="gap-2 text-xs">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Link2 className="w-3.5 h-3.5" />}
              Criar Todos os Webhooks Automaticamente
            </Button>
          </div>

          {/* Existing webhooks */}
          {webhooksLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando webhooks...</div>
          ) : webhooks.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground">Webhooks ativos ({webhooks.length})</div>
              {webhooks.map((wh: any) => (
                <div key={wh.id} className="flex items-center justify-between rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <Badge variant={wh.is_active ? 'default' : 'secondary'} className="text-[10px]">
                      {wh.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <span className="text-xs font-mono">{wh.event_action}.{wh.event_object}</span>
                  </div>
                  <Button onClick={() => handleDeleteWebhook(wh.id)} variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <AlertCircle className="w-3.5 h-3.5" /> Nenhum webhook configurado. Clique acima para criar automaticamente.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent webhook logs */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Últimos Eventos Recebidos</CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhum evento recebido ainda.</p>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {logs.map((log: any) => (
                <div key={log.id} className="flex items-center gap-2 text-xs rounded-lg border border-border p-2">
                  <Badge variant={log.processed ? 'default' : 'secondary'} className="text-[10px]">
                    {log.processed ? '✓' : '⏳'}
                  </Badge>
                  <span className="font-mono text-muted-foreground">{log.event}.{log.entity}</span>
                  {log.pipedrive_id && <span className="text-muted-foreground">#{log.pipedrive_id}</span>}
                  <span className="ml-auto text-muted-foreground">
                    {new Date(log.created_at).toLocaleString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
