import { DbDailyMetric, DbTeamMember, METRIC_KEYS, METRIC_LABELS } from "@/lib/db";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const SDR_KEYS = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada"];
const CLOSER_KEYS = ["lig_realizada", "reuniao_agendada", "reuniao_realizada"];
const SHARED_KEYS = ["indicacoes"];
const FIRST_CLOSER_KEY = CLOSER_KEYS[0];
const FIRST_SHARED_KEY = SHARED_KEYS[0];

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
            {METRIC_KEYS.map(k => {
              const isCloser = CLOSER_KEYS.includes(k);
              const isShared = SHARED_KEYS.includes(k);
              const isDivider = k === FIRST_CLOSER_KEY;
              const isSharedDivider = k === FIRST_SHARED_KEY;
              return (
                <TableHead
                  key={k}
                  className={cn(
                    "font-semibold text-[10px] uppercase tracking-wider text-right whitespace-nowrap",
                    isShared ? "text-[hsl(150,65%,60%)] bg-[hsl(150,30%,10%/0.5)]" :
                    isCloser ? "text-[hsl(280,65%,70%)] bg-[hsl(280,30%,10%/0.5)]" : "text-[hsl(217,70%,70%)] bg-[hsl(217,40%,10%/0.3)]",
                    isDivider && "border-l-2 border-l-[hsl(280,65%,40%)]",
                    isSharedDivider && "border-l-2 border-l-[hsl(150,65%,40%)]"
                  )}
                >
                  {METRIC_LABELS[k]}
                </TableHead>
              );
            })}
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
                  const isDivider = k === FIRST_CLOSER_KEY;
                  const isSharedDivider = k === FIRST_SHARED_KEY;
                  return (
                    <TableCell
                      key={k}
                      className={cn(
                        "text-xs text-right tabular-nums",
                        val > 0 ? "text-card-foreground" : "text-muted-foreground/30",
                        isDivider && "border-l-2 border-l-[hsl(280,65%,40%)]",
                        isSharedDivider && "border-l-2 border-l-[hsl(150,65%,40%)]"
                      )}
                    >
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
