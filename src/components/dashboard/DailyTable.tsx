import { DbDailyMetric, DbTeamMember, METRIC_KEYS, METRIC_LABELS } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DailyTableProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
  selectedMemberId: string | null;
}

export function DailyTable({ dailyMetrics, members, selectedMemberId }: DailyTableProps) {
  const filtered = selectedMemberId
    ? dailyMetrics.filter(d => d.member_id === selectedMemberId)
    : dailyMetrics;

  const memberMap = new Map(members.map(m => [m.id, m.name]));
  const dates = [...new Set(filtered.map(d => d.date))].sort();

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Data</TableHead>
            <TableHead className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider">Pessoa</TableHead>
            {METRIC_KEYS.map(k => (
              <TableHead key={k} className="text-muted-foreground font-semibold text-[10px] uppercase tracking-wider text-right whitespace-nowrap">
                {METRIC_LABELS[k]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dates.map(date => {
            const entries = filtered.filter(d => d.date === date);
            return entries.map((entry, idx) => (
              <TableRow key={entry.id} className="border-border hover:bg-secondary/30">
                <TableCell className="text-xs font-mono text-card-foreground whitespace-nowrap">
                  {idx === 0 ? `${format(new Date(entry.date), "dd/MM", { locale: ptBR })} ${entry.day_of_week}` : ""}
                </TableCell>
                <TableCell className="text-xs font-medium text-card-foreground">
                  {memberMap.get(entry.member_id) || "—"}
                </TableCell>
                {METRIC_KEYS.map(k => {
                  const val = (entry as any)[k] || 0;
                  return (
                    <TableCell key={k} className={`text-xs text-right tabular-nums ${val > 0 ? "text-card-foreground" : "text-muted-foreground/30"}`}>
                      {val}
                    </TableCell>
                  );
                })}
              </TableRow>
            ));
          })}
        </TableBody>
      </Table>
    </div>
  );
}
