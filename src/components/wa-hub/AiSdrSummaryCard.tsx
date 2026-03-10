import { Bot, ToggleRight, ToggleLeft, ExternalLink, MessageSquare, ArrowRight, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Instance {
  id: string;
  instance_name: string;
  is_connected: boolean;
  ai_sdr_enabled: boolean;
  ai_sdr_config: any;
  closer_id: string | null;
  sdr_id: string | null;
}

interface Props {
  instances: Instance[];
  teamMembers: { id: string; name: string; member_role: string }[];
  onNavigate: () => void;
}

export function AiSdrSummaryCard({ instances, teamMembers, onNavigate }: Props) {
  const activeInstances = instances.filter(i => i.ai_sdr_enabled);
  const [stats, setStats] = useState({ totalMessages: 0, handoffs: 0 });

  useEffect(() => {
    const load = async () => {
      const [msgRes, handoffRes] = await Promise.all([
        supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("agent_name", "SDR IA 🤖"),
        supabase.from("proactive_alerts").select("*", { count: "exact", head: true }).eq("alert_type", "ai_handoff"),
      ]);
      setStats({ totalMessages: msgRes.count || 0, handoffs: handoffRes.count || 0 });
    };
    load();
  }, []);

  const getCloserName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
              <Bot className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                SDR de Inteligência Artificial
                <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                  {activeInstances.length} ativa{activeInstances.length !== 1 ? "s" : ""}
                </Badge>
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Agente autônomo que qualifica, pontua e agenda reuniões — 24h por dia.
              </p>
            </div>
          </div>
          <Button onClick={onNavigate} className="gap-2 shrink-0">
            <ExternalLink className="w-4 h-4" />
            Abrir painel completo
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-foreground">{stats.totalMessages}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <MessageSquare className="w-3 h-3" /> Mensagens enviadas
            </p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-foreground">{stats.handoffs}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <ArrowRight className="w-3 h-3" /> Handoffs
            </p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-primary">{activeInstances.length}</p>
            <p className="text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Zap className="w-3 h-3" /> Instâncias IA
            </p>
          </div>
        </div>
      </div>

      {/* Instance overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {instances.map(inst => {
          const name = inst.instance_name.replace(/^wpp_/i, "").replace(/^\w/, (c: string) => c.toUpperCase());
          const config = inst.ai_sdr_config || {};
          const featureCount = [
            config.feature_auto_reply !== false,
            config.feature_auto_tag !== false,
            config.feature_qualification !== false,
            config.feature_handoff !== false,
            config.feature_sentiment,
            config.feature_pipedrive_sync,
            config.call_focus_mode !== false,
            config.follow_up_enabled !== false,
            config.split_messages !== false,
            config.urgent_call_alert !== false,
            config.meeting_followups !== false,
          ].filter(Boolean).length;

          return (
            <div key={inst.id} className={`rounded-xl border p-4 transition-all ${
              inst.ai_sdr_enabled ? "border-primary/30 bg-primary/5" : "border-border bg-card"
            }`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${inst.is_connected ? "bg-green-500" : "bg-red-400"}`} />
                  <span className="text-sm font-bold text-foreground">{name}</span>
                </div>
                {inst.ai_sdr_enabled ? (
                  <Badge className="text-[9px] bg-primary/15 text-primary border-primary/30">IA Ativa</Badge>
                ) : (
                  <Badge variant="secondary" className="text-[9px]">Off</Badge>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Closer: {getCloserName(inst.closer_id)}
              </p>
              {inst.ai_sdr_enabled && (
                <p className="text-[10px] text-primary mt-1 font-medium">
                  {featureCount} automações · Tom: {config.tone || "profissional"}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA */}
      <div className="text-center">
        <Button variant="outline" onClick={onNavigate} className="gap-2">
          <ExternalLink className="w-4 h-4" />
          Configurar SDR IA em detalhe
        </Button>
      </div>
    </div>
  );
}