import { startOfMonth, endOfMonth, endOfWeek, eachWeekOfInterval, format, isBefore, isAfter } from "date-fns";

export interface CalendarWeek {
  weekNumber: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  label: string;     // e.g. "01/01 — 04/01"
}

/**
 * Get real calendar weeks (Mon–Dom) for a given month/year.
 * Weeks are clipped to the month boundaries.
 */
export function getWeeksOfMonth(year: number, month: number): CalendarWeek[] {
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  // Get all week starts (Monday) that overlap with this month
  const weekStarts = eachWeekOfInterval(
    { start: monthStart, end: monthEnd },
    { weekStartsOn: 1 } // Monday
  );

  return weekStarts.map((weekStart, idx) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 }); // Sunday
    // Clip to month boundaries
    const clippedStart = isBefore(weekStart, monthStart) ? monthStart : weekStart;
    const clippedEnd = isAfter(weekEnd, monthEnd) ? monthEnd : weekEnd;

    return {
      weekNumber: idx + 1,
      startDate: format(clippedStart, "yyyy-MM-dd"),
      endDate: format(clippedEnd, "yyyy-MM-dd"),
      label: `${format(clippedStart, "dd/MM")} — ${format(clippedEnd, "dd/MM")}`,
    };
  });
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
