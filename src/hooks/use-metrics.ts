import { useQuery } from "@tanstack/react-query";
import { fetchMonths, fetchTeamMembers, fetchMonthlyGoals, fetchWeeklyGoals, fetchDailyMetrics, fetchAiReports } from "@/lib/db";

export function useMonths() {
  return useQuery({ queryKey: ["months"], queryFn: fetchMonths });
}

export function useTeamMembers() {
  return useQuery({ queryKey: ["team-members"], queryFn: fetchTeamMembers });
}

export function useMonthlyGoals(monthId: string | undefined, memberId?: string | null) {
  return useQuery({
    queryKey: ["monthly-goals", monthId, memberId ?? "team"],
    queryFn: () => fetchMonthlyGoals(monthId!, memberId),
    enabled: !!monthId,
  });
}

export function useWeeklyGoals(monthId: string | undefined, memberId?: string | null) {
  return useQuery({
    queryKey: ["weekly-goals", monthId, memberId ?? "team"],
    queryFn: () => fetchWeeklyGoals(monthId!, memberId),
    enabled: !!monthId,
  });
}

export function useDailyMetrics(monthId: string | undefined) {
  return useQuery({
    queryKey: ["daily-metrics", monthId],
    queryFn: () => fetchDailyMetrics(monthId!),
    enabled: !!monthId,
  });
}

export function useAiReports(monthId: string | undefined) {
  return useQuery({
    queryKey: ["ai-reports", monthId],
    queryFn: () => fetchAiReports(monthId!),
    enabled: !!monthId,
  });
}
