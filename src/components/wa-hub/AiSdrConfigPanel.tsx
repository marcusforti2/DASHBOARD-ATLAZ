import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Bot, ToggleLeft, ToggleRight, ChevronDown, ChevronUp,
  Loader2, Save, Settings2, MessageSquare, Users, Clock, Sparkles,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

interface AiSdrConfig {
  greeting: string;
  tone: string;
  auto_tag: boolean;
  max_messages_before_handoff: number;
  business_hours_only: boolean;
  prompt_context: string;
  follow_up_hours: number;
  follow_up_enabled: boolean;
  call_focus_mode: boolean;
}

interface Props {
  instanceId: string;
  instanceName: string;
  aiSdrEnabled: boolean;
  aiSdrConfig: AiSdrConfig;
  onUpdate: () => void;
}

const DEFAULT_CONFIG: AiSdrConfig = {
  greeting: "Olá! 👋 Obrigado por entrar em contato. Como posso ajudar você hoje?",
  tone: "profissional",
  auto_tag: true,
  max_messages_before_handoff: 10,
  business_hours_only: false,
  prompt_context: "",
  follow_up_hours: 24,
  follow_up_enabled: true,
  call_focus_mode: true,
};

const TONES = [
  { value: "profissional", label: "Profissional", emoji: "💼" },
  { value: "casual", label: "Casual", emoji: "😊" },
  { value: "consultivo", label: "Consultivo", emoji: "🎯" },
  { value: "energetico", label: "Energético", emoji: "⚡" },
];

export function AiSdrConfigPanel({ instanceId, instanceName, aiSdrEnabled, aiSdrConfig, onUpdate }: Props) {
  const config = { ...DEFAULT_CONFIG, ...aiSdrConfig };
  const [expanded, setExpanded] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localConfig, setLocalConfig] = useState<AiSdrConfig>(config);

  const handleToggle = async () => {
    setToggling(true);
    const { error } = await supabase
      .from("wa_instances")
      .update({ ai_sdr_enabled: !aiSdrEnabled } as any)
      .eq("id", instanceId);
    setToggling(false);
    if (error) { toast.error("Erro ao alterar"); return; }
    toast.success(aiSdrEnabled ? "SDR IA desativada" : "SDR IA ativada! 🤖");
    onUpdate();
  };

  const handleSave = async () => {
    setSaving(true);
    const { error } = await supabase
      .from("wa_instances")
      .update({ ai_sdr_config: localConfig } as any)
      .eq("id", instanceId);
    setSaving(false);
    if (error) { toast.error("Erro ao salvar"); return; }
    toast.success("Configuração da SDR IA salva! ✅");
    onUpdate();
  };

  const update = (key: keyof AiSdrConfig, value: any) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <div className={`rounded-xl border transition-all ${aiSdrEnabled ? "border-primary/30 bg-primary/5" : "border-border bg-secondary/20"}`}>
      {/* Toggle Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${aiSdrEnabled ? "bg-primary/20" : "bg-muted"}`}>
            <Bot size={16} className={aiSdrEnabled ? "text-primary" : "text-muted-foreground"} />
          </div>
          <div>
            <p className="text-xs font-bold text-card-foreground flex items-center gap-2">
              SDR IA
              {aiSdrEnabled && (
                <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold animate-pulse">
                  ATIVA
                </span>
              )}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {aiSdrEnabled ? "Respondendo leads automaticamente" : "Agente de IA desativado"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {aiSdrEnabled && (
            <button onClick={() => setExpanded(!expanded)}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <Settings2 size={14} className="text-muted-foreground" />}
            </button>
          )}
          <button onClick={handleToggle} disabled={toggling}
            className="flex items-center gap-1.5 transition-colors">
            {toggling ? (
              <Loader2 size={18} className="animate-spin text-primary" />
            ) : aiSdrEnabled ? (
              <ToggleRight size={24} className="text-primary" />
            ) : (
              <ToggleLeft size={24} className="text-muted-foreground" />
            )}
          </button>
        </div>
      </div>

      {/* Config Panel */}
      {expanded && aiSdrEnabled && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-3 animate-in slide-in-from-top-2 duration-200">
          {/* Greeting */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <MessageSquare size={10} /> Primeira mensagem
            </label>
            <Textarea
              value={localConfig.greeting}
              onChange={e => update("greeting", e.target.value)}
              placeholder="Olá! 👋 Como posso ajudar?"
              rows={2}
              className="mt-1 text-xs resize-none"
            />
          </div>

          {/* Tone */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Tom da conversa</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {TONES.map(t => (
                <button key={t.value} onClick={() => update("tone", t.value)}
                  className={`px-3 py-1.5 text-[11px] rounded-lg border transition-all flex items-center gap-1 ${
                    localConfig.tone === t.value
                      ? "border-primary bg-primary/15 text-primary font-bold"
                      : "border-border bg-secondary text-secondary-foreground hover:border-primary/40"
                  }`}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Context */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles size={10} /> Contexto adicional para a IA
            </label>
            <Textarea
              value={localConfig.prompt_context}
              onChange={e => update("prompt_context", e.target.value)}
              placeholder="Ex: Somos uma empresa de software B2B. Nosso ticket médio é R$5.000/mês. Qualifique leads que tenham mais de 50 funcionários..."
              rows={3}
              className="mt-1 text-xs resize-none"
            />
            <p className="text-[9px] text-muted-foreground mt-1">
              Estas instruções guiam o comportamento da IA nas conversas. Quanto mais contexto, melhor a qualificação.
            </p>
          </div>

          {/* Max messages before handoff */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Users size={10} /> Transferir para humano após
            </label>
            <div className="mt-1 flex items-center gap-2">
              <Input
                type="number"
                min={3}
                max={50}
                value={localConfig.max_messages_before_handoff}
                onChange={e => update("max_messages_before_handoff", parseInt(e.target.value) || 10)}
                className="h-8 w-20 text-xs"
              />
              <span className="text-[11px] text-muted-foreground">mensagens</span>
            </div>
          </div>

          {/* Toggles */}
          <div className="flex flex-wrap gap-4">
            <button onClick={() => update("auto_tag", !localConfig.auto_tag)}
              className="flex items-center gap-2 text-[11px] text-card-foreground">
              {localConfig.auto_tag ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              🏷️ Auto-etiquetas
            </button>
            <button onClick={() => update("business_hours_only", !localConfig.business_hours_only)}
              className="flex items-center gap-2 text-[11px] text-card-foreground">
              {localConfig.business_hours_only ? <ToggleRight size={18} className="text-primary" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              <Clock size={12} /> Só horário comercial
            </button>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving}
            className="w-full px-4 py-2.5 text-[11px] rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Salvar Configuração
          </button>
        </div>
      )}
    </div>
  );
}
