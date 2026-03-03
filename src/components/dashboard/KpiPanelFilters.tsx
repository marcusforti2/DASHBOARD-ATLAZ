import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays, ChevronDown } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface WeekInfo {
  weekNumber: number;
  label: string;
  startDate: string;
  endDate: string;
}

interface KpiPanelFiltersProps {
  periodFilter: "month" | "week" | "day";
  onPeriodChange: (p: "month" | "week" | "day") => void;
  selectedDate: Date;
  onDateChange: (d: Date) => void;
  selectedWeekIdx: number;
  onWeekChange: (i: number) => void;
  weeksOfMonth: WeekInfo[];
  showPeriodToggle?: boolean;
}

export function KpiPanelFilters({
  periodFilter,
  onPeriodChange,
  selectedDate,
  onDateChange,
  selectedWeekIdx,
  onWeekChange,
  weeksOfMonth,
  showPeriodToggle = true,
}: KpiPanelFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {showPeriodToggle && (
        <div className="flex items-center gap-1">
          {(["month", "week", "day"] as const).map(p => (
            <button
              key={p}
              onClick={() => onPeriodChange(p)}
              className={cn(
                "px-2.5 py-1 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-colors",
                periodFilter === p ? "bg-accent text-accent-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {p === "month" ? "Mês" : p === "week" ? "Semana" : "Dia"}
            </button>
          ))}
        </div>
      )}

      {periodFilter === "week" && weeksOfMonth.length > 0 && (
        <div className="relative">
          <select
            value={selectedWeekIdx}
            onChange={e => onWeekChange(Number(e.target.value))}
            className="appearance-none bg-secondary text-secondary-foreground text-[10px] font-medium px-2.5 py-1 pr-6 rounded-md border border-border cursor-pointer outline-none"
          >
            {weeksOfMonth.map((w, i) => (
              <option key={i} value={i}>Sem {w.weekNumber} — {w.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      )}

      {periodFilter === "day" && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onDateChange(new Date())}
            className={cn(
              "px-2.5 py-1 text-[10px] rounded-md font-semibold uppercase tracking-wider transition-colors flex items-center gap-1",
              format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            <CalendarDays size={10} /> Hoje
          </button>
          <Popover>
            <PopoverTrigger asChild>
              <button className="px-2.5 py-1 text-[10px] rounded-md font-semibold tracking-wider transition-colors bg-secondary text-secondary-foreground hover:bg-secondary/80 flex items-center gap-1">
                <CalendarDays size={10} />
                {format(selectedDate, "dd/MM/yyyy", { locale: ptBR })}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && onDateChange(d)}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>
      )}
    </div>
  );
}
