import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMonths, useTeamMembers } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, DbMonth, DbWeeklyGoal, DbMonthlyGoal, DbTeamMember, ALL_WEEKDAYS, DEFAULT_WORKING_DAYS, getWorkingDaysCount, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS } from "@/lib/db";
import { getWeeksOfMonth, getNextMonth, CalendarWeek } from "@/lib/calendar-utils";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, Loader2, Calendar, ChevronDown,
  Save, Users, User, AlertTriangle, Copy, Pencil
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

type MetricValues = Record<string, number>;
type CloserGoals = { monthly: MetricValues; weeks: MetricValues[]; workingDays: string[] };
type AllGoals = Record<string, CloserGoals>;

function zeroMetrics(): MetricValues {
  return METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as MetricValues);
}

function getMetrics(obj: any): MetricValues {
  return METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: (obj as any)?.[k] || 0 }), {} as MetricValues);
}

function sumMetricsList(list: MetricValues[]): MetricValues {
  return METRIC_KEYS.reduce((acc, k) => {
    acc[k] = list.reduce((s, v) => s + (v[k] || 0), 0);
    return acc;
  }, {} as MetricValues);
}

function distributeToWeeks(monthly: MetricValues, weekCount: number): MetricValues[] {
  if (weekCount === 0) return [];
  return Array.from({ length: weekCount }, (_, i) =>
    METRIC_KEYS.reduce((acc, k) => {
      const total = monthly[k] || 0;
      const base = Math.floor(total / weekCount);
      const remainder = total % weekCount;
      acc[k] = base + (i < remainder ? 1 : 0);
      return acc;
    }, {} as MetricValues)
  );
}

function formatDateShort(dateStr: string): string {
  const [, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// Fetch ALL goals for a month (all members + team) in one query
async function fetchAllMonthGoals(monthId: string) {
  const [monthlyRes, weeklyRes] = await Promise.all([
    supabase.from("monthly_goals").select("*").eq("month_id", monthId),
    supabase.from("weekly_goals").select("*").eq("month_id", monthId).order("week_number"),
  ]);
  return {
    monthlyGoals: monthlyRes.data || [],
    weeklyGoals: weeklyRes.data || [],
  };
}

function useAllMonthGoals(monthId: string | undefined) {
  return useQuery({
    queryKey: ["all-month-goals", monthId],
    queryFn: () => fetchAllMonthGoals(monthId!),
    enabled: !!monthId,
  });
}

// ====================================================================
function MonthGoalsEditor({
  month, members, onDirtyChange
}: {
  month: DbMonth; members: DbTeamMember[];
  onDirtyChange: (dirty: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const calendarWeeks = getWeeksOfMonth(month.year, month.month);
  const weekCount = calendarWeeks.length;
  const { data, isLoading } = useAllMonthGoals(month.id);

  const [localGoals, setLocalGoals] = useState<AllGoals | null>(null);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(members[0]?.id || "team");
  const dbSnapshot = useRef<string>("");

  // Build local state from DB
  useEffect(() => {
    if (!data || isLoading) return;
    const { monthlyGoals, weeklyGoals } = data;
    const goals: AllGoals = {};

    members.forEach(m => {
      const mg = monthlyGoals.find((g: any) => g.member_id === m.id);
      const wgs = weeklyGoals.filter((w: any) => w.member_id === m.id);
      goals[m.id] = {
        monthly: getMetrics(mg),
        weeks: Array.from({ length: weekCount }, (_, wi) => {
          const w = wgs.find((wk: any) => wk.week_number === wi + 1);
          return w ? getMetrics(w) : zeroMetrics();
        }),
        workingDays: Array.from({ length: weekCount }, (_, wi) => {
          const w = wgs.find((wk: any) => wk.week_number === wi + 1);
          return (w as any)?.working_days || DEFAULT_WORKING_DAYS;
        }),
      };
    });

    const snap = JSON.stringify(goals);
    dbSnapshot.current = snap;
    setLocalGoals(goals);
  }, [data, isLoading, members.length, month.id, weekCount]);

  // Team totals computed live
  const teamMonthly = useMemo(() => {
    if (!localGoals) return zeroMetrics();
    return sumMetricsList(Object.values(localGoals).map(g => g.monthly));
  }, [localGoals]);

  const teamWeeks = useMemo(() => {
    if (!localGoals) return Array.from({ length: weekCount }, () => zeroMetrics());
    return Array.from({ length: weekCount }, (_, wi) =>
      sumMetricsList(Object.values(localGoals).map(g => g.weeks[wi] || zeroMetrics()))
    );
  }, [localGoals, weekCount]);

  const isDirty = useMemo(() => {
    if (!localGoals) return false;
    return JSON.stringify(localGoals) !== dbSnapshot.current;
  }, [localGoals]);

  useEffect(() => { onDirtyChange(isDirty); }, [isDirty, onDirtyChange]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const updateMonthly = (memberId: string, key: string, value: number) => {
    setLocalGoals(prev => {
      if (!prev) return prev;
      return { ...prev, [memberId]: { ...prev[memberId], monthly: { ...prev[memberId].monthly, [key]: value } } };
    });
  };

  const updateWeek = (memberId: string, weekIdx: number, key: string, value: number) => {
    setLocalGoals(prev => {
      if (!prev) return prev;
      const g = prev[memberId];
      const weeks = [...g.weeks];
      weeks[weekIdx] = { ...weeks[weekIdx], [key]: value };
      const newMonthly = sumMetricsList(weeks);
      return { ...prev, [memberId]: { ...g, monthly: newMonthly, weeks } };
    });
  };

  const updateWorkingDays = (memberId: string, weekIdx: number, days: string) => {
    setLocalGoals(prev => {
      if (!prev) return prev;
      const g = prev[memberId];
      const wd = [...g.workingDays];
      wd[weekIdx] = days;
      return { ...prev, [memberId]: { ...g, workingDays: wd } };
    });
  };

  const distributeMonthlyToCloser = (memberId: string) => {
    setLocalGoals(prev => {
      if (!prev) return prev;
      return { ...prev, [memberId]: { ...prev[memberId], weeks: distributeToWeeks(prev[memberId].monthly, weekCount) } };
    });
    toast.success("Distribuído nas semanas!");
  };

  const handleSaveAll = async () => {
    if (!localGoals || !data) return;
    setSaving(true);
    try {
      const { monthlyGoals: existingMonthly, weeklyGoals: existingWeekly } = data;
      const allEntities: (string | null)[] = [null, ...members.map(m => m.id)];

      for (const memberId of allEntities) {
        const isTeam = !memberId;
        const monthly = isTeam ? teamMonthly : localGoals[memberId!].monthly;
        const weeks = isTeam ? teamWeeks : localGoals[memberId!].weeks;

        // Upsert monthly
        const existingMG = existingMonthly.find((g: any) =>
          isTeam ? g.member_id === null : g.member_id === memberId
        );
        if (existingMG) {
          await supabase.from("monthly_goals").update(monthly).eq("id", existingMG.id);
        } else {
          const p: any = { month_id: month.id, ...monthly };
          if (memberId) p.member_id = memberId;
          await supabase.from("monthly_goals").insert(p);
        }

        // Upsert weekly
        for (let wi = 0; wi < weekCount; wi++) {
          const existingWG = existingWeekly.find((w: any) =>
            w.week_number === wi + 1 && (isTeam ? w.member_id === null : w.member_id === memberId)
          );
          const weekData = {
            ...weeks[wi],
            working_days: isTeam ? DEFAULT_WORKING_DAYS : (localGoals[memberId!]?.workingDays?.[wi] || DEFAULT_WORKING_DAYS),
          };
          if (existingWG) {
            await supabase.from("weekly_goals").update(weekData).eq("id", existingWG.id);
          } else {
            const p: any = {
              month_id: month.id, week_number: wi + 1,
              start_date: calendarWeeks[wi].startDate, end_date: calendarWeeks[wi].endDate,
              ...weekData,
            };
            if (memberId) p.member_id = memberId;
            await supabase.from("weekly_goals").insert(p);
          }
        }
      }

      dbSnapshot.current = JSON.stringify(localGoals);
      toast.success("Todas as metas salvas!");
      queryClient.invalidateQueries({ queryKey: ["all-month-goals", month.id] });
      queryClient.invalidateQueries({ queryKey: ["monthly-goals"] });
      queryClient.invalidateQueries({ queryKey: ["weekly-goals"] });
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    }
    setSaving(false);
  };

  if (isLoading || !localGoals) {
    return <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>;
  }

  const tabs = [
    { id: "team", label: "Time", icon: Users },
    ...members.map(m => ({ id: m.id, label: m.name, icon: User, role: m.member_role })),
  ];

  const isViewingTeam = activeTab === "team";
  const activeMember = members.find(m => m.id === activeTab);
  const activeRole = activeMember?.member_role || "sdr";
  const visibleMetricKeys: readonly string[] = isViewingTeam
    ? METRIC_KEYS
    : activeRole === "closer"
      ? CLOSER_METRIC_KEYS
      : SDR_METRIC_KEYS;
  const currentMonthly = isViewingTeam ? teamMonthly : (localGoals[activeTab]?.monthly || zeroMetrics());
  const currentWeeks = isViewingTeam ? teamWeeks : (localGoals[activeTab]?.weeks || []);
  const currentWorkingDays = isViewingTeam
    ? Array.from({ length: weekCount }, () => DEFAULT_WORKING_DAYS)
    : (localGoals[activeTab]?.workingDays || Array.from({ length: weekCount }, () => DEFAULT_WORKING_DAYS));

  return (
    <div className="space-y-4">
      {/* Tabs + Save */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-1 overflow-x-auto">
          {tabs.map(tab => {
            const isActive = activeTab === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-lg transition-colors whitespace-nowrap ${
                  isActive ? "bg-primary text-primary-foreground" : "bg-secondary/40 text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                <Icon size={12} />
                {tab.label}
                {'role' in tab && tab.role && (
                  <span className={`text-[7px] font-bold uppercase px-1 py-0.5 rounded ${
                    tab.role === "closer" ? "bg-[hsl(280,65%,60%)]/20 text-[hsl(280,65%,65%)]" : "bg-primary/20 text-primary"
                  }`}>
                    {tab.role === "closer" ? "C" : "S"}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <button
          onClick={handleSaveAll}
          disabled={saving || !isDirty}
          className={`px-4 py-2 text-xs rounded-lg font-semibold flex items-center gap-1.5 transition-all ${
            isDirty ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-secondary text-muted-foreground"
          }`}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {isDirty ? "Salvar Tudo" : "✓ Salvo"}
        </button>
      </div>

      {isDirty && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-[10px] font-semibold">
          <AlertTriangle size={12} />
          Alterações não salvas
        </div>
      )}

      {isViewingTeam && (
        <p className="text-[9px] text-muted-foreground italic flex items-center gap-1">
          <Users size={10} />
          Soma automática das metas dos SDRs (somente leitura)
        </p>
      )}

      {/* Monthly */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Meta Mensal — {tabs.find(t => t.id === activeTab)?.label}
          </span>
          {!isViewingTeam && (
            <button onClick={() => distributeMonthlyToCloser(activeTab)} className="text-[9px] text-primary hover:underline font-semibold">
              ↓ Distribuir nas semanas
            </button>
          )}
        </div>
        <div className={`grid gap-2 ${visibleMetricKeys.length <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-5'}`}>
          {visibleMetricKeys.map(k => (
            <div key={k}>
              <label className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider block truncate" title={METRIC_LABELS[k]}>{METRIC_LABELS[k]}</label>
              <input
                type="number" min={0}
                value={currentMonthly[k]}
                onChange={e => !isViewingTeam && updateMonthly(activeTab, k, parseInt(e.target.value) || 0)}
                readOnly={isViewingTeam}
                className={`mt-1 w-full rounded-lg border border-border px-2 py-1.5 text-xs tabular-nums focus:ring-1 focus:ring-primary outline-none ${
                  isViewingTeam ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-secondary text-secondary-foreground"
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="h-px bg-border" />

      {/* Calendar + Weeks */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <MiniCalendar year={month.year} month={month.month} weeks={calendarWeeks} />
        <div className="space-y-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metas Semanais — {weekCount} semanas</span>
          {currentWeeks.map((wm, wi) => {
            const cw = calendarWeeks[wi];
            if (!cw) return null;
            const dateLabel = `${formatDateShort(cw.startDate)} — ${formatDateShort(cw.endDate)}`;
            const wd = currentWorkingDays[wi] || DEFAULT_WORKING_DAYS;
            const wdCount = getWorkingDaysCount(wd);
            const wdSet = new Set(wd.split(",").map(d => d.trim()));
            const daily = visibleMetricKeys.reduce((a, k) => ({ ...a, [k]: wdCount > 0 ? Math.round((wm[k] || 0) / wdCount) : 0 }), {} as MetricValues);

            const toggleDay = (day: string) => {
              const newSet = new Set(wdSet);
              if (newSet.has(day)) newSet.delete(day); else newSet.add(day);
              if (newSet.size === 0) return; // must have at least 1 day
              const ordered = ALL_WEEKDAYS.filter(d => newSet.has(d));
              updateWorkingDays(activeTab, wi, ordered.join(","));
            };

            return (
              <div key={wi} className="rounded-lg border border-border bg-secondary/20 p-3 space-y-2">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{wi + 1}</span>
                    <span className="text-xs font-semibold text-card-foreground">Semana {wi + 1}</span>
                    <span className="text-[10px] text-muted-foreground font-mono">{dateLabel}</span>
                  </div>
                  {/* Working days selector */}
                  {!isViewingTeam && (
                    <div className="flex items-center gap-1">
                      <span className="text-[8px] font-semibold text-muted-foreground uppercase mr-1">Dias:</span>
                      {ALL_WEEKDAYS.map(day => (
                        <button
                          key={day}
                          onClick={() => toggleDay(day)}
                          className={`w-6 h-6 rounded text-[8px] font-bold transition-colors ${
                            wdSet.has(day)
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:bg-secondary/80"
                          }`}
                        >
                          {day.charAt(0)}
                        </button>
                      ))}
                      <span className="text-[8px] text-muted-foreground ml-1">({wdCount}d)</span>
                    </div>
                  )}
                </div>

                {!isViewingTeam ? (
                  <>
                    <div className={`grid gap-1.5 ${visibleMetricKeys.length <= 3 ? 'grid-cols-3' : 'grid-cols-5'}`}>
                      {visibleMetricKeys.map(k => (
                        <div key={k}>
                          <label className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider block truncate" title={METRIC_LABELS[k]}>{METRIC_LABELS[k]}</label>
                          <input
                            type="number" min={0} value={wm[k]}
                            onChange={e => updateWeek(activeTab, wi, k, parseInt(e.target.value) || 0)}
                            className="mt-0.5 w-full rounded border border-border bg-secondary px-1.5 py-1 text-[10px] text-secondary-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      ))}
                    </div>
                    {visibleMetricKeys.some(k => daily[k] > 0) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/50">
                        <span className="text-[8px] font-semibold text-muted-foreground uppercase">Meta/dia ({wdCount}d):</span>
                        {visibleMetricKeys.map(k => daily[k] > 0 ? (
                          <span key={k} className="text-[8px] text-muted-foreground"><span className="text-primary font-semibold">{daily[k]}</span> {METRIC_LABELS[k]}</span>
                        ) : null)}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {visibleMetricKeys.map(k => wm[k] > 0 ? (
                        <span key={k} className="text-[9px] text-muted-foreground"><span className="text-secondary-foreground font-semibold">{wm[k]}</span> {METRIC_LABELS[k]}</span>
                      ) : null)}
                    </div>
                    {visibleMetricKeys.some(k => daily[k] > 0) && (
                      <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/50">
                        <span className="text-[8px] font-semibold text-muted-foreground uppercase">Diário:</span>
                        {visibleMetricKeys.map(k => daily[k] > 0 ? (
                          <span key={k} className="text-[8px] text-muted-foreground"><span className="text-primary font-semibold">{daily[k]}</span> {METRIC_LABELS[k]}</span>
                        ) : null)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ====================================================================
export default function GoalsManagement() {
  const { data: months, isLoading } = useMonths();
  const { data: members, isLoading: membersLoading } = useTeamMembers();
  const queryClient = useQueryClient();
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [dirtyMonths, setDirtyMonths] = useState<Set<string>>(new Set());
  const [editingMonth, setEditingMonth] = useState<DbMonth | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [duplicating, setDuplicating] = useState<string | null>(null);

  const handleDirtyChange = useCallback((monthId: string, dirty: boolean) => {
    setDirtyMonths(prev => {
      const next = new Set(prev);
      if (dirty) next.add(monthId); else next.delete(monthId);
      return next;
    });
  }, []);

  const handleToggleMonth = (monthId: string) => {
    if (expandedMonthId && expandedMonthId !== monthId && dirtyMonths.has(expandedMonthId)) {
      if (!confirm("Há alterações não salvas. Deseja descartar?")) return;
    }
    setExpandedMonthId(expandedMonthId === monthId ? null : monthId);
  };

  const handleDeleteMonth = async (month: DbMonth) => {
    if (!confirm(`Excluir "${month.label}" e todos os dados?`)) return;
    await supabase.from("daily_metrics").delete().eq("month_id", month.id);
    await supabase.from("weekly_goals").delete().eq("month_id", month.id);
    await supabase.from("monthly_goals").delete().eq("month_id", month.id);
    await supabase.from("months").delete().eq("id", month.id);
    toast.success("Mês excluído");
    queryClient.invalidateQueries({ queryKey: ["months"] });
  };

  const handleEditMonth = async () => {
    if (!editingMonth || !editLabel.trim()) return;
    const { error } = await supabase.from("months").update({ label: editLabel.trim() }).eq("id", editingMonth.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Mês atualizado!");
    queryClient.invalidateQueries({ queryKey: ["months"] });
    setEditingMonth(null);
  };

  const handleDuplicateMonth = async (sourceMonth: DbMonth) => {
    if (!confirm(`Duplicar "${sourceMonth.label}" para um novo mês com as mesmas metas?`)) return;
    setDuplicating(sourceMonth.id);

    // Calculate next month
    const nextM = sourceMonth.month === 12 ? 1 : sourceMonth.month + 1;
    const nextY = sourceMonth.month === 12 ? sourceMonth.year + 1 : sourceMonth.year;

    // Check if already exists
    const existing = months?.find(m => m.year === nextY && m.month === nextM);
    if (existing) {
      toast.error(`${MONTH_NAMES[nextM - 1]} ${nextY} já existe!`);
      setDuplicating(null);
      return;
    }

    const label = `${MONTH_NAMES[nextM - 1]} ${nextY}`;
    const { data: newMonth, error } = await supabase.from("months").insert({ year: nextY, month: nextM, label }).select().single();
    if (error) { toast.error(error.message); setDuplicating(null); return; }

    // Copy monthly goals
    const { data: srcMonthly } = await supabase.from("monthly_goals").select("*").eq("month_id", sourceMonth.id);
    for (const mg of srcMonthly || []) {
      const { id, created_at, month_id, ...rest } = mg;
      await supabase.from("monthly_goals").insert({ ...rest, month_id: newMonth.id });
    }

    // Copy weekly goals, adjusting week dates to new month
    const newWeeks = getWeeksOfMonth(nextY, nextM);
    const { data: srcWeekly } = await supabase.from("weekly_goals").select("*").eq("month_id", sourceMonth.id).order("week_number");
    const srcByMember = new Map<string, typeof srcWeekly>();
    for (const wg of srcWeekly || []) {
      const key = wg.member_id || "__team__";
      if (!srcByMember.has(key)) srcByMember.set(key, []);
      srcByMember.get(key)!.push(wg);
    }

    for (const [memberKey, srcWeeks] of srcByMember) {
      for (let i = 0; i < newWeeks.length; i++) {
        const src = srcWeeks[Math.min(i, srcWeeks.length - 1)];
        const { id, created_at, month_id, week_number, start_date, end_date, ...metrics } = src;
        await supabase.from("weekly_goals").insert({
          ...metrics,
          month_id: newMonth.id,
          week_number: newWeeks[i].weekNumber,
          start_date: newWeeks[i].startDate,
          end_date: newWeeks[i].endDate,
          member_id: memberKey === "__team__" ? null : memberKey,
        });
      }
    }

    toast.success(`${label} criado com metas duplicadas!`);
    queryClient.invalidateQueries({ queryKey: ["months"] });
    setExpandedMonthId(newMonth.id);
    setDuplicating(null);
  };

  const handleCreateNextMonth = async () => {
    setCreating(true);
    const next = getNextMonth(months?.map(m => ({ year: m.year, month: m.month })) || []);
    const label = `${MONTH_NAMES[next.month - 1]} ${next.year}`;
    const { data: newMonth, error } = await supabase.from("months").insert({ year: next.year, month: next.month, label }).select().single();
    if (error) { toast.error(error.message); setCreating(false); return; }

    const weeks = getWeeksOfMonth(next.year, next.month);
    const zero = zeroMetrics();
    const allEntities: (string | null)[] = [null, ...(members || []).map(m => m.id)];

    for (const memberId of allEntities) {
      const mp: any = { month_id: newMonth.id, ...zero };
      if (memberId) mp.member_id = memberId;
      await supabase.from("monthly_goals").insert(mp);
      for (const w of weeks) {
        const wp: any = { month_id: newMonth.id, week_number: w.weekNumber, start_date: w.startDate, end_date: w.endDate, ...zero };
        if (memberId) wp.member_id = memberId;
        await supabase.from("weekly_goals").insert(wp);
      }
    }

    toast.success(`${label} criado!`);
    queryClient.invalidateQueries({ queryKey: ["months"] });
    setExpandedMonthId(newMonth.id);
    setCreating(false);
  };

  if (isLoading || membersLoading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="animate-spin text-primary" size={24} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Gestão de Metas</h2>
          <p className="text-xs text-muted-foreground mt-1">Time = soma dos closers • Semanal ÷ 5 = diário</p>
        </div>
        <button onClick={handleCreateNextMonth} disabled={creating}
          className="px-4 py-2 text-xs rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-1.5 disabled:opacity-50">
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Próximo Mês
        </button>
      </div>

      <div className="space-y-3">
        {months?.map(month => {
          const isExpanded = expandedMonthId === month.id;
          const weeks = getWeeksOfMonth(month.year, month.month);
          const isDirty = dirtyMonths.has(month.id);

          return (
            <div key={month.id} className={`rounded-xl border bg-card overflow-hidden ${isDirty ? "border-destructive/50" : "border-border"}`}>
              <div className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20" onClick={() => handleToggleMonth(month.id)}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isDirty ? "bg-destructive/15" : "bg-primary/15"}`}>
                    {isDirty ? <AlertTriangle size={16} className="text-destructive" /> : <Calendar size={16} className="text-primary" />}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-card-foreground flex items-center gap-2">
                      {month.label}
                      {isDirty && <span className="text-[9px] px-1.5 py-0.5 bg-destructive/20 text-destructive rounded font-semibold">NÃO SALVO</span>}
                    </h4>
                    <span className="text-[10px] text-muted-foreground">{weeks.length} semanas • {weeks[0]?.label} → {weeks[weeks.length - 1]?.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <button onClick={e => { e.stopPropagation(); handleDuplicateMonth(month); }}
                    disabled={duplicating === month.id}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 disabled:opacity-50"
                    title="Duplicar mês">
                    {duplicating === month.id ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
                  </button>
                  <button onClick={e => { e.stopPropagation(); setEditingMonth(month); setEditLabel(month.label); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10"
                    title="Editar mês">
                    <Pencil size={14} />
                  </button>
                  <button onClick={e => { e.stopPropagation(); handleDeleteMonth(month); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Excluir mês">
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {isExpanded && members && (
                <div className="border-t border-border p-5 bg-secondary/5">
                  <MonthGoalsEditor month={month} members={members} onDirtyChange={(d) => handleDirtyChange(month.id, d)} />
                </div>
              )}
            </div>
          );
        })}

        {(!months || months.length === 0) && (
          <div className="text-center py-12 space-y-3">
            <Calendar size={32} className="text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhum mês cadastrado</p>
          </div>
        )}
      </div>

      {/* Edit Month Dialog */}
      <Dialog open={!!editingMonth} onOpenChange={(open) => !open && setEditingMonth(null)}>
        <DialogContent className="sm:max-w-sm bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
              <Pencil size={14} className="text-primary" /> Editar Mês
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Nome do mês</label>
            <input
              type="text"
              value={editLabel}
              onChange={e => setEditLabel(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-2 focus:ring-primary/50 outline-none"
            />
          </div>
          <DialogFooter>
            <button
              onClick={handleEditMonth}
              disabled={!editLabel.trim()}
              className="w-full rounded-xl bg-primary py-2.5 text-sm font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={14} /> Salvar
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
