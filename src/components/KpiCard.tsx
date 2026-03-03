import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  goal: number;
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, goal, icon }: KpiCardProps) {
  const pct = goal > 0 ? Math.round((value / goal) * 100) : 0;
  const isGood = pct >= 80;
  const isMid = pct >= 40 && pct < 80;

  return (
    <div className="rounded-xl border border-border bg-card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold tabular-nums text-card-foreground">{value.toLocaleString("pt-BR")}</span>
        <span className="text-xs text-muted-foreground mb-1">/ {goal.toLocaleString("pt-BR")}</span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            isGood ? "bg-accent" : isMid ? "bg-chart-4" : "bg-destructive"
          )}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(
        "text-xs font-semibold tabular-nums",
        isGood ? "text-accent" : isMid ? "text-chart-4" : "text-destructive"
      )}>
        {pct}%
      </span>
    </div>
  );
}
