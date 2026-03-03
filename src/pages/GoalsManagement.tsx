import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMonths, useMonthlyGoals, useWeeklyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, DbMonth, DbWeeklyGoal } from "@/lib/db";
import { getWeeksOfMonth, getNextMonth, CalendarWeek } from "@/lib/calendar-utils";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Loader2, Calendar, ChevronDown,
  Save, X, RefreshCw, ArrowDownUp
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

// --- Synced Goals Editor ---
function SyncedGoalsEditor({ monthId, monthLabel, year, month }: { monthId: string; monthLabel: string; year: number; month: number }) {
  const { data: goals, isLoading: goalsLoading } = useMonthlyGoals(monthId);
  const { data: weeklyGoals, isLoading: weeksLoading } = useWeeklyGoals(monthId);
  const queryClient = useQueryClient();
  const [monthlyValues, setMonthlyValues] = useState<Record<string, number> | null>(null);
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [weekValues, setWeekValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generatingWeeks, setGeneratingWeeks] = useState(false);

  const isLoading = goalsLoading || weeksLoading;
  const calendarWeeks = getWeeksOfMonth(year, month);

  const currentMonthly = monthlyValues ?? (goals
    ? METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: (goals as any)[k] || 0 }), {} as Record<string, number>)
    : METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>)
  );

  // Auto-generate weeks if none exist
  const handleGenerateWeeks = async () => {
    setGeneratingWeeks(true);
    const distributed = distributeMonthlyToWeeks(currentMonthly, calendarWeeks.length);
    
    for (let i = 0; i < calendarWeeks.length; i++) {
      const cw = calendarWeeks[i];
      const { error } = await supabase.from("weekly_goals").insert({
        month_id: monthId,
        week_number: cw.weekNumber,
        start_date: cw.startDate,
        end_date: cw.endDate,
        ...distributed[i],
      });
      if (error && error.code !== "23505") { // ignore duplicate
        toast.error(error.message);
        break;
      }
    }

    toast.success(`${calendarWeeks.length} semanas geradas automaticamente!`);
    queryClient.invalidateQueries({ queryKey: ["weekly-goals", monthId] });
    setGeneratingWeeks(false);
  };

  // Save monthly + distribute
  const handleSaveMonthlyAndDistribute = async () => {
    setSaving(true);
    const payload = { month_id: monthId, ...currentMonthly };

    if (goals) {
      const { error } = await supabase.from("monthly_goals").update(currentMonthly).eq("month_id", monthId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("monthly_goals").insert(payload);
      if (error) { toast.error(error.message); setSaving(false); return; }
    }

    if (weeklyGoals && weeklyGoals.length > 0) {
      const distributed = distributeMonthlyToWeeks(currentMonthly, weeklyGoals.length);
      for (let i = 0; i < weeklyGoals.length; i++) {
        const { error } = await supabase
          .from("weekly_goals")
          .update(distributed[i])
          .eq("month_id", monthId)
          .eq("week_number", weeklyGoals[i].week_number);
        if (error) { toast.error(error.message); break; }
      }
    }

    toast.success("Metas salvas e distribuídas nas semanas!");
    queryClient.invalidateQueries({ queryKey: ["monthly-goals", monthId] });
    queryClient.invalidateQueries({ queryKey: ["weekly-goals", monthId] });
    setMonthlyValues(null);
    setSaving(false);
  };

  const recalcMonthlyFromWeeks = async (updatedWeeks: DbWeeklyGoal[]) => {
    if (updatedWeeks.length === 0) return;
    const totals = sumWeeklyToMonthly(updatedWeeks);
    if (goals) {
      await supabase.from("monthly_goals").update(totals).eq("month_id", monthId);
    } else {
      await supabase.from("monthly_goals").insert({ month_id: monthId, ...totals });
    }
    queryClient.invalidateQueries({ queryKey: ["monthly-goals", monthId] });
    setMonthlyValues(null);
  };

  const startEditWeek = (week: any) => {
    setEditingWeek(week.week_number);
    const vals: Record<string, number> = {};
    METRIC_KEYS.forEach(k => { vals[k] = (week as any)[k] || 0; });
    setWeekValues(vals);
  };

  const handleSaveWeek = async () => {
    setSyncing(true);
    const { error } = await supabase.from("weekly_goals").update(weekValues).eq("month_id", monthId).eq("week_number", editingWeek);
    if (error) { toast.error(error.message); setSyncing(false); return; }

    const updatedWeeks = weeklyGoals!.map(w => w.week_number === editingWeek ? { ...w, ...weekValues } as DbWeeklyGoal : w);
    await recalcMonthlyFromWeeks(updatedWeeks);

    toast.success(`Semana ${editingWeek} salva — meta mensal atualizada!`);
    queryClient.invalidateQueries({ queryKey: ["weekly-goals", monthId] });
    setEditingWeek(null);
    setSyncing(false);
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>;

  const weeklySum = weeklyGoals ? sumWeeklyToMonthly(weeklyGoals) : null;
  const isInSync = weeklySum && METRIC_KEYS.every(k => (weeklySum[k] || 0) === (currentMonthly[k] || 0));
  const hasWeeks = weeklyGoals && weeklyGoals.length > 0;

  // Build a map of week dates for display
  const weekDateMap = new Map<number, CalendarWeek>();
  calendarWeeks.forEach(cw => weekDateMap.set(cw.weekNumber, cw));

  return (
    <div className="space-y-6">
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
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metas Mensais</span>
          <button
            onClick={handleSaveMonthlyAndDistribute}
            disabled={saving}
            className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
            Salvar Metas
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
            Ao salvar, distribui igualmente entre as {weeklyGoals.length} semanas
          </p>
        )}
      </div>

      <div className="h-px bg-border" />

      {/* Weekly Goals */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Metas Semanais — {calendarWeeks.length} semanas reais
          </span>
        </div>

        {/* Auto-generate button if no weeks */}
        {!hasWeeks && (
          <button
            onClick={handleGenerateWeeks}
            disabled={generatingWeeks}
            className="w-full py-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary text-xs font-semibold hover:bg-primary/10 transition-colors flex flex-col items-center gap-2"
          >
            {generatingWeeks ? <Loader2 size={16} className="animate-spin" /> : <Calendar size={16} />}
            Gerar {calendarWeeks.length} semanas do calendário real
            <span className="text-[9px] font-normal text-muted-foreground">
              {calendarWeeks.map(w => w.label).join("  •  ")}
            </span>
          </button>
        )}

        <div className="space-y-2">
          {weeklyGoals?.map(week => {
            const isEditing = editingWeek === week.week_number;
            const calWeek = weekDateMap.get(week.week_number);
            const dateLabel = (week as any).start_date && (week as any).end_date
              ? `${formatDateShort((week as any).start_date)} — ${formatDateShort((week as any).end_date)}`
              : calWeek?.label || "";

            return (
              <div key={week.week_number} className="rounded-lg border border-border bg-secondary/30 p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-card-foreground">Semana {week.week_number}</span>
                    {dateLabel && (
                      <span className="text-[9px] text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
                        📅 {dateLabel}
                      </span>
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
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function formatDateShort(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// --- Main Page ---
export default function GoalsManagement() {
  const { data: months, isLoading } = useMonths();
  const queryClient = useQueryClient();
  const [showMonthForm, setShowMonthForm] = useState(false);
  const [editingMonth, setEditingMonth] = useState<DbMonth | null>(null);
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const handleDeleteMonth = async (month: DbMonth) => {
    if (!confirm(`Excluir "${month.label}" e todos os dados? Não pode ser desfeito.`)) return;
    // Delete weekly goals, monthly goals, then month
    await supabase.from("weekly_goals").delete().eq("month_id", month.id);
    await supabase.from("monthly_goals").delete().eq("month_id", month.id);
    const { error } = await supabase.from("months").delete().eq("id", month.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Mês excluído");
      queryClient.invalidateQueries({ queryKey: ["months"] });
    }
  };

  // Auto-create next month with weeks
  const handleCreateNextMonth = async () => {
    setCreating(true);
    const next = getNextMonth(months?.map(m => ({ year: m.year, month: m.month })) || []);
    const label = `${MONTH_NAMES[next.month - 1]} ${next.year}`;

    const { data: newMonth, error } = await supabase.from("months").insert({ year: next.year, month: next.month, label }).select().single();
    if (error) { toast.error(error.message); setCreating(false); return; }

    // Auto-create weekly goals for real calendar weeks
    const weeks = getWeeksOfMonth(next.year, next.month);
    const zeroMetrics = METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>);
    
    for (const w of weeks) {
      await supabase.from("weekly_goals").insert({
        month_id: newMonth.id,
        week_number: w.weekNumber,
        start_date: w.startDate,
        end_date: w.endDate,
        ...zeroMetrics,
      });
    }

    // Create empty monthly goals
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
          <p className="text-xs text-muted-foreground mt-1">Semanas geradas automaticamente pelo calendário real</p>
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
        {months?.map(month => {
          const isExpanded = expandedMonthId === month.id;
          const weeks = getWeeksOfMonth(month.year, month.month);
          return (
            <div key={month.id} className="rounded-xl border border-border bg-card overflow-hidden transition-all">
              <div
                className="flex items-center justify-between p-4 cursor-pointer hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedMonthId(isExpanded ? null : month.id)}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/15 flex items-center justify-center">
                    <Calendar size={16} className="text-primary" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-card-foreground">{month.label}</h4>
                    <span className="text-[10px] text-muted-foreground">{weeks.length} semanas • {weeks[0]?.label} → {weeks[weeks.length - 1]?.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteMonth(month); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir"
                  >
                    <Trash2 size={14} />
                  </button>
                  <ChevronDown size={14} className={`text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {isExpanded && (
                <div className="border-t border-border p-5 bg-secondary/5">
                  <SyncedGoalsEditor monthId={month.id} monthLabel={month.label} year={month.year} month={month.month} />
                </div>
              )}
            </div>
          );
        })}

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
