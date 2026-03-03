import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METRIC_LABELS, METRIC_KEYS, DbDailyMetric, DbTeamMember, sumMetrics } from "@/lib/db";
import { cn } from "@/lib/utils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Link, UserCheck, MessageSquare, Mail, Target, Phone, PhoneCall, Calendar, CalendarCheck, Trophy, TrendingUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const ICONS: Record<string, React.ReactNode> = {
  conexoes: <Link size={18} />,
  conexoes_aceitas: <UserCheck size={18} />,
  abordagens: <MessageSquare size={18} />,
  inmail: <Mail size={18} />,
  follow_up: <Target size={18} />,
  numero: <Phone size={18} />,
  lig_agendada: <PhoneCall size={18} />,
  lig_realizada: <PhoneCall size={18} />,
  reuniao_agendada: <Calendar size={18} />,
  reuniao_realizada: <CalendarCheck size={18} />,
};

const RANK_COLORS = [
  "hsl(45, 93%, 47%)",   // gold
  "hsl(210, 10%, 70%)",  // silver
  "hsl(24, 60%, 45%)",   // bronze
];

interface MetricDetailModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  metricKey: string | null;
  members: DbTeamMember[];
  metrics: DbDailyMetric[];
  goals: Record<string, number> | null;
  periodLabel?: string;
}

export function MetricDetailModal({ open, onOpenChange, metricKey, members, metrics, goals, periodLabel }: MetricDetailModalProps) {
  if (!metricKey) return null;

  const label = METRIC_LABELS[metricKey] || metricKey;
  const totalGoal = goals?.[metricKey] || 0;

  // Per-member data sorted by value desc
  const memberData = members
    .map(m => {
      const totals = sumMetrics(metrics, m.id);
      return { id: m.id, name: m.name, value: totals[metricKey] || 0 };
    })
    .sort((a, b) => b.value - a.value);

  const totalValue = memberData.reduce((s, m) => s + m.value, 0);
  const maxValue = memberData[0]?.value || 1;
  const totalPct = totalGoal > 0 ? Math.round((totalValue / totalGoal) * 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-primary/10 to-transparent p-6 pb-4 border-b border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-base font-black text-card-foreground">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center text-primary">
                {ICONS[metricKey]}
              </div>
              <div>
                <span>{label}</span>
                {periodLabel && (
                  <p className="text-[10px] font-medium text-muted-foreground mt-0.5">{periodLabel}</p>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Total summary */}
          <div className="mt-4 flex items-end gap-3">
            <span className="text-3xl font-black tabular-nums text-card-foreground">
              {totalValue.toLocaleString("pt-BR")}
            </span>
            {totalGoal > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-muted-foreground">/ {totalGoal.toLocaleString("pt-BR")}</span>
                <span className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded-full",
                  totalPct >= 100 ? "bg-accent/15 text-accent" :
                  totalPct >= 70 ? "bg-primary/15 text-primary" :
                  "bg-destructive/15 text-destructive"
                )}>
                  {totalPct}%
                </span>
              </div>
            )}
          </div>
          {totalGoal > 0 && (
            <Progress
              value={Math.min(totalPct, 100)}
              className={cn("h-1.5 mt-2", totalPct >= 100 ? "[&>div]:bg-accent" : totalPct >= 70 ? "" : "[&>div]:bg-destructive")}
            />
          )}
        </div>

        {/* Chart */}
        <div className="px-6 pt-4">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberData} layout="vertical" barSize={20} margin={{ left: 0, right: 10 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: "hsl(210, 40%, 96%)", fontSize: 12, fontWeight: 600 }}
                  axisLine={false}
                  tickLine={false}
                  width={65}
                />
                <Tooltip
                  contentStyle={{
                    background: "hsl(222, 47%, 9%)",
                    border: "1px solid hsl(222, 30%, 18%)",
                    borderRadius: "8px",
                    color: "hsl(210, 40%, 96%)",
                    fontSize: 12,
                  }}
                  formatter={(val: number) => [val.toLocaleString("pt-BR"), label]}
                />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {memberData.map((entry, idx) => (
                    <Cell
                      key={entry.id}
                      fill={idx < 3 ? RANK_COLORS[idx] : "hsl(217, 91%, 60%)"}
                      fillOpacity={idx < 3 ? 1 : 0.6}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Ranking list */}
        <div className="px-6 pb-6 pt-2 space-y-1.5 max-h-[300px] overflow-y-auto">
          {memberData.map((member, idx) => {
            const pctOfMax = maxValue > 0 ? Math.round((member.value / maxValue) * 100) : 0;
            const pctOfGoal = totalGoal > 0 && members.length > 0
              ? Math.round((member.value / (totalGoal / members.length)) * 100)
              : 0;

            return (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-3 rounded-xl p-3 transition-colors",
                  idx === 0 ? "bg-[hsl(45,93%,47%)]/8 border border-[hsl(45,93%,47%)]/20" :
                  "bg-secondary/30 border border-transparent hover:border-border"
                )}
              >
                {/* Rank badge */}
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shrink-0",
                  idx === 0 ? "bg-[hsl(45,93%,47%)]/20 text-[hsl(45,93%,47%)]" :
                  idx === 1 ? "bg-[hsl(210,10%,70%)]/20 text-[hsl(210,10%,70%)]" :
                  idx === 2 ? "bg-[hsl(24,60%,45%)]/20 text-[hsl(24,60%,45%)]" :
                  "bg-secondary text-muted-foreground"
                )}>
                  {idx < 3 ? ["🥇", "🥈", "🥉"][idx] : `${idx + 1}º`}
                </div>

                {/* Name & bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-card-foreground truncate">{member.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-black tabular-nums text-card-foreground">
                        {member.value.toLocaleString("pt-BR")}
                      </span>
                      {pctOfGoal > 0 && (
                        <span className={cn(
                          "text-[9px] font-bold px-1.5 py-0.5 rounded",
                          pctOfGoal >= 100 ? "bg-accent/15 text-accent" :
                          pctOfGoal >= 70 ? "bg-primary/15 text-primary" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {pctOfGoal}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pctOfMax}%`,
                        background: idx < 3 ? RANK_COLORS[idx] : "hsl(217, 91%, 60%)",
                        opacity: idx < 3 ? 1 : 0.6,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}