import { DbDailyMetric, DbTeamMember, METRIC_KEYS, METRIC_LABELS } from "@/lib/db";
import { Download } from "lucide-react";

interface ExportCsvButtonProps {
  dailyMetrics: DbDailyMetric[];
  members: DbTeamMember[];
  monthLabel?: string;
}

export function ExportCsvButton({ dailyMetrics, members, monthLabel }: ExportCsvButtonProps) {
  const memberMap = new Map(members.map(m => [m.id, m.name]));

  const handleExport = () => {
    const headers = ["Data", "Dia", "SDR", ...METRIC_KEYS.map(k => METRIC_LABELS[k])];
    const rows = dailyMetrics.map(d => [
      d.date,
      d.day_of_week,
      memberMap.get(d.member_id) || "—",
      ...METRIC_KEYS.map(k => String((d as any)[k] || 0)),
    ]);

    const csvContent = [headers.join(";"), ...rows.map(r => r.join(";"))].join("\n");
    const BOM = "\uFEFF";
    const blob = new Blob([BOM + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `metricas_${monthLabel?.replace(/\s/g, "_") || "export"}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      onClick={handleExport}
      disabled={dailyMetrics.length === 0}
      className="px-3 py-1.5 text-[10px] rounded-lg font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors disabled:opacity-30 flex items-center gap-1.5"
    >
      <Download size={12} />
      Exportar CSV
    </button>
  );
}
