import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight, CheckCircle2, XCircle, AlertTriangle,
  Phone, User, Bot, Wifi, WifiOff, Mail,
} from "lucide-react";

interface RoutingMap {
  instance_name: string;
  instance_id: string;
  is_connected: boolean;
  ai_sdr_enabled: boolean;
  closer_name: string | null;
  closer_email: string | null;
  sdr_name: string | null;
  phone: string | null;
  lead_sources: { name: string; pipedrive_label_id: number; active: boolean }[];
  issues: string[];
}

export function RoutingPanel() {
  const [routes, setRoutes] = useState<RoutingMap[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch = async () => {
      const { data: instances } = await supabase
        .from("wa_instances")
        .select("id, instance_name, is_connected, ai_sdr_enabled, ai_sdr_config, closer_id, sdr_id, phone");

      if (!instances) { setLoading(false); return; }

      const closerIds = instances.map(i => i.closer_id).filter(Boolean);
      const sdrIds = instances.map(i => i.sdr_id).filter(Boolean);
      const allIds = [...new Set([...closerIds, ...sdrIds])];

      const { data: members } = await supabase
        .from("team_members")
        .select("id, name, email")
        .in("id", allIds.length > 0 ? allIds : ["__none__"]);

      const memberMap = new Map((members || []).map(m => [m.id, m]));

      const mapped: RoutingMap[] = instances.map(inst => {
        const closer = inst.closer_id ? memberMap.get(inst.closer_id) : null;
        const sdr = inst.sdr_id ? memberMap.get(inst.sdr_id) : null;
        const config = (inst.ai_sdr_config as any) || {};
        const leadSources = (config.lead_sources || []) as any[];

        const issues: string[] = [];
        if (!inst.is_connected) issues.push("Instância desconectada");
        if (!inst.ai_sdr_enabled) issues.push("SDR IA desabilitada");
        if (!closer) issues.push("Sem closer vinculado");
        if (closer && !closer.email) issues.push("Closer sem email (não será roteado pelo Pipedrive)");
        if (inst.ai_sdr_enabled && leadSources.filter((s: any) => s.active).length === 0)
          issues.push("Sem lead sources configuradas");

        return {
          instance_name: inst.instance_name,
          instance_id: inst.id,
          is_connected: inst.is_connected,
          ai_sdr_enabled: inst.ai_sdr_enabled,
          closer_name: closer?.name || null,
          closer_email: closer?.email || null,
          sdr_name: sdr?.name || null,
          phone: inst.phone,
          lead_sources: leadSources,
          issues,
        };
      });

      setRoutes(mapped);
      setLoading(false);
    };
    fetch();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Bot className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Mapa de Roteamento</h3>
        <Badge variant="outline" className="ml-auto">{routes.length} instâncias</Badge>
      </div>

      <p className="text-sm text-muted-foreground">
        Quando um deal entra no Pipedrive, o sistema identifica o <strong>dono do deal → email → closer → instância WhatsApp</strong> e dispara a SDR IA proativa.
      </p>

      <div className="grid gap-3">
        {routes.map(r => (
          <Card
            key={r.instance_id}
            className={`border ${r.issues.length === 0 ? "border-green-500/30 bg-green-500/5" : r.issues.length <= 1 ? "border-yellow-500/30 bg-yellow-500/5" : "border-red-500/30 bg-red-500/5"}`}
          >
            <CardContent className="pt-4 pb-3 px-4">
              {/* Flow row */}
              <div className="flex items-center gap-2 flex-wrap text-sm">
                {/* Pipedrive owner */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-mono text-xs">
                    {r.closer_email || <span className="text-destructive">sem email</span>}
                  </span>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* Closer */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1">
                  <User className="h-3.5 w-3.5 text-primary" />
                  <span className="font-medium">{r.closer_name || <span className="text-destructive">—</span>}</span>
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* Instance */}
                <div className="flex items-center gap-1.5 bg-muted/50 rounded-lg px-2 py-1">
                  {r.is_connected
                    ? <Wifi className="h-3.5 w-3.5 text-green-500" />
                    : <WifiOff className="h-3.5 w-3.5 text-destructive" />}
                  <span className="font-mono text-xs">{r.instance_name}</span>
                  {r.phone && (
                    <span className="text-muted-foreground text-[10px]">({r.phone})</span>
                  )}
                </div>

                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

                {/* SDR IA */}
                <div className="flex items-center gap-1 bg-muted/50 rounded-lg px-2 py-1">
                  <Bot className="h-3.5 w-3.5" />
                  {r.ai_sdr_enabled
                    ? <Badge className="bg-green-500/20 text-green-400 text-[10px] px-1">ON</Badge>
                    : <Badge variant="secondary" className="text-[10px] px-1">OFF</Badge>}
                </div>
              </div>

              {/* SDR name */}
              {r.sdr_name && (
                <p className="text-xs text-muted-foreground mt-1.5 ml-1">
                  SDR humano: {r.sdr_name}
                </p>
              )}

              {/* Lead sources */}
              {r.lead_sources.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {r.lead_sources.map((ls, i) => (
                    <Badge
                      key={i}
                      variant={ls.active ? "default" : "secondary"}
                      className="text-[10px]"
                    >
                      {ls.name || `Label ${ls.pipedrive_label_id}`}
                      {!ls.active && " (off)"}
                    </Badge>
                  ))}
                </div>
              )}

              {/* Issues */}
              {r.issues.length > 0 && (
                <div className="mt-2 space-y-0.5">
                  {r.issues.map((issue, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs text-yellow-500">
                      <AlertTriangle className="h-3 w-3 shrink-0" />
                      {issue}
                    </div>
                  ))}
                </div>
              )}

              {/* Status badge */}
              {r.issues.length === 0 && (
                <div className="flex items-center gap-1 mt-2 text-xs text-green-500">
                  <CheckCircle2 className="h-3 w-3" />
                  Roteamento configurado corretamente
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
