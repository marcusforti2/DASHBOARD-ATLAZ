import { motion } from 'framer-motion';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';
import { 
  Zap, Shield, Brain, Target, AlertTriangle, Star, Flame, 
  TrendingUp, Heart, Eye, Swords, Award, Lightbulb, Lock, Unlock
} from 'lucide-react';

interface DashboardData {
  disc: { D: number; I: number; S: number; C: number };
  disc_dominante: string;
  disc_secundario: string;
  closer_type?: string;
  tendency?: string;
  negotiation_score?: number;
  maturity_level: number;
  execution_level?: number;
  super_power?: string;
  selling_style: string;
  recovery_time: string;
  emotional_vices: { name: string; score: number }[];
  principal_vice: string;
  strengths?: string[];
  weaknesses?: string[];
  technical_blocks?: string[];
  emotional_blocks?: string[];
  virtues?: string[];
  skills?: string[];
  attention_points?: string[];
  action_plan?: string[];
  emotional_map?: { area: string; level: number }[];
  sales_risk_stages: { stage: string; risk: number }[];
  critical_stage: string;
  discipline_scores: { name: string; score: number }[];
}

const DISC_LABELS: Record<string, string> = { D: 'Dominância', I: 'Influência', S: 'Estabilidade', C: 'Conformidade' };
const DISC_COLORS: Record<string, string> = { D: '#ef4444', I: '#f59e0b', S: '#22c55e', C: '#3b82f6' };

function ScoreRing({ value, max, label, color, size = 80 }: { value: number; max: number; label: string; color: string; size?: number }) {
  const pct = Math.min((value / max) * 100, 100);
  const r = (size - 10) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth="6" fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth="6" fill="none"
          strokeLinecap="round" strokeDasharray={circ} initial={{ strokeDashoffset: circ }} animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center" style={{ width: size, height: size }}>
        <span className="text-lg font-bold text-foreground">{value}</span>
        <span className="text-[9px] text-muted-foreground">/{max}</span>
      </div>
      <span className="text-[10px] text-muted-foreground text-center leading-tight mt-1">{label}</span>
    </div>
  );
}

function TagList({ items, icon: Icon, color, title }: { items: string[]; icon: any; color: string; title: string }) {
  if (!items || items.length === 0) return null;
  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4" style={{ color }} />
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <motion.span
            key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="px-3 py-1.5 text-xs rounded-lg border border-border bg-muted/50 text-foreground"
          >
            {item}
          </motion.span>
        ))}
      </div>
    </div>
  );
}

function BigCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string; subtitle?: string; icon: any; color: string }) {
  return (
    <motion.div
      className="bg-card border border-border rounded-xl p-5 flex items-start gap-4"
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
    >
      <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: `${color}15` }}>
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">{title}</p>
        <p className="text-sm font-bold text-foreground leading-tight">{value}</p>
        {subtitle && <p className="text-[10px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </motion.div>
  );
}

export default function SubmissionDashboard({ data }: { data: DashboardData }) {
  const discData = [
    { trait: 'Dominância', value: data.disc.D, fullMark: 100 },
    { trait: 'Influência', value: data.disc.I, fullMark: 100 },
    { trait: 'Estabilidade', value: data.disc.S, fullMark: 100 },
    { trait: 'Conformidade', value: data.disc.C, fullMark: 100 },
  ];

  const emotionalData = data.emotional_vices.map(v => ({ name: v.name, valor: v.score }));
  const emotionalMapData = (data.emotional_map || []).map(e => ({ name: e.area, valor: e.level }));
  const disciplineData = data.discipline_scores.map(d => ({ name: d.name, valor: d.score }));

  const dominantColor = DISC_COLORS[data.disc_dominante] || 'hsl(var(--primary))';

  return (
    <div className="space-y-6">
      {/* ── TOP: Identity Row ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <BigCard title="Tipo de Closer" value={data.closer_type || data.selling_style} subtitle={data.tendency} icon={Target} color={dominantColor} />
        <BigCard title="Super Poder" value={data.super_power || '—'} icon={Zap} color="#f59e0b" />
        <BigCard title="Estilo de Venda" value={data.selling_style} icon={Swords} color="#8b5cf6" />
        <BigCard title="Recuperação" value={data.recovery_time} icon={Heart} color="#22c55e" />
      </div>

      {/* ── SCORE RINGS ── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <h3 className="text-sm font-semibold text-foreground mb-4">Scores Gerais</h3>
        <div className="flex flex-wrap items-center justify-center gap-8">
          <div className="relative">
            <ScoreRing value={data.maturity_level} max={10} label="Maturidade" color={data.maturity_level >= 7 ? '#22c55e' : data.maturity_level >= 4 ? '#f59e0b' : '#ef4444'} />
          </div>
          <div className="relative">
            <ScoreRing value={data.execution_level || 0} max={10} label="Execução" color={data.execution_level && data.execution_level >= 7 ? '#22c55e' : '#f59e0b'} />
          </div>
          <div className="relative">
            <ScoreRing value={data.negotiation_score || 0} max={100} label="Negociação" color={data.negotiation_score && data.negotiation_score >= 70 ? '#22c55e' : '#f59e0b'} size={90} />
          </div>
          {Object.entries(data.disc).map(([dim, val]) => (
            <div key={dim} className="relative">
              <ScoreRing value={val} max={100} label={DISC_LABELS[dim] || dim} color={DISC_COLORS[dim] || '#888'} size={70} />
            </div>
          ))}
        </div>
      </div>

      {/* ── DISC + Emotional Map ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-2">Perfil DISC</h3>
          <p className="text-[10px] text-muted-foreground mb-4">
            Dominante: <strong className="text-foreground">{DISC_LABELS[data.disc_dominante]}</strong> · Secundário: <strong className="text-foreground">{DISC_LABELS[data.disc_secundario]}</strong>
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={discData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="trait" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 9 }} />
              <Radar name="DISC" dataKey="value" stroke={dominantColor} fill={dominantColor} fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {emotionalMapData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">Mapa Emocional</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={emotionalMapData} layout="vertical" margin={{ left: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={120} tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
                <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                  {emotionalMapData.map((e, i) => (
                    <Cell key={i} fill={e.valor >= 7 ? '#22c55e' : e.valor >= 4 ? '#f59e0b' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── STRENGTHS & WEAKNESSES ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TagList items={data.strengths || []} icon={Star} color="#22c55e" title="Pontos Fortes" />
        <TagList items={data.weaknesses || []} icon={AlertTriangle} color="#ef4444" title="Pontos Fracos" />
      </div>

      {/* ── VIRTUES & SKILLS ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TagList items={data.virtues || []} icon={Award} color="#8b5cf6" title="Forças & Virtudes" />
        <TagList items={data.skills || []} icon={Lightbulb} color="#3b82f6" title="Habilidades" />
      </div>

      {/* ── BLOCKS: TECHNICAL & EMOTIONAL ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <TagList items={data.technical_blocks || []} icon={Lock} color="#f59e0b" title="Travas Técnicas" />
        <TagList items={data.emotional_blocks || []} icon={Heart} color="#ef4444" title="Travas Emocionais" />
      </div>

      {/* ── VICES & DISCIPLINE ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-orange-500" />
            <h3 className="text-sm font-semibold text-foreground">Vícios Emocionais</h3>
          </div>
          <p className="text-[10px] text-muted-foreground mb-3">Principal: <strong className="text-foreground">{data.principal_vice}</strong></p>
          <ResponsiveContainer width="100%" height={Math.max(180, emotionalData.length * 36)}>
            <BarChart data={emotionalData} layout="vertical" margin={{ left: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {emotionalData.map((e, i) => (
                  <Cell key={i} fill={e.valor >= 7 ? '#ef4444' : e.valor >= 4 ? '#f59e0b' : '#22c55e'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-semibold text-foreground">Disciplina & Sustentação</h3>
          </div>
          <ResponsiveContainer width="100%" height={Math.max(180, disciplineData.length * 40)}>
            <BarChart data={disciplineData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--foreground))', fontSize: 10 }} />
              <YAxis domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '11px' }} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {disciplineData.map((e, i) => (
                  <Cell key={i} fill={e.valor >= 7 ? '#22c55e' : e.valor >= 4 ? '#f59e0b' : '#ef4444'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── RISK MAP ── */}
      <div className="bg-card border border-border rounded-xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <Eye className="w-4 h-4 text-red-500" />
          <h3 className="text-sm font-semibold text-foreground">Mapa de Risco por Etapa da Venda</h3>
        </div>
        <div className="space-y-3">
          {data.sales_risk_stages.map((stage, i) => {
            const isCritical = stage.stage === data.critical_stage;
            return (
              <motion.div key={stage.stage} className="flex items-center gap-3" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <div className="w-28 text-xs text-foreground font-medium truncate">{stage.stage}</div>
                <div className="flex-1 h-7 bg-muted rounded-lg overflow-hidden relative">
                  <motion.div
                    className="h-full rounded-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(stage.risk, 5)}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05 }}
                    style={{ backgroundColor: stage.risk >= 70 ? '#ef4444' : stage.risk >= 40 ? '#f59e0b' : '#22c55e' }}
                  />
                  {isCritical && (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white drop-shadow">⚠ CRÍTICO</span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground w-10 text-right font-medium">{stage.risk}%</span>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ── ATTENTION POINTS ── */}
      <TagList items={data.attention_points || []} icon={AlertTriangle} color="#f59e0b" title="Pontos de Atenção (Gestor)" />

      {/* ── ACTION PLAN ── */}
      {data.action_plan && data.action_plan.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <h3 className="text-sm font-semibold text-foreground">Como Potencializar</h3>
          </div>
          <div className="space-y-3">
            {data.action_plan.map((action, i) => (
              <motion.div
                key={i} className="flex items-start gap-3 p-3 bg-muted/30 rounded-lg border border-border"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              >
                <div className="w-6 h-6 bg-emerald-500/10 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-xs font-bold text-emerald-500">{i + 1}</span>
                </div>
                <p className="text-sm text-foreground leading-relaxed">{action}</p>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
