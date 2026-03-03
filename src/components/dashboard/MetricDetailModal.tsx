import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { METRIC_LABELS, DbDailyMetric, DbTeamMember, sumMetrics, getMemberAvatar } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Link, UserCheck, MessageSquare, Mail, Target, Phone, PhoneCall, Calendar, CalendarCheck } from "lucide-react";

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
  "hsl(45, 93%, 47%)",
  "hsl(210, 10%, 70%)",
  "hsl(24, 60%, 45%)",
];

const RANK_EMOJI = ["🥇", "🥈", "🥉"];

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

  const memberData = members
    .map((m, idx) => {
      const totals = sumMetrics(metrics, m.id);
      return { id: m.id, name: m.name, value: totals[metricKey] || 0, avatar: getMemberAvatar(m, idx) };
    })
    .sort((a, b) => b.value - a.value);

  const totalValue = memberData.reduce((s, m) => s + m.value, 0);
  const maxValue = memberData[0]?.value || 1;
  const totalPct = totalGoal > 0 ? Math.round((totalValue / totalGoal) * 100) : 0;
  const goalPerMember = totalGoal > 0 && members.length > 0 ? totalGoal / members.length : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border p-0 overflow-hidden gap-0">
        {/* Compact header */}
        <div className="px-5 pt-5 pb-4 border-b border-border/50">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-sm font-bold text-card-foreground">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                {ICONS[metricKey]}
              </div>
              <div className="min-w-0">
                <span className="block truncate">{label}</span>
                {periodLabel && (
                  <span className="text-[10px] font-medium text-muted-foreground">{periodLabel}</span>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>

          {/* Total inline */}
          <div className="mt-3 flex items-center gap-2.5">
            <span className="text-2xl font-black tabular-nums text-card-foreground leading-none">
              {totalValue.toLocaleString("pt-BR")}
            </span>
            {totalGoal > 0 && (
              <>
                <span className="text-xs text-muted-foreground">/ {totalGoal.toLocaleString("pt-BR")}</span>
                <span className={cn(
                  "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                  totalPct >= 100 ? "bg-accent/15 text-accent" :
                  totalPct >= 70 ? "bg-primary/15 text-primary" :
                  "bg-destructive/15 text-destructive"
                )}>
                  {totalPct}%
                </span>
              </>
            )}
          </div>
          {totalGoal > 0 && (
            <div className="w-full h-1 rounded-full bg-secondary overflow-hidden mt-2.5">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  totalPct >= 100 ? "bg-accent" : totalPct >= 70 ? "bg-primary" : "bg-destructive"
                )}
                style={{ width: `${Math.min(totalPct, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Ranking list — single unified view */}
        <div className="px-4 py-3 space-y-1 max-h-[360px] overflow-y-auto">
          {memberData.map((member, idx) => {
            const pctOfMax = maxValue > 0 ? (member.value / maxValue) * 100 : 0;
            const pctOfGoal = goalPerMember > 0 ? Math.round((member.value / goalPerMember) * 100) : 0;
            const isTop3 = idx < 3;
            const barColor = isTop3 ? RANK_COLORS[idx] : "hsl(217, 91%, 60%)";

            return (
              <div
                key={member.id}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-200",
                  idx === 0
                    ? "bg-[hsl(45,93%,47%)]/[0.06] ring-1 ring-[hsl(45,93%,47%)]/15"
                    : "hover:bg-secondary/40"
                )}
              >
                {/* Rank */}
                <span className="text-sm w-5 text-center shrink-0 leading-none">
                  {isTop3 ? RANK_EMOJI[idx] : (
                    <span className="text-[10px] font-bold text-muted-foreground">{idx + 1}º</span>
                  )}
                </span>

                {/* Avatar */}
                <img
                  src={member.avatar}
                  alt={member.name}
                  className={cn(
                    "w-7 h-7 rounded-full object-cover shrink-0 ring-1",
                    idx === 0 ? "ring-[hsl(45,93%,47%)]/40" :
                    idx === 1 ? "ring-[hsl(210,10%,70%)]/30" :
                    idx === 2 ? "ring-[hsl(24,60%,45%)]/30" :
                    "ring-border"
                  )}
                />

                {/* Name + bar */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-semibold text-card-foreground truncate">{member.name}</span>
                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className={cn(
                        "text-sm tabular-nums text-card-foreground",
                        idx === 0 ? "font-black" : "font-bold"
                      )}>
                        {member.value.toLocaleString("pt-BR")}
                      </span>
                      {pctOfGoal > 0 && (
                        <span className={cn(
                          "text-[9px] font-bold px-1 py-px rounded tabular-nums",
                          pctOfGoal >= 100 ? "bg-accent/15 text-accent" :
                          pctOfGoal >= 70 ? "bg-primary/15 text-primary" :
                          "bg-muted/60 text-muted-foreground"
                        )}>
                          {pctOfGoal}%
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="w-full h-1 rounded-full bg-secondary/60 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pctOfMax}%`,
                        background: barColor,
                        opacity: isTop3 ? 1 : 0.5,
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
