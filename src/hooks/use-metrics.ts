import { useQuery } from "@tanstack/react-query";
import { fetchMonths, fetchTeamMembers, fetchMonthlyGoals, fetchWeeklyGoals, fetchDailyMetrics, fetchAiReports } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";

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

/** Fetch ALL monthly goals for a month (all members + team) */
export function useAllMonthlyGoals(monthId: string | undefined) {
  return useQuery({
    queryKey: ["all-monthly-goals", monthId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_goals")
        .select("*")
        .eq("month_id", monthId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!monthId,
  });
}

/** Fetch ALL weekly goals for a month (all members + team) */
export function useAllWeeklyGoals(monthId: string | undefined) {
  return useQuery({
    queryKey: ["all-weekly-goals", monthId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("weekly_goals")
        .select("*")
        .eq("month_id", monthId!)
        .order("week_number");
      if (error) throw error;
      return data || [];
    },
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
