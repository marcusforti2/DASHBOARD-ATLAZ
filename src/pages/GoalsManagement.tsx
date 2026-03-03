import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMonths, useMonthlyGoals, useWeeklyGoals, useTeamMembers } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, DbMonth, DbWeeklyGoal, DbMonthlyGoal } from "@/lib/db";
import { getWeeksOfMonth, getNextMonth, CalendarWeek } from "@/lib/calendar-utils";
import { MiniCalendar } from "@/components/dashboard/MiniCalendar";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Loader2, Calendar, ChevronDown,
  Save, X, RefreshCw, ArrowDownUp, Users, User
} from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// --- Helpers ---
function sumWeeklyToMonthly(weeks: DbWeeklyGoal[]): Record<string, number> {
  return METRIC_KEYS.reduce((acc, k) => {
    acc[k] = weeks.reduce((sum, w) => sum + ((w as any)[k] || 0), 0);
    return acc;
  }, {} as Record<string, number>);
}

function distributeMonthlyToWeeks(monthlyValues: Record<string, number>, weekCount: number): Record<string, number>[] {
  if (weekCount === 0) return [];
  return Array.from({ length: weekCount }, (_, i) =>
    METRIC_KEYS.reduce((acc, k) => {
      const total = monthlyValues[k] || 0;
      const base = Math.floor(total / weekCount);
      const remainder = total % weekCount;
      acc[k] = base + (i < remainder ? 1 : 0);
      return acc;
    }, {} as Record<string, number>)
  );
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

function getMetricValues(obj: any): Record<string, number> {
  return METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: (obj as any)?.[k] || 0 }), {} as Record<string, number>);
}

// --- Synced Goals Editor (works for team or individual member) ---
function SyncedGoalsEditor({
  monthId, year, month, memberId, memberName, calendarWeeks
}: {
  monthId: string; year: number; month: number;
  memberId: string | null; memberName: string;
  calendarWeeks: CalendarWeek[];
}) {
  const { data: goals, isLoading: goalsLoading } = useMonthlyGoals(monthId, memberId);
  const { data: weeklyGoals, isLoading: weeksLoading } = useWeeklyGoals(monthId, memberId);
  const queryClient = useQueryClient();
  const [monthlyValues, setMonthlyValues] = useState<Record<string, number> | null>(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [weekValues, setWeekValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generatingWeeks, setGeneratingWeeks] = useState(false);

  const isLoading = goalsLoading || weeksLoading;
  const currentMonthly = monthlyValues ?? getMetricValues(goals);
  const qkMonthly = ["monthly-goals", monthId, memberId ?? "team"];
  const qkWeekly = ["weekly-goals", monthId, memberId ?? "team"];

  const handleGenerateWeeks = async () => {
    setGeneratingWeeks(true);
    const distributed = distributeMonthlyToWeeks(currentMonthly, calendarWeeks.length);
    
    for (let i = 0; i < calendarWeeks.length; i++) {
      const cw = calendarWeeks[i];
      const payload: any = {
        month_id: monthId,
        week_number: cw.weekNumber,
        start_date: cw.startDate,
        end_date: cw.endDate,
        ...distributed[i],
      };
      if (memberId) payload.member_id = memberId;
      const { error } = await supabase.from("weekly_goals").insert(payload);
      if (error && error.code !== "23505") {
        toast.error(error.message);
        break;
      }
    }

    toast.success(`${calendarWeeks.length} semanas geradas para ${memberName}!`);
    queryClient.invalidateQueries({ queryKey: qkWeekly });
    setGeneratingWeeks(false);
  };

  const handleSaveMonthlyAndDistribute = async () => {
    setSaving(true);

    if (goals) {
      const { error } = await supabase.from("monthly_goals").update(currentMonthly).eq("id", goals.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const payload: any = { month_id: monthId, ...currentMonthly };
      if (memberId) payload.member_id = memberId;
      const { error } = await supabase.from("monthly_goals").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    if (weeklyGoals && weeklyGoals.length > 0) {
      const distributed = distributeMonthlyToWeeks(currentMonthly, weeklyGoals.length);
      for (let i = 0; i < weeklyGoals.length; i++) {
        await supabase.from("weekly_goals").update(distributed[i]).eq("id", weeklyGoals[i].id);
      }
    }

    toast.success(`Metas de ${memberName} salvas e distribuídas!`);
    queryClient.invalidateQueries({ queryKey: qkMonthly });
    queryClient.invalidateQueries({ queryKey: qkWeekly });
    setMonthlyValues(null);
    setSaving(false);
  };

  const recalcMonthlyFromWeeks = async (updatedWeeks: DbWeeklyGoal[]) => {
    if (updatedWeeks.length === 0) return;
    const totals = sumWeeklyToMonthly(updatedWeeks);
    if (goals) {
      await supabase.from("monthly_goals").update(totals).eq("id", goals.id);
    } else {
      const payload: any = { month_id: monthId, ...totals };
      if (memberId) payload.member_id = memberId;
      await supabase.from("monthly_goals").insert(payload);
    }
    queryClient.invalidateQueries({ queryKey: qkMonthly });
    setMonthlyValues(null);
  };

  const startEditWeek = (week: DbWeeklyGoal) => {
    setEditingWeek(week.week_number);
    setWeekValues(getMetricValues(week));
  };

  const handleSaveWeek = async () => {
    setSyncing(true);
    const weekToUpdate = weeklyGoals!.find(w => w.week_number === editingWeek);
    if (!weekToUpdate) return;

    const { error } = await supabase.from("weekly_goals").update(weekValues).eq("id", weekToUpdate.id);
    if (error) { toast.error(error.message); setSyncing(false); return; }

    const updatedWeeks = weeklyGoals!.map(w => w.week_number === editingWeek ? { ...w, ...weekValues } as DbWeeklyGoal : w);
    await recalcMonthlyFromWeeks(updatedWeeks);

    toast.success(`Semana ${editingWeek} salva — meta mensal atualizada!`);
    queryClient.invalidateQueries({ queryKey: qkWeekly });
    setEditingWeek(null);
    setSyncing(false);
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>;

  const weeklySum = weeklyGoals ? sumWeeklyToMonthly(weeklyGoals) : null;
  const isInSync = weeklySum && METRIC_KEYS.every(k => (weeklySum[k] || 0) === (currentMonthly[k] || 0));
  const hasWeeks = weeklyGoals && weeklyGoals.length > 0;

  // Daily goal info
  const weeklyAvg = hasWeeks && weeklyGoals.length > 0 ? getMetricValues(weeklyGoals[0]) : null;

  return (
    <div className="space-y-5">
      {/* Sync indicator */}
      {hasWeeks && (
        <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-semibold uppercase tracking-wider ${
          isInSync
            ? "bg-accent/10 text-accent-foreground border border-accent/20"
            : "bg-destructive/10 text-destructive border border-destructive/20"
        }`}>
          <ArrowDownUp size={12} />
          {isInSync ? "✓ Metas sincronizadas" : "⚠ Fora de sincronia — salve metas mensais para redistribuir"}
          {syncing && <Loader2 size={12} className="animate-spin ml-auto" />}
        </div>
      )}

      {/* Monthly Goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Meta Mensal — {memberName}
          </span>
          <button
            onClick={handleSaveMonthlyAndDistribute}
            disabled={saving}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            Salvar & Distribuir
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {METRIC_KEYS.map(k => (
            <div key={k}>
              <label className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider block truncate" title={METRIC_LABELS[k]}>
                {METRIC_LABELS[k]}
              </label>
              <input
                type="number" min={0}
                value={currentMonthly[k]}
                onChange={e => setMonthlyValues({ ...currentMonthly, [k]: parseInt(e.target.value) || 0 })}
                className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-secondary-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
              />
            </div>
          ))}
        </div>
        {hasWeeks && (
          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
            <RefreshCw size={9} />
            Ao salvar, distribui igualmente entre as {weeklyGoals.length} semanas • Meta diária = semanal ÷ 5 dias úteis
          </p>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Calendar + Weekly Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-4">
        <MiniCalendar year={year} month={month} weeks={hasWeeks ? weeklyGoals.map((w, i) => ({
          weekNumber: w.week_number,
          startDate: w.start_date || calendarWeeks[i]?.startDate || "",
          endDate: w.end_date || calendarWeeks[i]?.endDate || "",
          label: "",
        })) : calendarWeeks} />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Metas Semanais — {hasWeeks ? weeklyGoals.length : calendarWeeks.length} semanas
            </span>
          </div>

          {!hasWeeks && (
            <button
              onClick={handleGenerateWeeks}
              disabled={generatingWeeks}
              className="w-full py-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex flex-col items-center gap-2"
            >
              {generatingWeeks ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
              Gerar {calendarWeeks.length} semanas
            </button>
          )}

          <div className="space-y-2">
            {weeklyGoals?.map(week => {
              const isEditing = editingWeek === week.week_number;
              const dateLabel = week.start_date && week.end_date
                ? `${formatDateShort(week.start_date)} — ${formatDateShort(week.end_date)}`
                : "";
              // Daily = weekly / 5
              const dailyGoals = METRIC_KEYS.reduce((acc, k) => {
                acc[k] = Math.round(((week as any)[k] || 0) / 5);
                return acc;
              }, {} as Record<string, number>);

              return (
                <div key={week.week_number} className="rounded-lg border border-border bg-secondary/30 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">
                        {week.week_number}
                      </span>
                      <span className="text-xs font-semibold text-card-foreground">Semana {week.week_number}</span>
                      {dateLabel && (
                        <span className="text-[10px] text-muted-foreground font-mono">{dateLabel}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {isEditing ? (
                        <>
                          <button onClick={() => setEditingWeek(null)} className="p-1 rounded text-muted-foreground hover:text-foreground"><X size={12} /></button>
                          <button onClick={handleSaveWeek} disabled={syncing} className="px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground flex items-center gap-1">
                            {syncing && <Loader2 size={10} className="animate-spin" />} Salvar
                          </button>
                        </>
                      ) : (
                        <button onClick={() => startEditWeek(week)} className="p-1 rounded text-muted-foreground hover:text-foreground"><Edit2 size={12} /></button>
                      )}
                    </div>
                  </div>
                  {isEditing ? (
                    <div className="grid grid-cols-5 gap-1.5">
                      {METRIC_KEYS.map(k => (
                        <div key={k}>
                          <label className="text-[7px] font-semibold text-muted-foreground uppercase tracking-wider block truncate" title={METRIC_LABELS[k]}>
                            {METRIC_LABELS[k]}
                          </label>
                          <input
                            type="number" min={0}
                            value={weekValues[k]}
                            onChange={e => setWeekValues(v => ({ ...v, [k]: parseInt(e.target.value) || 0 }))}
                            className="mt-0.5 w-full rounded border border-border bg-secondary px-1.5 py-1 text-[10px] text-secondary-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {METRIC_KEYS.map(k => {
                          const val = (week as any)[k] || 0;
                          if (val === 0) return null;
                          return (
                            <span key={k} className="text-[9px] text-muted-foreground">
                              <span className="text-secondary-foreground font-semibold">{val}</span> {METRIC_LABELS[k]}
                            </span>
                          );
                        })}
                      </div>
                      {/* Daily breakdown */}
                      {METRIC_KEYS.some(k => dailyGoals[k] > 0) && (
                        <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1 border-t border-border/50">
                          <span className="text-[8px] font-semibold text-muted-foreground uppercase">Diário:</span>
                          {METRIC_KEYS.map(k => {
                            if (dailyGoals[k] === 0) return null;
                            return (
                              <span key={k} className="text-[8px] text-muted-foreground">
                                <span className="text-primary font-semibold">{dailyGoals[k]}</span> {METRIC_LABELS[k]}
                              </span>
                            );
                          })}
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
    </div>
  );
}

// --- Month Card with Tabs ---
function MonthGoalsCard({ month, isExpanded, onToggle, onDelete }: {
  month: DbMonth; isExpanded: boolean; onToggle: () => void; onDelete: () => void;
}) {
  const { data: members } = useTeamMembers();
  const [activeTab, setActiveTab] = useState<string | null>(null); // null = team
  const calendarWeeks = getWeeksOfMonth(month.year, month.month);

  const tabs = [
    { id: null, label: "Time", icon: Users },
    ...(members || []).map(m => ({ id: m.id, label: m.name, icon: User })),
  ];

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden transition-all">
      <div
        className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
            <Calendar size={16} className="text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-card-foreground">{month.label}</h4>
            <span className="text-[10px] text-muted-foreground">
              {calendarWeeks.length} semanas • {calendarWeeks[0]?.label} → {calendarWeeks[calendarWeeks.length - 1]?.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            title="Excluir"
          >
            <Trash2 size={14} />
          </button>
          <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border">
          {/* Tabs: Time | Alex | Aline | Maíza */}
          <div className="flex items-center gap-1 p-3 pb-0 overflow-x-auto">
            {tabs.map(tab => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id ?? "team"}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-semibold rounded-t-lg border border-b-0 transition-colors whitespace-nowrap ${
                    isActive
                      ? "bg-card text-primary border-border"
                      : "bg-secondary/30 text-muted-foreground border-transparent hover:bg-secondary/60"
                  }`}
                >
                  <Icon size={12} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-5 bg-secondary/5">
            <SyncedGoalsEditor
              key={activeTab ?? "team"}
              monthId={month.id}
              year={month.year}
              month={month.month}
              memberId={activeTab}
              memberName={activeTab ? tabs.find(t => t.id === activeTab)?.label || "" : "Time"}
              calendarWeeks={calendarWeeks}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// --- Main Page ---
export default function GoalsManagement() {
  const { data: months, isLoading } = useMonths();
  const queryClient = useQueryClient();
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleDeleteMonth = async (month: DbMonth) => {
    if (!confirm(`Excluir "${month.label}" e todos os dados? Não pode ser desfeito.`)) return;
    await supabase.from("weekly_goals").delete().eq("month_id", month.id);
    await supabase.from("monthly_goals").delete().eq("month_id", month.id);
    const { error } = await supabase.from("months").delete().eq("id", month.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Mês excluído");
      queryClient.invalidateQueries({ queryKey: ["months"] });
    }
  };

  const handleCreateNextMonth = async () => {
    setCreating(true);
    const next = getNextMonth(months?.map(m => ({ year: m.year, month: m.month })) || []);
    const label = `${MONTH_NAMES[next.month - 1]} ${next.year}`;

    const { data: newMonth, error } = await supabase.from("months").insert({ year: next.year, month: next.month, label }).select().single();
    if (error) { toast.error(error.message); setCreating(false); return; }

    const weeks = getWeeksOfMonth(next.year, next.month);
    const zeroMetrics = METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>);
    
    // Create team weekly goals
    for (const w of weeks) {
      await supabase.from("weekly_goals").insert({
        month_id: newMonth.id,
        week_number: w.weekNumber,
        start_date: w.startDate,
        end_date: w.endDate,
        ...zeroMetrics,
      });
    }

    // Create team monthly goals
    await supabase.from("monthly_goals").insert({ month_id: newMonth.id, ...zeroMetrics });

    toast.success(`${label} criado com ${weeks.length} semanas!`);
    queryClient.invalidateQueries({ queryKey: ["months"] });
    setExpandedMonthId(newMonth.id);
    setCreating(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="animate-spin text-primary" size={24} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Gestão de Metas</h2>
          <p className="text-xs text-muted-foreground mt-1">Defina metas do time e individuais por closer</p>
        </div>
        <button
          onClick={handleCreateNextMonth}
          disabled={creating}
          className="px-4 py-2 text-xs rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Próximo Mês
        </button>
      </div>

      <div className="space-y-3">
        {months?.map(month => (
          <MonthGoalsCard
            key={month.id}
            month={month}
            isExpanded={expandedMonthId === month.id}
            onToggle={() => setExpandedMonthId(expandedMonthId === month.id ? null : month.id)}
            onDelete={() => handleDeleteMonth(month)}
          />
        ))}

        {(!months || months.length === 0) && (
          <div className="text-center py-12 space-y-3">
            <Calendar size={32} className="text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhum mês cadastrado</p>
            <p className="text-xs text-muted-foreground">Clique em "Próximo Mês" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
