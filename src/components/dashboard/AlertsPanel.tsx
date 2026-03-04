import { useMemo } from "react";
import { DbDailyMetric, DbTeamMember, METRIC_LABELS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, sumMetrics } from "@/lib/db";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { format, subDays } from "date-fns";

interface AlertsPanelProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
  goals: Record<string, number> | null;
  /** Individual member goals keyed by memberId */
  memberGoals?: Record<string, Record<string, number>>;
}

interface Alert {
  type: "danger" | "warning" | "success";
  icon: React.ReactNode;
  title: string;
  description: string;
}

export function AlertsPanel({ dailyMetrics, members, goals, memberGoals }: AlertsPanelProps) {
  const alerts = useMemo(() => {
    const result: Alert[] = [];
    const today = format(new Date(), "yyyy-MM-dd");
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");

    // Check which members haven't filled today or yesterday (weekday only)
    const todayDow = new Date().getDay();
    const checkDate = todayDow === 0 || todayDow === 6 ? null : todayDow === 1 ? format(subDays(new Date(), 2), "yyyy-MM-dd") : yesterday;

    if (checkDate) {
      members.forEach(m => {
        const hasEntry = dailyMetrics.some(d => d.member_id === m.id && d.date === checkDate);
        if (!hasEntry) {
          result.push({
            type: "danger",
            icon: <XCircle size={14} />,
            title: `${m.name} não preencheu dados`,
            description: `Sem registro para ${checkDate.split("-").reverse().slice(0, 2).join("/")}`,
          });
        }
      });
    }

    // Check metrics below 30% of INDIVIDUAL goals (not team total)
    members.forEach(m => {
      const totals = sumMetrics(dailyMetrics, m.id);
      const roleKeys = m.member_role === "closer" ? CLOSER_METRIC_KEYS : SDR_METRIC_KEYS;
      const mGoal = memberGoals?.[m.id];
      if (!mGoal) return;

      const criticalMetrics: string[] = [];
      roleKeys.forEach(k => {
        const goal = mGoal[k] || 0;
        const val = totals[k] || 0;
        if (goal > 0 && val / goal < 0.3) {
          criticalMetrics.push(METRIC_LABELS[k]);
        }
      });
      if (criticalMetrics.length > 0) {
        result.push({
          type: "warning",
          icon: <AlertTriangle size={14} />,
          title: `${m.name} — métricas críticas`,
          description: `Abaixo de 30%: ${criticalMetrics.slice(0, 3).join(", ")}${criticalMetrics.length > 3 ? ` +${criticalMetrics.length - 3}` : ""}`,
        });
      }
    });

    // Check top performer — separate by role
    if (dailyMetrics.length > 0) {
      const sdrMembers = members.filter(m => m.member_role === "sdr");
      const closerMembers = members.filter(m => m.member_role === "closer");

      const rankByRole = (list: DbTeamMember[], keys: readonly string[]) => {
        return list.map(m => ({
          name: m.name,
          total: keys.reduce((s, k) => s + (sumMetrics(dailyMetrics, m.id)[k] || 0), 0),
        })).sort((a, b) => b.total - a.total);
      };

      const sdrRanked = rankByRole(sdrMembers, SDR_METRIC_KEYS);
      const closerRanked = rankByRole(closerMembers, CLOSER_METRIC_KEYS);

      if (sdrRanked[0]?.total > 0) {
        result.push({
          type: "success",
          icon: <CheckCircle2 size={14} />,
          title: `${sdrRanked[0].name} lidera SDRs`,
          description: `${sdrRanked[0].total.toLocaleString("pt-BR")} ações totais`,
        });
      }
      if (closerRanked[0]?.total > 0) {
        result.push({
          type: "success",
          icon: <CheckCircle2 size={14} />,
          title: `${closerRanked[0].name} lidera Closers`,
          description: `${closerRanked[0].total.toLocaleString("pt-BR")} ações totais`,
        });
      }
    }

    return result;
  }, [dailyMetrics, members, goals, memberGoals]);

  if (alerts.length === 0) return null;

  const colorMap = {
    danger: "border-destructive/30 bg-destructive/5 text-destructive",
    warning: "border-[hsl(38,92%,50%)]/30 bg-[hsl(38,92%,50%)]/5 text-[hsl(38,92%,50%)]",
    success: "border-accent/30 bg-accent/5 text-accent",
  };

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider flex items-center gap-2">
        <AlertTriangle size={12} className="text-[hsl(38,92%,50%)]" />
        Alertas
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {alerts.map((alert, i) => (
          <div key={i} className={`flex items-start gap-2.5 rounded-lg border p-3 ${colorMap[alert.type]}`}>
            <span className="mt-0.5 shrink-0">{alert.icon}</span>
            <div className="min-w-0">
              <p className="text-xs font-semibold leading-tight">{alert.title}</p>
              <p className="text-[10px] opacity-80 mt-0.5">{alert.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
