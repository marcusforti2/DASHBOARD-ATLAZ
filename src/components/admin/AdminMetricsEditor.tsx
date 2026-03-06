import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS,
  METRIC_LABELS, getMemberRoles,
} from "@/lib/db";
import { Loader2, Plus, Trash2, CalendarDays, BarChart3 } from "lucide-react";
import { useMonths } from "@/hooks/use-metrics";
import { useQueryClient } from "@tanstack/react-query";

const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

const METRIC_ICONS: Record<string, string> = {
  conexoes: "🔗", conexoes_aceitas: "✅", abordagens: "💬", inmail: "📩", follow_up: "🔄",
  numero: "📞", lig_agendada: "📅", lig_realizada: "☎️", reuniao_agendada: "🗓️", reuniao_realizada: "🤝",
};

interface AdminMetricsEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMemberId: string;
  memberName: string;
  memberRole: string;
}

export function AdminMetricsEditor({ open, onOpenChange, teamMemberId, memberName, memberRole }: AdminMetricsEditorProps) {
  const queryClient = useQueryClient();
  const { data: months } = useMonths();
  const today = new Date();

  const [selectedDate, setSelectedDate] = useState<Date>(today);
  const [metrics, setMetrics] = useState<Record<string, number> | null>(null);
  const [metricId, setMetricId] = useState<string | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [editMetric, setEditMetric] = useState<string | null>(null);
  const [editQty, setEditQty] = useState(1);
  const [editMode, setEditMode] = useState<"add" | "delete">("add");
  const [saving, setSaving] = useState(false);

  const roles = getMemberRoles({ member_role: memberRole });
  const roleMetrics = useMemo(() => {
    if (roles.includes("sdr") && roles.includes("closer")) return [...METRIC_KEYS];
    if (roles.includes("closer")) return [...CLOSER_METRIC_KEYS];
    return [...SDR_METRIC_KEYS];
  }, [roles]);

  const dateStr = format(selectedDate, "yyyy-MM-dd");

  const findMonth = (date: Date) => {
    return months?.find(m => m.year === date.getFullYear() && m.month === date.getMonth() + 1);
  };

  const loadMetrics = async (date: Date) => {
    setLoadingMetrics(true);
    setEditMetric(null);
    const ds = format(date, "yyyy-MM-dd");
    const { data } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", ds)
      .maybeSingle();

    if (data) {
      const m: Record<string, number> = {};
      roleMetrics.forEach(k => { m[k] = (data as any)[k] || 0; });
      setMetrics(m);
      setMetricId(data.id);
    } else {
      const m: Record<string, number> = {};
      roleMetrics.forEach(k => { m[k] = 0; });
      setMetrics(m);
      setMetricId(null);
    }
    setLoadingMetrics(false);
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    loadMetrics(date);
  };

  const handleQuickDate = (date: Date) => {
    setSelectedDate(date);
    loadMetrics(date);
  };

  // When dialog opens, load metrics for selected date
  const handleOpenChange = (o: boolean) => {
    if (o) {
      loadMetrics(selectedDate);
    }
    onOpenChange(o);
  };

  const handleSaveMetric = async () => {
    if (!editMetric || saving) return;
    setSaving(true);

    const month = findMonth(selectedDate);
    if (!month) {
      toast.error("Mês não encontrado para essa data");
      setSaving(false);
      return;
    }

    const dateObj = new Date(dateStr + "T12:00:00");
    const dayName = DAY_NAMES[dateObj.getDay()];

    if (editMode === "add") {
      // Create lead_entries
      const auditInserts = Array.from({ length: editQty }, () => ({
        member_id: teamMemberId,
        date: dateStr,
        lead_name: METRIC_LABELS[editMetric] || editMetric,
        whatsapp: "",
        social_link: "",
        metric_type: editMetric,
        source: "admin",
      }));
      await supabase.from("lead_entries").insert(auditInserts);

      // Update/create daily_metrics
      if (metricId) {
        const currentVal = metrics?.[editMetric] || 0;
        await supabase.from("daily_metrics").update({ [editMetric]: currentVal + editQty }).eq("id", metricId);
      } else {
        const payload: any = { member_id: teamMemberId, month_id: month.id, date: dateStr, day_of_week: dayName };
        METRIC_KEYS.forEach(k => { payload[k] = 0; });
        payload[editMetric] = editQty;
        await supabase.from("daily_metrics").insert(payload);
      }
      toast.success(`+${editQty} ${METRIC_LABELS[editMetric]} em ${format(selectedDate, "dd/MM")}`);
    } else {
      // Delete mode
      const currentVal = metrics?.[editMetric] || 0;
      const toRemove = Math.min(editQty, currentVal);

      if (metricId) {
        await supabase.from("daily_metrics").update({ [editMetric]: Math.max(0, currentVal - toRemove) }).eq("id", metricId);
      }

      const { data: entries } = await supabase
        .from("lead_entries").select("id")
        .eq("member_id", teamMemberId).eq("date", dateStr).eq("metric_type", editMetric)
        .order("created_at", { ascending: false }).limit(toRemove);

      if (entries?.length) {
        await supabase.from("lead_entries").delete().in("id", entries.map(e => e.id));
      }
      toast(`-${toRemove} ${METRIC_LABELS[editMetric]} em ${format(selectedDate, "dd/MM")}`, { description: "Removido com sucesso" });
    }

    // Refresh
    queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
    await loadMetrics(selectedDate);
    setEditMetric(null);
    setSaving(false);
  };

  const totalForDay = useMemo(() => {
    if (!metrics) return 0;
    return roleMetrics.reduce((s, k) => s + (metrics[k] || 0), 0);
  }, [metrics, roleMetrics]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[480px] bg-card border-border p-0 max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-sm">
            <BarChart3 size={16} className="text-primary" />
            Métricas de {memberName.split(" ")[0]}
          </DialogTitle>
        </DialogHeader>

        <div className="px-5 pb-5 space-y-4">
          {/* Quick date buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => handleQuickDate(today)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                dateStr === format(today, "yyyy-MM-dd")
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              Hoje
            </button>
            <button
              onClick={() => handleQuickDate(subDays(today, 1))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                dateStr === format(subDays(today, 1), "yyyy-MM-dd")
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              Ontem
            </button>
            <button
              onClick={() => handleQuickDate(subDays(today, 2))}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                dateStr === format(subDays(today, 2), "yyyy-MM-dd")
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
              )}
            >
              Anteontem
            </button>
          </div>

          {/* Calendar */}
          <div className="flex justify-center border border-border rounded-xl overflow-hidden">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              locale={ptBR}
              disabled={(date) => date > today}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays size={12} />
            <span className="font-semibold text-card-foreground">
              {format(selectedDate, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </span>
            {totalForDay > 0 && (
              <span className="ml-auto bg-primary/10 text-primary px-2 py-0.5 rounded-full text-[10px] font-bold">
                {totalForDay} registros
              </span>
            )}
          </div>

          {/* Metrics Grid */}
          {loadingMetrics ? (
            <div className="flex justify-center py-8">
              <Loader2 className="animate-spin text-primary" size={24} />
            </div>
          ) : metrics && !editMetric ? (
            <div className="grid grid-cols-2 gap-2">
              {roleMetrics.map(k => (
                <button
                  key={k}
                  onClick={() => { setEditMetric(k); setEditQty(1); setEditMode("add"); }}
                  className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:bg-primary/5 hover:border-primary/30 transition-all text-left"
                >
                  <span className="text-base">{METRIC_ICONS[k]}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider truncate">
                      {METRIC_LABELS[k]}
                    </p>
                    <span className="text-lg font-black tabular-nums text-card-foreground">
                      {metrics[k] || 0}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : null}

          {/* Edit Single Metric */}
          {editMetric && metrics && (
            <div className="space-y-3 border border-border rounded-xl p-4 bg-secondary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{METRIC_ICONS[editMetric]}</span>
                  <span className="text-sm font-bold text-card-foreground">{METRIC_LABELS[editMetric]}</span>
                </div>
                <span className="text-xs text-muted-foreground">Atual: <span className="font-bold text-card-foreground">{metrics[editMetric]}</span></span>
              </div>

              {/* Mode toggle */}
              <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
                <button
                  onClick={() => { setEditMode("add"); setEditQty(1); }}
                  className={cn("flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1",
                    editMode === "add" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Plus size={10} /> Adicionar
                </button>
                <button
                  onClick={() => { setEditMode("delete"); setEditQty(1); }}
                  disabled={metrics[editMetric] === 0}
                  className={cn("flex-1 px-3 py-1.5 rounded-md text-[10px] font-bold transition-all flex items-center justify-center gap-1 disabled:opacity-30",
                    editMode === "delete" ? "bg-destructive text-white shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Trash2 size={10} /> Excluir
                </button>
              </div>

              {/* Qty picker */}
              <div className="flex items-center justify-center gap-3">
                <button onClick={() => setEditQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-lg font-bold text-card-foreground transition-all active:scale-95">−</button>
                <input
                  type="number" min={1} value={editQty}
                  max={editMode === "delete" ? metrics[editMetric] : undefined}
                  onChange={e => {
                    const v = Math.max(1, parseInt(e.target.value) || 1);
                    setEditQty(editMode === "delete" ? Math.min(v, metrics[editMetric] || 1) : v);
                  }}
                  className={cn(
                    "text-3xl font-black tabular-nums w-16 text-center bg-transparent border-b-2 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                    editMode === "add" ? "text-primary border-primary/30 focus:border-primary" : "text-destructive border-destructive/30 focus:border-destructive"
                  )}
                />
                <button
                  onClick={() => setEditQty(q => editMode === "delete" ? Math.min(metrics[editMetric] || 1, q + 1) : q + 1)}
                  className="w-10 h-10 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-lg font-bold text-card-foreground transition-all active:scale-95"
                >+</button>
              </div>

              {/* Presets */}
              <div className="flex gap-1.5 justify-center">
                {(editMode === "delete"
                  ? [1, 5, 10].filter(n => n <= (metrics[editMetric] || 0)).concat((metrics[editMetric] || 0) > 10 ? [metrics[editMetric]] : [])
                  : [1, 5, 10, 20]
                ).map(n => (
                  <button
                    key={n}
                    onClick={() => setEditQty(n)}
                    className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all",
                      editQty === n
                        ? editMode === "add" ? "bg-primary text-primary-foreground" : "bg-destructive text-white"
                        : editMode === "add" ? "bg-secondary/50 text-muted-foreground hover:bg-secondary" : "bg-destructive/10 text-destructive hover:bg-destructive/20"
                    )}
                  >
                    {editMode === "delete" && n === metrics[editMetric] ? `Todos (${n})` : n}
                  </button>
                ))}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => setEditMetric(null)}
                  className="flex-1 rounded-xl py-2.5 text-xs font-bold border border-border text-muted-foreground hover:bg-secondary transition-all"
                >
                  Voltar
                </button>
                <button
                  onClick={handleSaveMetric}
                  disabled={saving}
                  className={cn(
                    "flex-1 rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-1.5",
                    editMode === "add"
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-destructive text-white hover:bg-destructive/90"
                  )}
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : editMode === "add" ? <Plus size={13} /> : <Trash2 size={13} />}
                  {editMode === "add" ? `Adicionar +${editQty}` : `Excluir −${Math.min(editQty, metrics[editMetric] || 0)}`}
                </button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
