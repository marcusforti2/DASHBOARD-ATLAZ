import { supabase } from "@/integrations/supabase/client";

export interface DbMonth {
  id: string;
  year: number;
  month: number;
  label: string;
}

export interface DbTeamMember {
  id: string;
  name: string;
  active: boolean;
  avatar_url?: string | null;
  member_role?: string;
}

/** Check if a member has a specific role (supports comma-separated roles like "sdr,closer") */
export function memberHasRole(member: { member_role?: string } | undefined | null, role: string): boolean {
  if (!member?.member_role) return role === "sdr";
  return member.member_role.split(",").map(r => r.trim()).includes(role);
}

/** Get all roles for a member */
export function getMemberRoles(member: { member_role?: string } | undefined | null): string[] {
  if (!member?.member_role) return ["sdr"];
  return member.member_role.split(",").map(r => r.trim()).filter(Boolean);
}

/** Check if member has dual role */
export function isDualRole(member: { member_role?: string } | undefined | null): boolean {
  return getMemberRoles(member).length > 1;
}

/** Get the metric keys for a member based on their roles */
export function getMemberMetricKeys(member: { member_role?: string } | undefined | null): readonly string[] {
  const roles = getMemberRoles(member);
  if (roles.includes("sdr") && roles.includes("closer")) return METRIC_KEYS;
  if (roles.includes("closer")) return CLOSER_METRIC_KEYS;
  return SDR_METRIC_KEYS;
}

export function getMemberAvatar(member: { avatar_url?: string | null }, _index: number): string {
  return member.avatar_url || "/placeholder.svg";
}

export interface DbMonthlyGoal {
  id: string;
  month_id: string;
  member_id: string | null;
  conexoes: number;
  conexoes_aceitas: number;
  abordagens: number;
  inmail: number;
  follow_up: number;
  numero: number;
  lig_agendada: number;
  lig_realizada: number;
  reuniao_agendada: number;
  reuniao_realizada: number;
}

export interface DbDailyMetric {
  id: string;
  date: string;
  day_of_week: string;
  member_id: string;
  member_name?: string;
  conexoes: number;
  conexoes_aceitas: number;
  abordagens: number;
  inmail: number;
  follow_up: number;
  numero: number;
  lig_agendada: number;
  lig_realizada: number;
  reuniao_agendada: number;
  reuniao_realizada: number;
}

export const ALL_WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"] as const;
export const DEFAULT_WORKING_DAYS = "Dom,Seg,Ter,Qua,Qui,Sex,Sáb";

export function getWorkingDaysCount(workingDays?: string | null): number {
  if (!workingDays) return 5;
  return workingDays.split(",").filter(d => d.trim()).length;
}

export interface DbWeeklyGoal {
  id: string;
  month_id: string;
  week_number: number;
  member_id: string | null;
  start_date: string | null;
  end_date: string | null;
  working_days: string;
  conexoes: number;
  conexoes_aceitas: number;
  abordagens: number;
  inmail: number;
  follow_up: number;
  numero: number;
  lig_agendada: number;
  lig_realizada: number;
  reuniao_agendada: number;
  reuniao_realizada: number;
}

export const METRIC_KEYS = [
  "conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up",
  "numero", "lig_agendada", "lig_realizada", "reuniao_agendada", "reuniao_realizada"
] as const;

export const SDR_METRIC_KEYS = ["conexoes", "conexoes_aceitas", "abordagens", "inmail", "follow_up", "numero", "lig_agendada"] as const;
export const CLOSER_METRIC_KEYS = ["lig_realizada", "reuniao_agendada", "reuniao_realizada"] as const;

export const METRIC_LABELS: Record<string, string> = {
  conexoes: "Conexões",
  conexoes_aceitas: "Conexões Aceitas",
  abordagens: "Abordagens",
  inmail: "InMail",
  follow_up: "Follow Up",
  numero: "Número",
  lig_agendada: "Lig. Agendada",
  lig_realizada: "Lig. Realizada",
  reuniao_agendada: "Reunião Agend.",
  reuniao_realizada: "Reunião Realiz.",
};

/** Short labels for compact table headers — avoids truncation issues */
export const SHORT_TABLE_LABELS: Record<string, string> = {
  conexoes: "Conexões",
  conexoes_aceitas: "Aceitas",
  abordagens: "Abordag.",
  inmail: "InMail",
  follow_up: "Follow Up",
  numero: "Número",
  lig_agendada: "Lig. Ag.",
  lig_realizada: "Lig. Re.",
  reuniao_agendada: "Reun. Ag.",
  reuniao_realizada: "Reun. Re.",
};

export async function fetchMonths(): Promise<DbMonth[]> {
  const { data, error } = await supabase
    .from("months")
    .select("*")
    .order("year", { ascending: false })
    .order("month", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function fetchTeamMembers(): Promise<DbTeamMember[]> {
  const { data, error } = await supabase
    .from("team_members")
    .select("*")
    .eq("active", true)
    .order("name");
  if (error) throw error;
  return data || [];
}

/** Fetch monthly goal — team (member_id is null) or specific member */
export async function fetchMonthlyGoals(monthId: string, memberId?: string | null): Promise<DbMonthlyGoal | null> {
  let query = supabase
    .from("monthly_goals")
    .select("*")
    .eq("month_id", monthId);

  if (memberId) {
    query = query.eq("member_id", memberId);
  } else {
    query = query.is("member_id", null);
  }

  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data || null;
}

/** Fetch weekly goals — team (member_id is null) or specific member */
export async function fetchWeeklyGoals(monthId: string, memberId?: string | null): Promise<DbWeeklyGoal[]> {
  let query = supabase
    .from("weekly_goals")
    .select("*")
    .eq("month_id", monthId);

  if (memberId) {
    query = query.eq("member_id", memberId);
  } else {
    query = query.is("member_id", null);
  }

  const { data, error } = await query.order("week_number");
  if (error) throw error;
  return data || [];
}

export async function fetchDailyMetrics(monthId: string): Promise<DbDailyMetric[]> {
  const { data, error } = await supabase
    .from("daily_metrics")
    .select("*")
    .eq("month_id", monthId)
    .order("date")
    .order("member_id");
  if (error) throw error;
  return data || [];
}

export async function fetchAiReports(monthId: string) {
  const { data, error } = await supabase
    .from("ai_reports")
    .select("*")
    .eq("month_id", monthId)
    .order("generated_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveAiReport(monthId: string, content: string, reportType = "monthly") {
  const { error } = await supabase
    .from("ai_reports")
    .insert({ month_id: monthId, content, report_type: reportType });
  if (error) throw error;
}

/** Extract only metric number fields from a goal object */
export function goalToMetrics(goal: DbMonthlyGoal | null): Record<string, number> | null {
  if (!goal) return null;
  return METRIC_KEYS.reduce((acc, k) => {
    acc[k] = (goal as any)[k] || 0;
    return acc;
  }, {} as Record<string, number>);
}

export function sumMetrics(metrics: DbDailyMetric[], filterMemberId?: string) {
  const filtered = filterMemberId ? metrics.filter(m => m.member_id === filterMemberId) : metrics;
  return METRIC_KEYS.reduce((acc, key) => {
    acc[key] = filtered.reduce((sum, m) => sum + ((m as any)[key] || 0), 0);
    return acc;
  }, {} as Record<string, number>);
}
