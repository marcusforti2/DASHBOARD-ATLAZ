import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, Sparkles, MessageSquare, Users, Tag, Clock,
  ToggleLeft, ToggleRight, Loader2, Save, Settings2,
  ArrowRight, Shield, Zap, Brain, Phone, CheckCircle2,
  AlertTriangle, TrendingUp, Send, Calendar, Target,
  Plus, Trash2, GripVertical,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AiSdrFlowView } from "./AiSdrFlowView";
import { RoutingPanel } from "./RoutingPanel";

import type { AiSdrConfig } from '@/domains/ai-sdr/types';
import { DEFAULT_AI_SDR_CONFIG, AI_SDR_TONES } from '@/domains/ai-sdr/types';

interface Instance {
  id: string;
  instance_name: string;
  is_connected: boolean;
  ai_sdr_enabled: boolean;
  ai_sdr_config: any;
  closer_id: string | null;
  sdr_id: string | null;
}

const DEFAULT_CONFIG = DEFAULT_AI_SDR_CONFIG;

interface Props {
  instances: Instance[];
  teamMembers: { id: string; name: string; member_role: string }[];
  onRefetch: () => void;
}

export function AiSdrTab({ instances, teamMembers, onRefetch }: Props) {
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [localConfig, setLocalConfig] = useState<AiSdrConfig>(DEFAULT_CONFIG);
  const [stats, setStats] = useState({ totalMessages: 0, handoffs: 0, activeInstances: 0 });

  const selectedInstance = instances.find(i => i.id === selectedInstanceId);
  const activeAiInstances = instances.filter(i => i.ai_sdr_enabled);
  const closerName = useMemo(() => {
    if (!selectedInstance?.closer_id) return "";
    return teamMembers.find(m => m.id === selectedInstance.closer_id)?.name || "";
  }, [selectedInstance?.closer_id, teamMembers]);

  useEffect(() => {
    if (instances.length > 0 && !selectedInstanceId) setSelectedInstanceId(instances[0].id);
  }, [instances]);

  useEffect(() => {
    if (selectedInstance) setLocalConfig({ ...DEFAULT_CONFIG, ...(selectedInstance.ai_sdr_config || {}) });
  }, [selectedInstanceId, selectedInstance?.ai_sdr_config]);

  useEffect(() => {
    const loadStats = async () => {
      const { count: msgCount } = await supabase.from("wa_messages").select("*", { count: "exact", head: true }).eq("agent_name", "SDR IA 🤖");
      const { count: handoffCount } = await supabase.from("proactive_alerts").select("*", { count: "exact", head: true }).eq("alert_type", "ai_handoff");
      setStats({ totalMessages: msgCount || 0, handoffs: handoffCount || 0, activeInstances: activeAiInstances.length });
    };
    loadStats();
  }, [instances]);

  const handleToggle = async () => {
    if (!selectedInstance) return;
    setToggling(true);
    const { error } = await supabase.from("wa_instances").update({ ai_sdr_enabled: !selectedInstance.ai_sdr_enabled } as any).eq("id", selectedInstance.id);
    setToggling(false);
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(selectedInstance.ai_sdr_enabled ? "SDR IA desativada" : "SDR IA ativada! 🤖");
    onRefetch();
  };

  const handleSave = async () => {
    if (!selectedInstance) return;
    setSaving(true);
    const { error } = await supabase.from("wa_instances").update({ ai_sdr_config: localConfig } as any).eq("id", selectedInstance.id);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração salva! ✅");
    onRefetch();
  };

  const update = (key: keyof AiSdrConfig, value: any) => setLocalConfig(prev => ({ ...prev, [key]: value }));

  const addQuestion = () => {
    const questions = [...(localConfig.qualification_questions || []), ""];
    update("qualification_questions", questions);
  };

  const removeQuestion = (index: number) => {
    const questions = (localConfig.qualification_questions || []).filter((_: string, i: number) => i !== index);
    update("qualification_questions", questions);
  };

  const updateQuestion = (index: number, value: string) => {
    const questions = [...(localConfig.qualification_questions || [])];
    questions[index] = value;
    update("qualification_questions", questions);
  };

  const updateThreshold = (key: "a_min" | "b_min", value: number) => {
    update("score_thresholds", { ...localConfig.score_thresholds, [key]: value });
  };

  const getCloserName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";
  const getSdrName = (id: string | null) => teamMembers.find(m => m.id === id)?.name || "—";

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-primary/5 p-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
            <Bot className="w-7 h-7 text-primary" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              SDR de Inteligência Artificial
              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/10">
                {activeAiInstances.length} ativa{activeAiInstances.length !== 1 ? "s" : ""}
              </Badge>
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Agente autônomo que qualifica, pontua e agenda reuniões — 24h por dia.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mt-5">
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-foreground">{stats.totalMessages}</p>
            <p className="text-[10px] text-muted-foreground">Mensagens enviadas</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-foreground">{stats.handoffs}</p>
            <p className="text-[10px] text-muted-foreground">Handoffs realizados</p>
          </div>
          <div className="rounded-xl bg-card border border-border p-3 text-center">
            <p className="text-xl font-bold text-primary">{stats.activeInstances}</p>
            <p className="text-[10px] text-muted-foreground">Instâncias com IA</p>
          </div>
        </div>
      </div>

      {/* Routing Map */}
      <RoutingPanel />

      {/* Instance overview (read-only) */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Instâncias
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {instances.map(inst => {
            const name = inst.instance_name.replace(/^wpp_/i, "").replace(/^\w/, (c: string) => c.toUpperCase());
            const config = { ...DEFAULT_CONFIG, ...(inst.ai_sdr_config || {}) };
            const featureCount = [
              config.feature_auto_reply, config.feature_auto_tag, config.feature_qualification,
              config.feature_handoff, config.feature_sentiment, config.feature_pipedrive_sync,
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
                  SDR: {teamMembers.find(m => m.id === inst.sdr_id)?.name || "—"} · Closer: {teamMembers.find(m => m.id === inst.closer_id)?.name || "—"}
                </p>
                {inst.ai_sdr_enabled && (
                  <p className="text-[10px] text-primary mt-1 font-medium">
                    {featureCount} features · Tom: {config.tone || "profissional"}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-muted-foreground text-center">
          Para configurar funcionalidades, prompts e qualificação, acesse o <strong>Painel completo da SDR IA</strong>.
        </p>
      </div>
    </div>
  );
}
