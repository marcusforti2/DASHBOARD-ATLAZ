import { useWaDashboardStats, useWaInstances } from '@/hooks/use-wa-hub';
import { MessageSquare, Clock, CheckCircle, Wifi, Loader2 } from 'lucide-react';

export function WaDashboard() {
  const { stats, loading } = useWaDashboardStats();
  const { instances } = useWaInstances();

  const statCards = [
    { label: 'Conversas ativas', value: stats.active, icon: MessageSquare, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Aguardando', value: stats.waiting, icon: Clock, color: 'text-destructive', bg: 'bg-destructive/10' },
    { label: 'Finalizadas', value: stats.closed, icon: CheckCircle, color: 'text-primary', bg: 'bg-primary/10' },
    { label: 'Instâncias online', value: stats.instances, icon: Wifi, color: 'text-primary', bg: 'bg-primary/10' },
  ];

  return (
    <div className="space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 text-primary animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
