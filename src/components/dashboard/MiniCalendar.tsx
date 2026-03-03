import { getCalendarGrid, CalendarWeek } from "@/lib/calendar-utils";
import { parseISO, isWithinInterval } from "date-fns";

interface MiniCalendarProps {
  year: number;
  month: number;
  weeks: CalendarWeek[];
}

const WEEK_COLORS = [
  "bg-blue-500/20 text-blue-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-purple-500/20 text-purple-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];

const DOT_COLORS = [
  "bg-blue-400",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-purple-400",
  "bg-rose-400",
  "bg-cyan-400",
];

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function MiniCalendar({ year, month, weeks }: MiniCalendarProps) {
  const rows = getCalendarGrid(year, month);

  const getWeekForDate = (dateStr: string): number | null => {
    for (const w of weeks) {
      try {
        const start = parseISO(w.startDate);
        const end = parseISO(w.endDate);
        const d = parseISO(dateStr);
        if (isWithinInterval(d, { start, end })) return w.weekNumber;
      } catch { continue; }
    }
    return null;
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h4 className="text-xs font-bold text-card-foreground text-center mb-3">
        {MONTH_NAMES[month - 1]} {year}
      </h4>

      {/* Header */}
      <div className="grid grid-cols-7 gap-0 mb-1">
        {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
          <div key={i} className="text-center text-[9px] font-semibold text-muted-foreground py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="space-y-0.5">
        {rows.map((row, ri) => (
          <div key={ri} className="grid grid-cols-7 gap-0">
            {row.map((cell, ci) => {
              const weekNum = cell.isCurrentMonth ? getWeekForDate(cell.date) : null;
              const colorIdx = weekNum ? (weekNum - 1) % WEEK_COLORS.length : 0;
              
              return (
                <div
                  key={ci}
                  className={`relative text-center py-1.5 text-[11px] rounded transition-colors ${
                    !cell.isCurrentMonth
                      ? "text-muted-foreground/30"
                      : weekNum
                        ? WEEK_COLORS[colorIdx]
                        : "text-card-foreground"
                  }`}
                >
                  {cell.day}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border">
        {weeks.map((w, i) => (
          <div key={w.weekNumber} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
            <span className="text-[8px] text-muted-foreground">
              S{w.weekNumber}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
