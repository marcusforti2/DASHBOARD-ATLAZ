import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMonths, useMonthlyGoals, useWeeklyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, DbMonth } from "@/lib/db";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Edit2, Trash2, Loader2, Calendar, Target, ChevronDown,
  Save, X, ChevronRight
} from "lucide-react";

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// --- Month Form Dialog ---
function MonthFormDialog({
  month,
  onClose,
  onSaved,
}: {
  month?: DbMonth | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const now = new Date();
  const [year, setYear] = useState(month?.year || now.getFullYear());
  const [monthNum, setMonthNum] = useState(month?.month || now.getMonth() + 1);
  const [saving, setSaving] = useState(false);

  const label = `${MONTH_NAMES[monthNum - 1]} ${year}`;

  const handleSave = async () => {
    setSaving(true);
    if (month) {
      const { error } = await supabase.from("months").update({ year, month: monthNum, label }).eq("id", month.id);
      if (error) toast.error(error.message); else { toast.success("Mês atualizado!"); onSaved(); }
    } else {
      const { error } = await supabase.from("months").insert({ year, month: monthNum, label });
      if (error) toast.error(error.message); else { toast.success("Mês criado!"); onSaved(); }
    }
    setSaving(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-card-foreground mb-4 uppercase tracking-wider">
          {month ? "Editar Mês" : "Novo Mês"}
        </h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Mês</label>
            <select
              value={monthNum}
              onChange={e => setMonthNum(parseInt(e.target.value))}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none appearance-none"
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={i} value={i + 1}>{name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Ano</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(parseInt(e.target.value) || now.getFullYear())}
              min={2020}
              max={2030}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">Label: <span className="font-semibold text-foreground">{label}</span></p>
        <div className="flex justify-end gap-2 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-xs rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors">
            Cancelar
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-xs rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5">
            {saving && <Loader2 size={12} className="animate-spin" />}
            {month ? "Salvar" : "Criar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// --- Monthly Goals Editor ---
function MonthlyGoalsEditor({ monthId, monthLabel }: { monthId: string; monthLabel: string }) {
  const { data: goals, isLoading } = useMonthlyGoals(monthId);
  const queryClient = useQueryClient();
  const [values, setValues] = useState<Record<string, number> | null>(null);
  const [saving, setSaving] = useState(false);

  // Initialize values from fetched goals
  const currentValues = values ?? (goals
    ? METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: (goals as any)[k] || 0 }), {} as Record<string, number>)
    : METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>)
  );

  const handleSave = async () => {
    setSaving(true);
    const payload = { month_id: monthId, ...currentValues };

    // Check if goals exist already
    if (goals) {
      const { error } = await supabase.from("monthly_goals").update(currentValues).eq("month_id", monthId);
      if (error) toast.error(error.message);
      else toast.success("Metas mensais atualizadas!");
    } else {
      const { error } = await supabase.from("monthly_goals").insert(payload);
      if (error) toast.error(error.message);
      else toast.success("Metas mensais criadas!");
    }
    queryClient.invalidateQueries({ queryKey: ["monthly-goals", monthId] });
    setSaving(false);
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metas Mensais</span>
        <button
          onClick={handleSave}
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
              type="number"
              min={0}
              value={currentValues[k]}
              onChange={e => setValues({ ...currentValues, [k]: parseInt(e.target.value) || 0 })}
              className="mt-1 w-full rounded-lg border border-border bg-secondary px-2 py-1.5 text-xs text-secondary-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Weekly Goals Editor ---
function WeeklyGoalsEditor({ monthId }: { monthId: string }) {
  const { data: weeklyGoals, isLoading } = useWeeklyGoals(monthId);
  const queryClient = useQueryClient();
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const [weekValues, setWeekValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [addingWeek, setAddingWeek] = useState(false);

  const nextWeekNum = (weeklyGoals?.length || 0) + 1;

  const startEditWeek = (week: any) => {
    setEditingWeek(week.week_number);
    const vals: Record<string, number> = {};
    METRIC_KEYS.forEach(k => { vals[k] = (week as any)[k] || 0; });
    setWeekValues(vals);
  };

  const startAddWeek = () => {
    setAddingWeek(true);
    setEditingWeek(nextWeekNum);
    setWeekValues(METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>));
  };

  const handleSaveWeek = async () => {
    setSaving(true);
    const existing = weeklyGoals?.find(w => w.week_number === editingWeek);

    if (existing) {
      const { error } = await supabase.from("weekly_goals").update(weekValues).eq("month_id", monthId).eq("week_number", editingWeek);
      if (error) toast.error(error.message);
      else toast.success(`Semana ${editingWeek} atualizada!`);
    } else {
      const { error } = await supabase.from("weekly_goals").insert({
        month_id: monthId,
        week_number: editingWeek!,
        ...weekValues,
      });
      if (error) toast.error(error.message);
      else toast.success(`Semana ${editingWeek} criada!`);
    }

    queryClient.invalidateQueries({ queryKey: ["weekly-goals", monthId] });
    setEditingWeek(null);
    setAddingWeek(false);
    setSaving(false);
  };

  const handleDeleteWeek = async (weekNumber: number) => {
    if (!confirm(`Excluir metas da Semana ${weekNumber}?`)) return;
    const { error } = await supabase.from("weekly_goals").delete().eq("month_id", monthId).eq("week_number", weekNumber);
    if (error) toast.error(error.message);
    else {
      toast.success(`Semana ${weekNumber} excluída`);
      queryClient.invalidateQueries({ queryKey: ["weekly-goals", monthId] });
    }
  };

  if (isLoading) return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Metas Semanais ({weeklyGoals?.length || 0} semanas)
        </span>
        <button
          onClick={startAddWeek}
          disabled={addingWeek}
          className="px-3 py-1.5 text-[10px] rounded-lg font-medium bg-accent text-accent-foreground hover:bg-accent/90 transition-colors flex items-center gap-1.5"
        >
          <Plus size={10} /> Semana {nextWeekNum}
        </button>
      </div>

      {/* Week rows */}
      <div className="space-y-2">
        {weeklyGoals?.map(week => {
          const isEditing = editingWeek === week.week_number && !addingWeek;
          return (
            <div key={week.week_number} className="rounded-lg border border-border bg-secondary/30 p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-card-foreground">Semana {week.week_number}</span>
                <div className="flex items-center gap-1">
                  {isEditing ? (
                    <>
                      <button onClick={() => setEditingWeek(null)} className="p-1 rounded text-muted-foreground hover:text-foreground"><X size={12} /></button>
                      <button onClick={handleSaveWeek} disabled={saving} className="px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground flex items-center gap-1">
                        {saving && <Loader2 size={10} className="animate-spin" />} Salvar
                      </button>
                    </>
                  ) : (
                    <>
                      <button onClick={() => startEditWeek(week)} className="p-1 rounded text-muted-foreground hover:text-foreground"><Edit2 size={12} /></button>
                      <button onClick={() => handleDeleteWeek(week.week_number)} className="p-1 rounded text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                    </>
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

        {/* Adding new week */}
        {addingWeek && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-primary">Nova Semana {editingWeek}</span>
              <div className="flex items-center gap-1">
                <button onClick={() => { setAddingWeek(false); setEditingWeek(null); }} className="p-1 rounded text-muted-foreground hover:text-foreground"><X size={12} /></button>
                <button onClick={handleSaveWeek} disabled={saving} className="px-2 py-1 text-[10px] rounded bg-primary text-primary-foreground flex items-center gap-1">
                  {saving && <Loader2 size={10} className="animate-spin" />} Criar
                </button>
              </div>
            </div>
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
          </div>
        )}
      </div>
    </div>
  );
}

// --- Main Goals Management Page ---
export default function GoalsManagement() {
  const { data: months, isLoading } = useMonths();
  const queryClient = useQueryClient();
  const [showMonthForm, setShowMonthForm] = useState(false);
  const [editingMonth, setEditingMonth] = useState<DbMonth | null>(null);
  const [expandedMonthId, setExpandedMonthId] = useState<string | null>(null);

  const handleDeleteMonth = async (month: DbMonth) => {
    if (!confirm(`Excluir "${month.label}" e todos os dados associados? Esta ação não pode ser desfeita.`)) return;
    const { error } = await supabase.from("months").delete().eq("id", month.id);
    if (error) toast.error(error.message);
    else {
      toast.success("Mês excluído");
      queryClient.invalidateQueries({ queryKey: ["months"] });
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground">Gestão de Metas</h2>
          <p className="text-xs text-muted-foreground mt-1">Gerencie meses, metas mensais e semanais</p>
        </div>
        <button
          onClick={() => { setEditingMonth(null); setShowMonthForm(true); }}
          className="px-4 py-2 text-xs rounded-lg font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1.5"
        >
          <Plus size={14} /> Novo Mês
        </button>
      </div>

      {/* Months list */}
      <div className="space-y-3">
        {months?.map(month => {
          const isExpanded = expandedMonthId === month.id;
          return (
            <div key={month.id} className="rounded-xl border border-border bg-card overflow-hidden transition-all">
              {/* Month header */}
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
                    <span className="text-[10px] text-muted-foreground">{month.year} • Mês {month.month}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={e => { e.stopPropagation(); setEditingMonth(month); setShowMonthForm(true); }}
                    className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    title="Editar"
                  >
                    <Edit2 size={14} />
                  </button>
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

              {/* Expanded: Monthly + Weekly Goals */}
              {isExpanded && (
                <div className="border-t border-border p-5 space-y-6 bg-secondary/5">
                  <MonthlyGoalsEditor monthId={month.id} monthLabel={month.label} />
                  <div className="h-px bg-border" />
                  <WeeklyGoalsEditor monthId={month.id} />
                </div>
              )}
            </div>
          );
        })}

        {(!months || months.length === 0) && (
          <div className="text-center py-12 space-y-3">
            <Calendar size={32} className="text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Nenhum mês cadastrado</p>
            <p className="text-xs text-muted-foreground">Clique em "Novo Mês" para começar</p>
          </div>
        )}
      </div>

      {/* Month form dialog */}
      {showMonthForm && (
        <MonthFormDialog
          month={editingMonth}
          onClose={() => setShowMonthForm(false)}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["months"] })}
        />
      )}
    </div>
  );
}
