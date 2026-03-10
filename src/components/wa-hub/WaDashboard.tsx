import { useState, useEffect } from 'react';
import { useWaDashboardStats, useWaInstances } from '@/hooks/use-wa-hub';
import { supabase } from '@/integrations/supabase/client';
import { MessageSquare, Clock, CheckCircle, Wifi, Loader2, TrendingUp, Users, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

interface DailyVolume {
  date: string;
  label: string;
  received: number;
  sent: number;
}

interface InstanceVolume {
  name: string;
  count: number;
}

export function WaDashboard() {
  const { stats, loading } = useWaDashboardStats();
  const { instances } = useWaInstances();
  const [dailyVolume, setDailyVolume] = useState<DailyVolume[]>([]);
  const [instanceVolume, setInstanceVolume] = useState<InstanceVolume[]>([]);
  const [loadingCharts, setLoadingCharts] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      setLoadingCharts(true);

      // Last 7 days message volume — batch all 14 queries in parallel
      const dayConfigs: { dateStr: string; label: string }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayConfigs.push({
          dateStr: d.toISOString().split('T')[0],
          label: d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit' }),
        });
      }

      const dayQueries = dayConfigs.flatMap(({ dateStr }) => [
        supabase.from('wa_messages').select('id', { count: 'exact', head: true })
          .eq('sender', 'contact').gte('created_at', `${dateStr}T00:00:00`).lt('created_at', `${dateStr}T23:59:59`),
        supabase.from('wa_messages').select('id', { count: 'exact', head: true })
          .eq('sender', 'agent').gte('created_at', `${dateStr}T00:00:00`).lt('created_at', `${dateStr}T23:59:59`),
      ]);

      const dayResults = await Promise.all(dayQueries);
      const days: DailyVolume[] = dayConfigs.map(({ dateStr, label }, i) => ({
        date: dateStr,
        label,
        received: dayResults[i * 2].count || 0,
        sent: dayResults[i * 2 + 1].count || 0,
      }));
      setDailyVolume(days);

      // Messages per instance
      const instVol: InstanceVolume[] = [];
      for (const inst of instances) {
        const { count } = await supabase.from('wa_messages').select('id', { count: 'exact', head: true })
          .eq('instance_id', inst.id);
        instVol.push({ name: inst.instance_name.replace(/^wpp_/i, ''), count: count || 0 });
      }
      setInstanceVolume(instVol);

      setLoadingCharts(false);
    };

    if (instances.length > 0) fetchChartData();
  }, [instances]);

  const statCards = [
    { label: 'Conversas ativas', value: stats.active, icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Aguardando', value: stats.waiting, icon: Clock, color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { label: 'Finalizadas', value: stats.closed, icon: CheckCircle, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
    { label: 'Instâncias online', value: stats.instances, icon: Wifi, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Msgs hoje', value: stats.todayMessages, icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  const COLORS = ['hsl(210, 90%, 50%)', 'hsl(152, 60%, 36%)', 'hsl(30, 90%, 50%)', 'hsl(280, 65%, 50%)', 'hsl(0, 72%, 51%)'];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
            {statCards.map(stat => (
              <div key={stat.label} className="p-4 rounded-xl bg-card border border-border">
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-lg ${stat.bg} flex items-center justify-center`}>
                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                  </div>
                </div>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Message volume chart */}
            <div className="rounded-xl bg-card border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">📊 Volume de Mensagens (7 dias)</h3>
              {loadingCharts ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dailyVolume}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        fontSize: '12px',
                      }}
                    />
                    <Bar dataKey="received" name="Recebidas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="sent" name="Enviadas" fill="hsl(152, 60%, 36%)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Messages per instance */}
            <div className="rounded-xl bg-card border border-border p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">📱 Mensagens por Instância</h3>
              {loadingCharts ? (
                <div className="flex items-center justify-center h-48"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
              ) : instanceVolume.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-12">Sem dados</p>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="50%" height={200}>
                    <PieChart>
                      <Pie
                        data={instanceVolume}
                        dataKey="count"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                      >
                        {instanceVolume.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-2">
                    {instanceVolume.map((inst, i) => (
                      <div key={inst.name} className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="text-xs text-foreground font-medium flex-1">{inst.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{inst.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instance list */}
          <div className="rounded-xl bg-card border border-border p-5">
            <h2 className="text-sm font-semibold text-foreground mb-4">Instâncias WhatsApp</h2>
            {instances.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma instância configurada</p>
            ) : (
              <div className="space-y-3">
                {instances.map(inst => (
                  <div key={inst.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50 border border-border">
                    <div className="flex items-center gap-3">
                      <Wifi className={`w-4 h-4 ${inst.is_connected ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium text-foreground">{inst.instance_name}</span>
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      inst.is_connected ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {inst.is_connected ? 'Online' : 'Offline'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
