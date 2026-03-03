import { startOfMonth, endOfMonth, endOfWeek, eachWeekOfInterval, format, isBefore, isAfter, getDay } from "date-fns";

export interface CalendarWeek {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "01/01 — 04/01"
}

/**
 * Check if a date range contains at least one weekday (Mon-Fri)
 */
function hasWeekday(start: Date, end: Date): boolean {
  const d = new Date(start);
  while (d <= end) {
    const dow = getDay(d);
    if (dow >= 1 && dow <= 5) return true;
    d.setDate(d.getDate() + 1);
  }
  return false;
}

/**
 * Get real calendar weeks (Seg–Dom) for a given month/year.
 * Partial weeks with only weekend days are merged with the adjacent week.
 */
export function getWeeksOfMonth(year: number, month: number): CalendarWeek[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 }
  );

  // Build raw weeks clipped to month
  const raw: { start: Date; end: Date }[] = weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    return {
      start: isBefore(weekStart, monthStart) ? monthStart : weekStart,
      end: isAfter(weekEnd, monthEnd) ? monthEnd : weekEnd,
    };
  });

  // Merge partial weeks (no weekdays) with adjacent week
  const merged: { start: Date; end: Date }[] = [];
  for (let i = 0; i < raw.length; i++) {
    const w = raw[i];
    if (!hasWeekday(w.start, w.end)) {
      // Merge with next or previous
      if (i === 0 && raw.length > 1) {
        raw[1].start = w.start; // extend next week's start
      } else if (merged.length > 0) {
        merged[merged.length - 1].end = w.end; // extend previous week's end
      }
    } else {
      merged.push({ ...w });
    }
  }

  return merged.map((w, idx) => ({
    weekNumber: idx + 1,
    startDate: format(w.start, "yyyy-MM-dd"),
    endDate: format(w.end, "yyyy-MM-dd"),
    label: `${format(w.start, "dd/MM")} — ${format(w.end, "dd/MM")}`,
  }));
}

/**
 * Get the next month/year after the latest existing month.
 */
export function getNextMonth(existingMonths: { year: number; month: number }[]): { year: number; month: number } {
  if (!existingMonths || existingMonths.length === 0) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  const sorted = [...existingMonths].sort((a, b) => a.year !== b.year ? b.year - a.year : b.month - a.month);
  const latest = sorted[0];
  if (latest.month === 12) {
    return { year: latest.year + 1, month: 1 };
  }
  return { year: latest.year, month: latest.month + 1 };
}

/**
 * Get calendar grid data for mini-calendar display
 */
export function getCalendarGrid(year: number, month: number) {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));
  const totalDays = monthEnd.getDate();
  
  // Day of week for first day (0=Sun, 1=Mon, ..., 6=Sat)
  const firstDow = getDay(monthStart);
  
  const days: { day: number; isCurrentMonth: boolean; date: string }[] = [];
  
  // Fill leading days from previous month
  const prevMonthEnd = new Date(year, month - 1, 0);
  const leadingDays = firstDow === 0 ? 6 : firstDow - 1; // Monday-based
  for (let i = leadingDays - 1; i >= 0; i--) {
    const d = prevMonthEnd.getDate() - i;
    const dt = new Date(year, month - 2, d);
    days.push({ day: d, isCurrentMonth: false, date: format(dt, "yyyy-MM-dd") });
  }
  
  // Current month days
  for (let d = 1; d <= totalDays; d++) {
    const dt = new Date(year, month - 1, d);
    days.push({ day: d, isCurrentMonth: true, date: format(dt, "yyyy-MM-dd") });
  }
  
  // Fill trailing days
  const remaining = 7 - (days.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month, d);
      days.push({ day: d, isCurrentMonth: false, date: format(dt, "yyyy-MM-dd") });
    }
  }
  
  // Split into rows of 7
  const rows: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    rows.push(days.slice(i, i + 7));
  }
  
  return rows;
}
