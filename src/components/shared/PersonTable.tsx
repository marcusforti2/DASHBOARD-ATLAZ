import { dailyData, METRIC_LABELS, PEOPLE } from "@/data/prospecting-data";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface PersonTableProps {
  selectedPerson: string | null;
}

const METRICS = ["conexoes", "conexoesAceitas", "abordagens", "inmail", "followUp", "numero", "ligAgendada", "ligRealizada", "reuniaoAgendada", "reuniaoRealizada"] as const;

export function PersonTable({ selectedPerson }: PersonTableProps) {
  const filtered = selectedPerson
    ? dailyData.filter(d => d.person === selectedPerson)
    : dailyData;

  // Group by date
  const dates = [...new Set(filtered.map(d => d.date))];

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent">
            <TableHead className="text-muted-foreground font-semibold text-xs">Data</TableHead>
            <TableHead className="text-muted-foreground font-semibold text-xs">Pessoa</TableHead>
            {METRICS.map(m => (
              <TableHead key={m} className="text-muted-foreground font-semibold text-xs text-right whitespace-nowrap">
                {METRIC_LABELS[m]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {dates.map(date => {
            const entries = filtered.filter(d => d.date === date);
            return entries.map((entry, idx) => (
              <TableRow key={`${date}-${entry.person}`} className="border-border">
                <TableCell className="text-xs font-mono text-card-foreground">
                  {idx === 0 ? `${entry.date} ${entry.dayOfWeek}` : ""}
                </TableCell>
                <TableCell className="text-xs font-medium text-card-foreground">{entry.person}</TableCell>
                {METRICS.map(m => {
                  const val = (entry as any)[m] as number;
                  return (
                    <TableCell key={m} className={`text-xs text-right tabular-nums ${val > 0 ? "text-card-foreground" : "text-muted-foreground/40"}`}>
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
