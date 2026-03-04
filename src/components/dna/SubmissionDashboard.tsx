import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell,
} from 'recharts';

interface DashboardData {
  disc: { D: number; I: number; S: number; C: number };
  disc_dominante: string;
  disc_secundario: string;
  emotional_vices: { name: string; score: number }[];
  principal_vice: string;
  discipline_scores: { name: string; score: number }[];
  maturity_level: number;
  sales_risk_stages: { stage: string; risk: number }[];
  critical_stage: string;
  recovery_time: string;
  selling_style: string;
}

const DISC_LABELS: Record<string, string> = {
  D: 'Dominância',
  I: 'Influência',
  S: 'Estabilidade',
  C: 'Conformidade',
};

const STAGE_COLORS: Record<string, string> = {
  'Diagnóstico': 'hsl(217, 91%, 60%)',
  'Construção de Valor': 'hsl(142, 71%, 45%)',
  'Silêncio': 'hsl(45, 93%, 47%)',
  'Negociação': 'hsl(25, 95%, 53%)',
  'Fechamento': 'hsl(0, 72%, 51%)',
};

export default function SubmissionDashboard({ data }: { data: DashboardData }) {
  const discData = [
    { trait: 'Dominância', value: data.disc.D, fullMark: 100 },
    { trait: 'Influência', value: data.disc.I, fullMark: 100 },
    { trait: 'Estabilidade', value: data.disc.S, fullMark: 100 },
    { trait: 'Conformidade', value: data.disc.C, fullMark: 100 },
  ];

  const emotionalData = data.emotional_vices.map(v => ({ name: v.name, valor: v.score }));
  const disciplineData = data.discipline_scores.map(d => ({ name: d.name, valor: d.score }));

  return (
    <div className="space-y-8">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard title="Perfil DISC Dominante" value={DISC_LABELS[data.disc_dominante] || data.disc_dominante} subtitle={`${data.disc[data.disc_dominante as keyof typeof data.disc]}% · Secundário: ${DISC_LABELS[data.disc_secundario] || data.disc_secundario}`} color="hsl(var(--primary))" />
        <SummaryCard title="Vício Emocional Principal" value={data.principal_vice} subtitle="Identificado pela IA" color="hsl(280, 67%, 55%)" />
        <SummaryCard title="Ponto de Travamento" value={data.critical_stage} subtitle="Etapa crítica na venda" color="hsl(0, 72%, 51%)" />
        <SummaryCard title="Recuperação Pós-Call" value={data.recovery_time} subtitle="Tempo para se recuperar" color="hsl(142, 71%, 45%)" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <SummaryCard title="Estilo de Venda" value={data.selling_style} subtitle="Estilo natural identificado" color="hsl(217, 91%, 60%)" />
        <SummaryCard title="Maturidade Comercial" value={`${data.maturity_level}/10`} subtitle={data.maturity_level >= 7 ? 'Nível alto' : data.maturity_level >= 4 ? 'Nível médio' : 'Precisa desenvolver'} color={data.maturity_level >= 7 ? 'hsl(142, 71%, 45%)' : data.maturity_level >= 4 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 72%, 51%)'} />
        <SummaryCard title="Perfil Secundário" value={DISC_LABELS[data.disc_secundario] || data.disc_secundario} subtitle={`${data.disc[data.disc_secundario as keyof typeof data.disc]}% das respostas`} color="hsl(var(--primary))" />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Perfil DISC</h3>
          <ResponsiveContainer width="100%" height={280}>
            <RadarChart data={discData}>
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis dataKey="trait" tick={{ fill: 'hsl(var(--foreground))', fontSize: 12 }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={{ fontSize: 10 }} />
              <Radar name="DISC" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Vícios Emocionais</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={emotionalData} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={160} tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="valor" radius={[0, 4, 4, 0]}>
                {emotionalData.map((entry, i) => (
                  <Cell key={i} fill={entry.valor >= 7 ? 'hsl(0, 72%, 51%)' : entry.valor >= 4 ? 'hsl(45, 93%, 47%)' : 'hsl(142, 71%, 45%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Maturidade & Disciplina</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={disciplineData} margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fill: 'hsl(var(--foreground))', fontSize: 11 }} />
              <YAxis domain={[0, 10]} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Bar dataKey="valor" radius={[4, 4, 0, 0]}>
                {disciplineData.map((entry, i) => (
                  <Cell key={i} fill={entry.valor >= 7 ? 'hsl(142, 71%, 45%)' : entry.valor >= 4 ? 'hsl(45, 93%, 47%)' : 'hsl(0, 72%, 51%)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">Mapa de Risco por Etapa</h3>
          <div className="space-y-3 mt-6">
            {data.sales_risk_stages.map(stage => {
              const isCritical = stage.stage === data.critical_stage;
              const color = STAGE_COLORS[stage.stage] || 'hsl(var(--primary))';
              return (
                <div key={stage.stage} className="flex items-center gap-3">
                  <div className="w-32 text-xs text-foreground font-medium truncate">{stage.stage}</div>
                  <div className="flex-1 h-8 bg-muted rounded-lg overflow-hidden relative">
                    <div className="h-full rounded-lg transition-all duration-500" style={{ width: `${Math.max(stage.risk, 5)}%`, backgroundColor: isCritical ? color : 'hsl(var(--muted-foreground) / 0.3)' }} />
                    {isCritical && (
                      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">⚠ PONTO CRÍTICO</span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground w-10 text-right">{stage.risk}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, value, subtitle, color }: { title: string; value: string; subtitle: string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <p className="text-xs text-muted-foreground mb-1">{title}</p>
      <p className="text-sm font-bold leading-tight" style={{ color }}>{value}</p>
      {subtitle && <p className="text-[10px] text-muted-foreground mt-1">{subtitle}</p>}
    </div>
  );
}
