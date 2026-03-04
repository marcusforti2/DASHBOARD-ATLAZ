import {
  Clock, Target, MessageSquare, Send, X, Radio,
  ToggleLeft, ToggleRight, Users, ShieldCheck, UserCheck, CheckCircle2,
} from "lucide-react";

interface Automation {
  id: string;
  name: string;
  description: string;
  message_template: string;
  schedule_cron: string | null;
  target_audience: string;
  target_role: string | null;
  include_metrics: boolean;
  include_ai_tips: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
}

type NodeType = "trigger" | "audience" | "message" | "send";

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

function audienceLabel(a: string): string {
  return { all: "Todos", sdrs: "SDRs", closers: "Closers", admins: "Admins", team: "Equipe" }[a] || a;
}

const NODE_META: Record<NodeType, { icon: any; label: string; color: string; bg: string }> = {
  trigger:  { icon: Clock,         label: "Gatilho",  color: "text-blue-400",    bg: "bg-blue-500/10" },
  audience: { icon: Target,        label: "Público",  color: "text-purple-400",  bg: "bg-purple-500/10" },
  message:  { icon: MessageSquare, label: "Mensagem", color: "text-emerald-400", bg: "bg-emerald-500/10" },
  send:     { icon: Send,          label: "Enviar",   color: "text-green-400",   bg: "bg-green-500/10" },
};

interface NodeEditorProps {
  type: NodeType;
  automation: Automation;
  onChange: (d: Partial<Automation>) => void;
  onClose: () => void;
}

export default function NodeEditor({ type, automation, onChange, onClose }: NodeEditorProps) {
  const meta = NODE_META[type];
  const Icon = meta.icon;

  return (
    <div className="h-full overflow-auto p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl ${meta.bg} flex items-center justify-center`}>
            <Icon size={16} className={meta.color} />
          </div>
          <span className="text-sm font-bold text-card-foreground">{meta.label}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
          <X size={14} className="text-muted-foreground" />
        </button>
      </div>

      {type === "trigger" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quando disparar?</p>
          <div className="grid grid-cols-2 gap-2">
            {SCHEDULE_PRESETS.map(p => (
              <button key={p.label}
                onClick={() => onChange({ schedule_cron: p.cron })}
                className={`px-3 py-2.5 text-[11px] rounded-xl border transition-all ${
                  automation.schedule_cron === p.cron
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
              value={automation.schedule_cron || ""}
              onChange={e => onChange({ schedule_cron: e.target.value || null })}
              placeholder="0 21 * * 1-5"
              className="mt-1 w-full rounded-xl border border-border bg-secondary px-3 py-2 text-xs font-mono text-secondary-foreground focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      )}

      {type === "audience" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Quem recebe?</p>
          <div className="flex flex-wrap gap-2">
            {AUDIENCE_OPTIONS.map(opt => {
              const OptIcon = opt.icon;
              return (
                <button key={opt.value}
                  onClick={() => onChange({ target_audience: opt.value })}
                  className={`px-4 py-2.5 text-[11px] rounded-xl border transition-all flex items-center gap-2 ${
                    automation.target_audience === opt.value
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
            <button onClick={() => onChange({ include_metrics: !automation.include_metrics })}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {automation.include_metrics ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              📊 Métricas
            </button>
            <button onClick={() => onChange({ include_ai_tips: !automation.include_ai_tips })}
              className="flex items-center gap-2 text-[11px] text-card-foreground py-1">
              {automation.include_ai_tips ? <ToggleRight size={18} className="text-green-500" /> : <ToggleLeft size={18} className="text-muted-foreground" />}
              💡 Dicas IA
            </button>
          </div>
        </div>
      )}

      {type === "message" && (
        <div className="space-y-3">
          <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider">Modelo da Mensagem</p>
          <textarea
            value={automation.message_template}
            onChange={e => onChange({ message_template: e.target.value })}
            rows={10}
            className="w-full rounded-xl border border-border bg-secondary px-3 py-2.5 text-[11px] font-mono text-secondary-foreground focus:ring-2 focus:ring-emerald-500 outline-none resize-none"
          />
          <div className="flex flex-wrap gap-1.5">
            {["{{nome}}", "{{data}}", "{{role}}", "{{metricas_hoje}}", "{{progresso_meta}}", "{{ranking}}", "{{dicas_ia}}"].map(v => (
              <button key={v}
                onClick={() => onChange({ message_template: automation.message_template + " " + v })}
                className="px-2 py-1 text-[9px] rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-mono transition-colors">
                {v}
              </button>
            ))}
          </div>
        </div>
      )}

      {type === "send" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
          <CheckCircle2 size={14} className="text-green-500" />
          <span className="text-[11px] text-card-foreground">
            Enviará via WhatsApp para contatos do público <strong>{audienceLabel(automation.target_audience)}</strong>.
          </span>
        </div>
      )}
    </div>
  );
}
