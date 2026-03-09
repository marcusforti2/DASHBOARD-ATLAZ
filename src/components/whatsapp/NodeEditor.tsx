import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Clock, Target, MessageSquare, Send, X, Radio, Timer, GitBranch,
  Sparkles, Shuffle, Webhook, Bot, BarChart3,
  ToggleLeft, ToggleRight, Users, ShieldCheck, UserCheck, CheckCircle2, Loader2,
} from "lucide-react";
import { type FlowNodeType, NODE_REGISTRY } from "./flow-nodes";

interface NodeEditorProps {
  type: FlowNodeType;
  nodeId: string;
  config: Record<string, any>;
  onChange: (config: Record<string, any>) => void;
  onClose: () => void;
  onDelete?: () => void;
}

const AUDIENCE_OPTIONS = [
  { value: "all", label: "Todos", icon: Users },
  { value: "team", label: "Equipe", icon: UserCheck },
  { value: "sdrs", label: "SDRs", icon: UserCheck },
  { value: "closers", label: "Closers", icon: UserCheck },
  { value: "admins", label: "Admins", icon: ShieldCheck },
];

const SCHEDULE_PRESETS = [
  { label: "Manual", cron: null },
  { label: "8h Seg-Sex", cron: "0 11 * * 1-5" },
  { label: "12h Seg-Sex", cron: "0 15 * * 1-5" },
  { label: "18h Seg-Sex", cron: "0 21 * * 1-5" },
  { label: "Segunda 9h", cron: "0 12 * * 1" },
  { label: "Sexta 17h", cron: "0 20 * * 5" },
];

const TEMPLATE_VARS = ["{{nome}}", "{{data}}", "{{role}}", "{{metricas_hoje}}", "{{progresso_meta}}", "{{ranking}}", "{{dicas_ia}}"];

export default function NodeEditor({ type, nodeId, config, onChange, onClose, onDelete }: NodeEditorProps) {
  const reg = NODE_REGISTRY[type];
  if (!reg) return null;
  const Icon = reg.icon;

  const update = (key: string, value: any) => {
    onChange({ ...config, [key]: value });
  };

  return (
    <div className="h-full overflow-auto p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl ${reg.bg} flex items-center justify-center`}>
            <Icon size={16} className={reg.color} />
          </div>
          <div>
            <span className="text-sm font-bold text-card-foreground">{reg.label}</span>
            <p className="text-[9px] text-muted-foreground">{reg.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {onDelete && type !== "trigger" && type !== "send" && (
            <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-destructive/10 text-destructive transition-colors text-[10px]">
              Remover
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* ─── TRIGGER ─── */}
      {type === "trigger" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quando disparar?</p>
          <div className="grid grid-cols-2 gap-2">
            {SCHEDULE_PRESETS.map(p => (
              <button key={p.label}
                onClick={() => update("schedule_cron", p.cron)}
                className={`px-3 py-2.5 text-[11px] rounded-xl border transition-all ${
                  config.schedule_cron === p.cron
                    ? "border-blue-500 bg-blue-500/15 text-blue-400 font-bold"
                    : "border-border bg-secondary text-secondary-foreground hover:border-blue-500/40"
                }`}>
                {p.cron === null ? <Radio size={10} className="inline mr-1" /> : <Clock size={10} className="inline mr-1" />}
                {p.label}
              </button>
            ))}
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Cron customizado (UTC)</label>
            <input
              value={config.schedule_cron || ""}
              onChange={e => update("schedule_cron", e.target.value || null)}
              placeholder="0 21 * * 1-5"
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-mono text-secondary-foreground focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {/* ─── AUDIENCE ─── */}
      {type === "audience" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quem recebe?</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              return (
                <button key={opt.value}
                  onClick={() => update("target_audience", opt.value)}
                  className={`px-4 py-2.5 text-[11px] rounded-xl border transition-all flex items-center gap-2 ${
                    config.target_audience === opt.value
                      ? "border-purple-500 bg-purple-500/15 text-purple-400 font-bold"
                      : "border-border bg-secondary text-secondary-foreground hover:border-purple-500/40"
                  }`}>
                  <OptIcon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-4 mt-2">
            <button onClick={() => update("include_metrics", !config.include_metrics)}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {config.include_metrics ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              📊 Métricas
            </button>
            <button onClick={() => update("include_ai_tips", !config.include_ai_tips)}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {config.include_ai_tips ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              💡 Dicas IA
            </button>
          </div>
        </div>
      )}

      {/* ─── MESSAGE ─── */}
      {type === "message" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Modelo da Mensagem</p>
          <textarea
            value={config.message_template || ""}
            onChange={e => update("message_template", e.target.value)}
            rows={8}
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-[11px] font-mono text-secondary-foreground focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARS.map(v => (
              <button key={v}
                onClick={() => update("message_template", (config.message_template || "") + " " + v)}
                className="px-2 py-1 text-[9px] rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-mono transition-colors">
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── SEND ─── */}
      {type === "send" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-[11px] text-card-foreground">
            Enviará via WhatsApp para os contatos definidos no bloco de Público.
          </span>
        </div>
      )}

      {/* ─── DELAY ─── */}
      {type === "delay" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Tempo de espera</p>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground font-semibold uppercase">Quantidade</label>
              <input
                type="number"
                min={1}
                value={config.delay_value || 30}
                onChange={e => update("delay_value", parseInt(e.target.value) || 1)}
                className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-2 focus:ring-amber-500 outline-none"
              />
            </div>
            <div className="flex-1">
              <label className="text-[9px] text-muted-foreground font-semibold uppercase">Unidade</label>
              <div className="mt-1 flex gap-1.5">
                {(["min", "hora", "dia"] as const).map(u => (
                  <button key={u}
                    onClick={() => update("delay_unit", u)}
                    className={`flex-1 px-2 py-2 text-[10px] rounded-xl border transition-all ${
                      (config.delay_unit || "min") === u
                        ? "border-amber-500 bg-amber-500/15 text-amber-400 font-bold"
                        : "border-border bg-secondary text-secondary-foreground hover:border-amber-500/40"
                    }`}>
                    {u}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <p className="text-[9px] text-muted-foreground">
            ⏳ O fluxo aguardará {config.delay_value || 30} {config.delay_unit || "min"} antes de continuar.
          </p>
        </div>
      )}

      {/* ─── CONDITION ─── */}
      {type === "condition" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Regra condicional</p>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Campo</label>
            <select
              value={config.condition_field || "role"}
              onChange={e => update("condition_field", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-2 focus:ring-orange-500 outline-none"
            >
              <option value="role">Função (SDR/Closer)</option>
              <option value="meta_progress">Progresso da Meta (%)</option>
              <option value="metrics_today">Métricas Hoje ({">"}0)</option>
              <option value="ranking">Posição no Ranking</option>
              <option value="days_inactive">Dias sem atividade</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Operador</label>
            <select
              value={config.condition_operator || "equals"}
              onChange={e => update("condition_operator", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground outline-none"
            >
              <option value="equals">Igual a</option>
              <option value="not_equals">Diferente de</option>
              <option value="greater_than">Maior que</option>
              <option value="less_than">Menor que</option>
              <option value="contains">Contém</option>
            </select>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Valor</label>
            <input
              value={config.condition_value || ""}
              onChange={e => update("condition_value", e.target.value)}
              placeholder="ex: sdr, 80, 3"
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="flex gap-2 p-2 rounded-xl bg-orange-500/5 border border-orange-500/20 text-[9px] text-muted-foreground">
            <GitBranch size={12} className="text-orange-400 flex-shrink-0 mt-0.5" />
            <span>Saída <strong className="text-green-400">✓ Verdadeiro</strong> (topo) e <strong className="text-red-400">✗ Falso</strong> (baixo)</span>
          </div>
        </div>
      )}

      {/* ─── AI MESSAGE ─── */}
      {type === "ai_message" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Prompt para a IA</p>
          <textarea
            value={config.ai_prompt || ""}
            onChange={e => update("ai_prompt", e.target.value)}
            rows={5}
            placeholder="Ex: Gere uma mensagem motivacional personalizada baseada no desempenho do {{nome}} hoje..."
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-[11px] text-secondary-foreground focus:ring-2 focus:ring-cyan-500 outline-none resize-none"
          />
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Tom da mensagem</label>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {["motivacional", "profissional", "casual", "urgente", "coaching"].map(t => (
                <button key={t}
                  onClick={() => update("ai_tone", t)}
                  className={`px-3 py-1.5 text-[10px] rounded-xl border transition-all capitalize ${
                    config.ai_tone === t
                      ? "border-cyan-500 bg-cyan-500/15 text-cyan-400 font-bold"
                      : "border-border bg-secondary text-secondary-foreground hover:border-cyan-500/40"
                  }`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TEMPLATE_VARS.map(v => (
              <button key={v}
                onClick={() => update("ai_prompt", (config.ai_prompt || "") + " " + v)}
                className="px-2 py-1 text-[9px] rounded-lg bg-cyan-500/10 text-cyan-500 hover:bg-cyan-500/20 font-mono transition-colors">
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ─── A/B TEST ─── */}
      {type === "ab_test" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Divisão do teste</p>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">% para variante A</label>
            <input
              type="range"
              min={10}
              max={90}
              step={10}
              value={config.split_a || 50}
              onChange={e => update("split_a", parseInt(e.target.value))}
              className="mt-2 w-full accent-pink-500"
            />
            <div className="flex justify-between text-[10px] mt-1">
              <span className="text-pink-400 font-bold">A: {config.split_a || 50}%</span>
              <span className="text-pink-600 font-bold">B: {100 - (config.split_a || 50)}%</span>
            </div>
          </div>
          <div className="flex gap-2 p-2 rounded-xl bg-pink-500/5 border border-pink-500/20 text-[9px] text-muted-foreground">
            <Shuffle size={12} className="text-pink-400 flex-shrink-0 mt-0.5" />
            <span>Os contatos serão divididos aleatoriamente entre os caminhos A e B</span>
          </div>
        </div>
      )}

      {/* ─── WEBHOOK ─── */}
      {type === "webhook" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Configuração do Webhook</p>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">URL</label>
            <input
              value={config.webhook_url || ""}
              onChange={e => update("webhook_url", e.target.value)}
              placeholder="https://api.example.com/webhook"
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-mono text-secondary-foreground focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Método</label>
            <div className="mt-1 flex gap-1.5">
              {["POST", "GET", "PUT"].map(m => (
                <button key={m}
                  onClick={() => update("webhook_method", m)}
                  className={`px-3 py-1.5 text-[10px] rounded-xl border font-mono transition-all ${
                    (config.webhook_method || "POST") === m
                      ? "border-indigo-500 bg-indigo-500/15 text-indigo-400 font-bold"
                      : "border-border bg-secondary text-secondary-foreground hover:border-indigo-500/40"
                  }`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Headers (JSON)</label>
            <textarea
              value={config.webhook_headers || '{"Content-Type": "application/json"}'}
              onChange={e => update("webhook_headers", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[10px] font-mono text-secondary-foreground outline-none resize-none"
            />
          </div>
        </div>
      )}

      {/* ─── AI ACTION ─── */}
      {type === "ai_action" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Ação da IA</p>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">O que a IA deve fazer?</label>
            <select
              value={config.ai_action_type || "classify"}
              onChange={e => update("ai_action_type", e.target.value)}
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground outline-none"
            >
              <option value="classify">Classificar lead (quente/morno/frio)</option>
              <option value="score">Calcular lead score</option>
              <option value="suggest_action">Sugerir próxima ação</option>
              <option value="analyze_sentiment">Analisar sentimento</option>
              <option value="custom">Prompt customizado</option>
            </select>
          </div>
          {config.ai_action_type === "custom" && (
            <textarea
              value={config.ai_custom_prompt || ""}
              onChange={e => update("ai_custom_prompt", e.target.value)}
              rows={4}
              placeholder="Descreva o que a IA deve analisar ou decidir..."
              className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-[11px] text-secondary-foreground outline-none resize-none"
            />
          )}
        </div>
      )}

      {/* ─── ANALYTICS ─── */}
      {type === "analytics" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Rastreamento</p>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Nome do evento</label>
            <input
              value={config.event_name || ""}
              onChange={e => update("event_name", e.target.value)}
              placeholder="ex: mensagem_enviada, meta_batida"
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs text-secondary-foreground focus:ring-2 focus:ring-rose-500 outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground font-semibold uppercase">Propriedades extras (JSON)</label>
            <textarea
              value={config.event_properties || '{}'}
              onChange={e => update("event_properties", e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-[10px] font-mono text-secondary-foreground outline-none resize-none"
            />
          </div>
          <div className="flex gap-2 p-2 rounded-xl bg-rose-500/5 border border-rose-500/20 text-[9px] text-muted-foreground">
            <BarChart3 size={12} className="text-rose-400 flex-shrink-0 mt-0.5" />
            <span>O evento será registrado para cada contato que passar por este ponto do fluxo</span>
          </div>
        </div>
      )}
    </div>
  );
}
