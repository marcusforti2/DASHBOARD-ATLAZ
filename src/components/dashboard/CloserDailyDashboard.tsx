import { useState, useMemo, useEffect, useRef } from "react";
import { useMonths, useDailyMetrics, useWeeklyGoals, useMonthlyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, METRIC_LABELS, sumMetrics, getWorkingDaysCount, getMemberRoles, isDualRole } from "@/lib/db";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Target, TrendingUp, CheckCircle2, Loader2, Plus, Flame,
  Zap, Trophy, Calendar, ArrowUpRight, Save, ClipboardList,
  X, UserPlus, User, PenLine, Trash2, ChevronDown
} from "lucide-react";


const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

// Icons for each metric to make it more visual
const METRIC_ICONS: Record<string, string> = {
  conexoes: "🔗", conexoes_aceitas: "✅", abordagens: "💬", inmail: "📩", follow_up: "🔄",
  numero: "📞", lig_agendada: "📅", lig_realizada: "☎️", reuniao_agendada: "🗓️", reuniao_realizada: "🤝",
};

interface CloserDailyDashboardProps {
  teamMemberId: string;
  memberName: string;
  memberRole?: string;
}

export function CloserDailyDashboard({ teamMemberId, memberName, memberRole = "sdr" }: CloserDailyDashboardProps) {
  const roles = (memberRole || "sdr").split(",").map(r => r.trim());
  const hasDualRole = roles.includes("sdr") && roles.includes("closer");
  const [activeRoleTab, setActiveRoleTab] = useState<"sdr" | "closer">(roles.includes("sdr") ? "sdr" : "closer");

  const roleMetrics = hasDualRole
    ? (activeRoleTab === "closer" ? CLOSER_METRIC_KEYS as readonly string[] : SDR_METRIC_KEYS as readonly string[])
    : (roles.includes("closer")
      ? (CLOSER_METRIC_KEYS as readonly string[])
      : (SDR_METRIC_KEYS as readonly string[]));
  const { data: months } = useMonths();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);

  const { data: dailyMetrics, isLoading: metricsLoading } = useDailyMetrics(currentMonth?.id);
  const { data: weeklyGoals } = useWeeklyGoals(currentMonth?.id, teamMemberId);
  const { data: monthlyGoal } = useMonthlyGoals(currentMonth?.id, teamMemberId);

  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");

  // Find current week goal
  const currentWeekGoal = useMemo(() => {
    if (!weeklyGoals?.length) return null;
    return weeklyGoals.find(w => {
      if (!w.start_date || !w.end_date) return false;
      return todayStr >= w.start_date && todayStr <= w.end_date;
    }) || weeklyGoals[0];
  }, [weeklyGoals, todayStr]);

  // Daily goal = weekly / working days
  const dailyGoals = useMemo(() => {
    if (!currentWeekGoal) return null;
    const wdCount = getWorkingDaysCount((currentWeekGoal as any).working_days);
    return roleMetrics.reduce((acc, k) => {
      acc[k] = Math.ceil((currentWeekGoal as any)[k] / wdCount);
      return acc;
    }, {} as Record<string, number>);
  }, [currentWeekGoal, roleMetrics]);

  // Today's metrics
  const todayMetrics = useMemo(() => {
    if (!dailyMetrics) return null;
    const entries = dailyMetrics.filter(d => d.date === todayStr && d.member_id === teamMemberId);
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, todayStr, teamMemberId]);

  // Week metrics
  const weekMetrics = useMemo(() => {
    if (!dailyMetrics || !currentWeekGoal?.start_date || !currentWeekGoal?.end_date) return null;
    const entries = dailyMetrics.filter(d =>
      d.member_id === teamMemberId &&
      d.date >= currentWeekGoal.start_date! &&
      d.date <= currentWeekGoal.end_date!
    );
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, currentWeekGoal, teamMemberId]);

  // Month metrics
  const monthMetrics = useMemo(() => {
    if (!dailyMetrics) return null;
    const entries = dailyMetrics.filter(d => d.member_id === teamMemberId);
    if (!entries.length) return null;
    return sumMetrics(entries);
  }, [dailyMetrics, teamMemberId]);

  // Goals and actuals based on viewMode
  const currentGoals = useMemo(() => {
    if (viewMode === "day") return dailyGoals;
    if (viewMode === "week" && currentWeekGoal) {
      return roleMetrics.reduce((acc, k) => {
        acc[k] = (currentWeekGoal as any)[k] || 0;
        return acc;
      }, {} as Record<string, number>);
    }
    if (viewMode === "month" && monthlyGoal) {
      return roleMetrics.reduce((acc, k) => {
        acc[k] = (monthlyGoal as any)[k] || 0;
        return acc;
      }, {} as Record<string, number>);
    }
    return null;
  }, [viewMode, dailyGoals, currentWeekGoal, monthlyGoal, roleMetrics]);

  const currentActuals = useMemo(() => {
    if (viewMode === "day") return todayMetrics;
    if (viewMode === "week") return weekMetrics;
    return monthMetrics;
  }, [viewMode, todayMetrics, weekMetrics, monthMetrics]);

  // Overall completion %
  const completion = useMemo(() => {
    if (!currentGoals || !currentActuals) return 0;
    const totalGoal = roleMetrics.reduce((s, k) => s + (currentGoals[k] || 0), 0);
    const totalActual = roleMetrics.reduce((s, k) => s + (currentActuals[k] || 0), 0);
    return totalGoal > 0 ? Math.min(Math.round((totalActual / totalGoal) * 100), 100) : 0;
  }, [currentGoals, currentActuals, roleMetrics]);

  const achievedCount = useMemo(() => {
    if (!currentGoals || !currentActuals) return 0;
    return roleMetrics.filter(k => currentGoals[k] > 0 && (currentActuals[k] || 0) >= currentGoals[k]).length;
  }, [currentGoals, currentActuals, roleMetrics]);

  const VIEW_LABELS: Record<string, string> = { day: "Dia", week: "Semana", month: "Mês" };

  const periodLabel = useMemo(() => {
    if (viewMode === "day") return format(today, "EEEE, dd 'de' MMMM", { locale: ptBR });
    if (viewMode === "week" && currentWeekGoal?.start_date && currentWeekGoal?.end_date) {
      return `Semana ${currentWeekGoal.week_number} — ${format(new Date(currentWeekGoal.start_date + "T12:00:00"), "dd/MM")} a ${format(new Date(currentWeekGoal.end_date + "T12:00:00"), "dd/MM")}`;
    }
    if (viewMode === "month" && currentMonth) return currentMonth.label;
    return "";
  }, [viewMode, today, currentWeekGoal, currentMonth]);

  if (metricsLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  const hasDataToday = !!todayMetrics;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Hero Header */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-secondary/30 p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
        <div className="relative flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">
              {format(today, "EEEE, dd 'de' MMMM", { locale: ptBR })}
            </p>
            <h2 className="text-xl font-black text-card-foreground mt-1">
              Olá, {memberName.split(" ")[0]} 👋
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {hasDataToday
                ? `${achievedCount} de ${roleMetrics.filter(k => (currentGoals?.[k] || 0) > 0).length} metas batidas ${viewMode === "day" ? "hoje" : viewMode === "week" ? "na semana" : "no mês"}`
                : "Nenhum dado inserido hoje — comece agora!"
              }
            </p>
          </div>

          {/* Circular progress */}
          <div className="relative w-20 h-20 shrink-0">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
              <circle
                cx="40" cy="40" r="34" fill="none"
                stroke={completion >= 100 ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - completion / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-black tabular-nums", completion >= 100 ? "text-accent" : "text-primary")}>
                {completion}%
              </span>
              {completion >= 100 && <Flame size={12} className="text-accent" />}
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <DataEntryDialog
          teamMemberId={teamMemberId}
          todayStr={todayStr}
          currentMonthId={currentMonth?.id}
          todayMetrics={todayMetrics}
          roleMetrics={roleMetrics}
          onSaved={() => queryClient.invalidateQueries({ queryKey: ["daily-metrics", currentMonth?.id] })}
        />
      </div>

      {/* Role Tab for Dual Role */}
      {hasDualRole && (
        <div className="flex items-center gap-1 bg-secondary/50 rounded-xl p-1">
          <button
            onClick={() => setActiveRoleTab("sdr")}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeRoleTab === "sdr"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Zap size={12} />
            SDR · Prospecção
          </button>
          <button
            onClick={() => setActiveRoleTab("closer")}
            className={cn(
              "flex-1 px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5",
              activeRoleTab === "closer"
                ? "bg-[hsl(280,65%,60%)] text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <Trophy size={12} />
            Closer · Fechamento
          </button>
        </div>
      )}

      {/* Period Filter + Metric Cards */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap size={14} className="text-primary" />
            <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Progresso</h3>
          </div>
          <div className="flex bg-secondary/60 rounded-lg p-0.5 gap-0.5">
            {(["day", "week", "month"] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-[10px] font-bold transition-all",
                  viewMode === mode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        {/* Period info */}
        <p className="text-[9px] text-muted-foreground mb-2.5 flex items-center gap-1">
          <Calendar size={10} />
          {periodLabel}
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {roleMetrics.map(k => {
            const goal = currentGoals?.[k] || 0;
            const actual = currentActuals?.[k] || 0;
            const pct = goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0;
            const achieved = goal > 0 && actual >= goal;

            return (
              <div
                key={k}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  achieved
                    ? "border-accent/30 bg-accent/5"
                    : "border-border bg-card hover:bg-card/80"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-base">{METRIC_ICONS[k]}</span>
                  <div className="flex items-center gap-1">
                    {viewMode === "day" && actual > 0 && (
                      <QuickDecrementButton
                        metricKey={k}
                        teamMemberId={teamMemberId}
                        todayStr={todayStr}
                        onDecremented={() => queryClient.invalidateQueries({ queryKey: ["daily-metrics", currentMonth?.id] })}
                      />
                    )}
                    {achieved && <CheckCircle2 size={12} className="text-accent" />}
                  </div>
                </div>
                <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
                  {METRIC_LABELS[k]}
                </p>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className={cn("text-xl font-black tabular-nums", achieved ? "text-accent" : "text-card-foreground")}>
                    {actual}
                  </span>
                  <span className="text-[10px] text-muted-foreground">/{goal}</span>
                </div>
                <Progress
                  value={pct}
                  className={cn("h-1 mt-2", achieved ? "[&>div]:bg-accent" : "")}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Lead History */}
      <LeadHistoryPanel teamMemberId={teamMemberId} />
    </div>
  );
}

/* ========== Quick Decrement Button on metric cards ========== */

function QuickDecrementButton({
  metricKey,
  teamMemberId,
  todayStr,
  onDecremented,
}: {
  metricKey: string;
  teamMemberId: string;
  todayStr: string;
  onDecremented: () => void;
}) {
  const [loading, setLoading] = useState(false);

  const handleDecrement = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover 1 ${METRIC_LABELS[metricKey]} de hoje?`)) return;
    setLoading(true);

    // Decrement daily_metrics
    const { data: metric } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", todayStr)
      .maybeSingle();

    if (metric) {
      const val = (metric as any)[metricKey] || 0;
      if (val > 0) {
        await supabase.from("daily_metrics")
          .update({ [metricKey]: val - 1 })
          .eq("id", metric.id);
      }
    }

    // Also remove latest lead_entry of this type for today
    const { data: entries } = await supabase
      .from("lead_entries")
      .select("id")
      .eq("member_id", teamMemberId)
      .eq("date", todayStr)
      .eq("metric_type", metricKey)
      .order("created_at", { ascending: false })
      .limit(1);

    if (entries?.length) {
      await supabase.from("lead_entries").delete().eq("id", entries[0].id);
    }

    toast.success(`-1 ${METRIC_LABELS[metricKey]} removido`);
    onDecremented();
    setLoading(false);
  };

  return (
    <button
      onClick={handleDecrement}
      disabled={loading}
      className="p-0.5 rounded text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
      title={`Remover 1 ${METRIC_LABELS[metricKey]}`}
    >
      {loading ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
    </button>
  );
}

/* ========== Audit / History Panel ========== */

type AuditFilterMode = "day" | "week" | "month";

function LeadHistoryPanel({ teamMemberId }: { teamMemberId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<AuditFilterMode>("day");
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");
  const [metricFilter, setMetricFilter] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<any>({});
  const [deleting, setDeleting] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const queryClient = useQueryClient();

  const METRIC_SHORT: Record<string, string> = {
    conexoes: "Conexão", conexoes_aceitas: "Aceita", abordagens: "Abordagem",
    inmail: "InMail", follow_up: "Follow-up", numero: "Número",
    lig_agendada: "Lig.Agend", lig_realizada: "Lig.Real",
    reuniao_agendada: "Reun.Agend", reuniao_realizada: "Reun.Real",
  };

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_entries")
      .select("*")
      .eq("member_id", teamMemberId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) setLeads(data);
    setLoading(false);
  };

  useEffect(() => { fetchLeads(); }, [teamMemberId]);

  const decrementMetric = async (entry: any) => {
    if (!entry.metric_type) return;
    const { data: metric } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", entry.date)
      .maybeSingle();
    if (metric) {
      const val = (metric as any)[entry.metric_type] || 0;
      if (val > 0) {
        await supabase.from("daily_metrics")
          .update({ [entry.metric_type]: val - 1 })
          .eq("id", metric.id);
      }
    }
  };

  const handleDelete = async (entry: any) => {
    if (!confirm(`Apagar registro "${entry.lead_name}"? A métrica será ajustada.`)) return;
    setDeleting(entry.id);
    const { error } = await supabase.from("lead_entries").delete().eq("id", entry.id);
    if (error) { toast.error("Erro: " + error.message); setDeleting(null); return; }
    await decrementMetric(entry);
    setLeads(prev => prev.filter(l => l.id !== entry.id));
    queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
    toast.success("Registro apagado e métrica ajustada!");
    setDeleting(null);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredLeads.map((l: any) => l.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Apagar ${selectedIds.size} registro(s)? As métricas serão ajustadas.`)) return;
    setBulkDeleting(true);
    const entriesToDelete = leads.filter(l => selectedIds.has(l.id));
    
    // Delete all from lead_entries
    const { error } = await supabase.from("lead_entries").delete().in("id", Array.from(selectedIds));
    if (error) { toast.error("Erro: " + error.message); setBulkDeleting(false); return; }
    
    // Decrement metrics grouped by date+metric_type
    const decrements: Record<string, Record<string, number>> = {};
    entriesToDelete.forEach((e: any) => {
      if (!e.metric_type) return;
      const key = `${e.date}__${e.metric_type}`;
      if (!decrements[key]) decrements[key] = { date: e.date, metric_type: e.metric_type, count: 0 } as any;
      (decrements[key] as any).count = ((decrements[key] as any).count || 0) + 1;
    });
    
    for (const key of Object.keys(decrements)) {
      const { date, metric_type, count } = decrements[key] as any;
      const { data: metric } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("member_id", teamMemberId)
        .eq("date", date)
        .maybeSingle();
      if (metric) {
        const val = (metric as any)[metric_type] || 0;
        await supabase.from("daily_metrics")
          .update({ [metric_type]: Math.max(0, val - count) })
          .eq("id", metric.id);
      }
    }
    
    setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
    toast.success(`${entriesToDelete.length} registros apagados e métricas ajustadas!`);
    setBulkDeleting(false);
  };

  const startEdit = (entry: any) => {
    setEditingId(entry.id);
    setEditValues({ lead_name: entry.lead_name, whatsapp: entry.whatsapp || "", social_link: entry.social_link || "" });
  };

  const saveEdit = async (entry: any) => {
    const { error } = await supabase.from("lead_entries").update({
      lead_name: editValues.lead_name?.trim() || entry.lead_name,
      whatsapp: editValues.whatsapp?.trim() || "",
      social_link: editValues.social_link?.trim() || "",
    }).eq("id", entry.id);
    if (error) { toast.error("Erro: " + error.message); return; }
    setLeads(prev => prev.map(l => l.id === entry.id ? { ...l, ...editValues } : l));
    toast.success("Registro atualizado!");
    setEditingId(null);
    setEditValues({});
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    const refDate = new Date(filterDate + "T12:00:00");

    if (filterMode === "day") {
      result = result.filter(l => l.date === filterDate);
    } else if (filterMode === "week") {
      const ws = format(startOfWeek(refDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
      const we = format(endOfWeek(refDate, { weekStartsOn: 0 }), "yyyy-MM-dd");
      result = result.filter(l => l.date >= ws && l.date <= we);
    } else if (filterMode === "month") {
      const ms = format(startOfMonth(refDate), "yyyy-MM-dd");
      const me = format(endOfMonth(refDate), "yyyy-MM-dd");
      result = result.filter(l => l.date >= ms && l.date <= me);
    }

    if (metricFilter !== "all") {
      result = result.filter(l => l.metric_type === metricFilter);
    }

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(l =>
        l.lead_name?.toLowerCase().includes(s) ||
        l.whatsapp?.includes(s) ||
        l.social_link?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [leads, filterMode, filterDate, searchTerm, metricFilter]);

  // Metric counts for badges
  const metricCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => {
      const mt = l.metric_type || "unknown";
      counts[mt] = (counts[mt] || 0) + 1;
    });
    return counts;
  }, [filteredLeads]);

  // Unique metrics present
  const availableMetrics = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.metric_type) set.add(l.metric_type); });
    return Array.from(set);
  }, [leads]);

  const PERIOD_FILTERS: { id: AuditFilterMode; label: string }[] = [
    { id: "day", label: "Dia" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mês" },
  ];

  const todayCount = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return leads.filter(l => l.date === today).length;
  }, [leads]);

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Header - always visible */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-primary" />
          <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">Meus Registros</h3>
          {todayCount > 0 && (
            <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">{todayCount} hoje</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-muted-foreground">{leads.length} total</span>
          <ChevronDown size={14} className={cn("text-muted-foreground transition-transform", isOpen && "rotate-180")} />
        </div>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-primary" /></div>
          ) : (
            <>
              {/* Period + search filters */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-secondary/50 rounded-lg p-0.5">
                  {PERIOD_FILTERS.map(f => (
                    <button
                      key={f.id}
                      onClick={() => setFilterMode(f.id)}
                      className={cn(
                        "px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all",
                        filterMode === f.id
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={filterDate}
                  onChange={e => setFilterDate(e.target.value)}
                  className="text-[10px] bg-secondary border border-border rounded-lg px-2 py-1 text-secondary-foreground outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar..."
                  className="flex-1 min-w-[80px] text-[10px] bg-secondary border border-border rounded-lg px-2.5 py-1 text-secondary-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Metric type filter chips */}
              {availableMetrics.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setMetricFilter("all")}
                    className={cn(
                      "px-2 py-0.5 rounded-full text-[8px] font-bold transition-all",
                      metricFilter === "all"
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Todos ({filteredLeads.length})
                  </button>
                  {availableMetrics.map(mt => (
                    <button
                      key={mt}
                      onClick={() => setMetricFilter(metricFilter === mt ? "all" : mt)}
                      className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-bold transition-all",
                        metricFilter === mt
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {METRIC_SHORT[mt] || mt} {metricCounts[mt] ? `(${metricCounts[mt]})` : ""}
                    </button>
                  ))}
                </div>
              )}

              {/* Bulk delete bar */}
              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold text-destructive">
                    {selectedIds.size} selecionado(s)
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setSelectedIds(new Set())}
                      className="text-[9px] text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Limpar
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      disabled={bulkDeleting}
                      className="flex items-center gap-1 text-[9px] font-bold text-destructive bg-destructive/15 hover:bg-destructive/25 px-2 py-1 rounded-md transition-colors disabled:opacity-50"
                    >
                      {bulkDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      Apagar selecionados
                    </button>
                  </div>
                </div>
              )}

              {/* Entries list */}
              {filteredLeads.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum registro neste período</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                  {/* Table header */}
                  <div className="grid grid-cols-[24px_auto_1fr_60px_50px] gap-0 bg-secondary/40 border-b border-border sticky top-0 z-10">
                    <div className="flex items-center justify-center py-1.5">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0}
                        onChange={toggleSelectAll}
                        className="w-3 h-3 rounded border-border accent-primary cursor-pointer"
                      />
                    </div>
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">Data / Hora</div>
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">Registro</div>
                    <div className="px-1 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center">Métrica</div>
                    <div className="px-1 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center">Ações</div>
                  </div>

                  {filteredLeads.map((entry: any, idx: number) => {
                    const isEditing = editingId === entry.id;
                    const isNumero = entry.metric_type === "numero";
                    const isSelected = selectedIds.has(entry.id);
                    const createdAt = entry.created_at ? new Date(entry.created_at) : null;

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "grid grid-cols-[24px_auto_1fr_60px_50px] gap-0",
                          isSelected ? "bg-primary/5" : idx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                          idx < filteredLeads.length - 1 && "border-b border-border/30"
                        )}
                      >
                        {/* Checkbox */}
                        <div className="flex items-center justify-center py-1.5">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(entry.id)}
                            className="w-3 h-3 rounded border-border accent-primary cursor-pointer"
                          />
                        </div>

                        {/* Date + Time */}
                        <div className="px-2 py-1.5 text-[9px] text-muted-foreground tabular-nums whitespace-nowrap border-l border-border/30">
                          <div>{format(new Date(entry.date + "T12:00:00"), "dd/MM")}</div>
                          {createdAt && (
                            <div className="text-[7px] text-muted-foreground/60">
                              {format(createdAt, "HH:mm")}
                            </div>
                          )}
                        </div>

                        {/* Name / detail */}
                        <div className="px-2 py-1.5 text-[10px] text-card-foreground border-l border-border/30 truncate">
                          {isEditing ? (
                            <input
                              value={editValues.lead_name || ""}
                              onChange={e => setEditValues((p: any) => ({ ...p, lead_name: e.target.value }))}
                              className="w-full bg-secondary border border-primary/30 rounded px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={cn("font-medium", isNumero ? "text-card-foreground" : "text-muted-foreground")}>
                                {entry.lead_name || "—"}
                              </span>
                              {isNumero && entry.whatsapp && (
                                <span className="text-[8px] text-muted-foreground">📱{entry.whatsapp}</span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Metric badge */}
                        <div className="px-1 py-1.5 border-l border-border/30 flex items-center justify-center">
                          <span className="text-[7px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded truncate">
                            {METRIC_SHORT[entry.metric_type] || entry.metric_type || "—"}
                          </span>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-center gap-0.5 border-l border-border/30">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(entry)} className="p-0.5 rounded text-accent hover:bg-accent/10 transition-colors" title="Salvar">
                                <CheckCircle2 size={10} />
                              </button>
                              <button onClick={() => { setEditingId(null); setEditValues({}); }} className="p-0.5 rounded text-muted-foreground hover:bg-secondary transition-colors" title="Cancelar">
                                <X size={10} />
                              </button>
                            </>
                          ) : (
                            <>
                              {isNumero && (
                                <button onClick={() => startEdit(entry)} className="p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors" title="Editar">
                                  <PenLine size={9} />
                                </button>
                              )}
                              <button
                                onClick={() => handleDelete(entry)}
                                disabled={deleting === entry.id}
                                className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                title="Apagar"
                              >
                                {deleting === entry.id ? <Loader2 size={9} className="animate-spin" /> : <Trash2 size={9} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
type EntryStep = "select-metric" | "quantity-picker" | "lead-sheet" | "uploading";

function DataEntryDialog({
  teamMemberId,
  todayStr,
  currentMonthId,
  todayMetrics,
  roleMetrics,
  onSaved,
}: {
  teamMemberId: string;
  todayStr: string;
  currentMonthId?: string;
  todayMetrics: Record<string, number> | null;
  roleMetrics: readonly string[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<EntryStep>("select-metric");
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [entrySource, setEntrySource] = useState<"manual">("manual");
  const [existingLeads, setExistingLeads] = useState<any[]>([]);
  const [quickQty, setQuickQty] = useState(1);
  const [rows, setRows] = useState<{ lead_name: string; whatsapp: string; social_link: string; fromExisting?: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showExistingPicker, setShowExistingPicker] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load existing leads when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep("select-metric");
    setSelectedMetric(null);
    setEntrySource("manual");
    setRows([]);
    setShowExistingPicker(false);
    setUploading(false);
    supabase
      .from("lead_entries")
      .select("*")
      .eq("member_id", teamMemberId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const seen = new Set<string>();
          const unique = data.filter((l: any) => {
            const key = l.lead_name?.toLowerCase().trim();
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setExistingLeads(unique);
        }
      });
  }, [open, teamMemberId]);

  const handleSelectMetric = (metric: string) => {
    setSelectedMetric(metric);
    // "numero" requires lead sheet / audit trail
    if (metric === "numero") {
      setEntrySource("manual");
      setRows([{ lead_name: "", whatsapp: "", social_link: "" }]);
      setStep("lead-sheet");
      return;
    }
    // All other metrics: show quantity picker
    setQuickQty(1);
    setStep("quantity-picker");
  };

  const handleSaveQuickMetric = async () => {
    if (!currentMonthId || !selectedMetric || quickQty < 1) return;
    setSaving(true);

    const dateObj = new Date(todayStr + "T12:00:00");
    const dayName = DAY_NAMES[dateObj.getDay()];

    // 1. Create audit trail entries (lead_entries)
    const auditInserts = Array.from({ length: quickQty }, () => ({
      member_id: teamMemberId,
      date: todayStr,
      lead_name: METRIC_LABELS[selectedMetric] || selectedMetric,
      whatsapp: "",
      social_link: "",
      metric_type: selectedMetric,
      source: "manual",
    }));
    await supabase.from("lead_entries").insert(auditInserts);

    // 2. Update daily_metrics
    const { data: existing } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", todayStr)
      .eq("month_id", currentMonthId)
      .maybeSingle();

    if (existing) {
      const currentVal = (existing as any)[selectedMetric] || 0;
      await supabase.from("daily_metrics")
        .update({ [selectedMetric]: currentVal + quickQty })
        .eq("id", existing.id);
    } else {
      const payload: any = {
        member_id: teamMemberId,
        month_id: currentMonthId,
        date: todayStr,
        day_of_week: dayName,
      };
      roleMetrics.forEach(k => { payload[k] = 0; });
      payload[selectedMetric] = quickQty;
      await supabase.from("daily_metrics").insert(payload);
    }

    toast.success(`+${quickQty} ${METRIC_LABELS[selectedMetric]} registrado(s)! 🚀`);
    onSaved();
    setSaving(false);
    setSelectedMetric(null);
    setStep("select-metric");
  };


  const updateRow = (idx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, { lead_name: "", whatsapp: "", social_link: "" }]);

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const addExistingLead = (lead: any) => {
    setRows(prev => [...prev, {
      lead_name: lead.lead_name,
      whatsapp: lead.whatsapp || "",
      social_link: lead.social_link || "",
      fromExisting: true,
    }]);
    setShowExistingPicker(false);
    setExistingSearch("");
  };

  const filteredExisting = existingSearch.trim()
    ? existingLeads.filter(l =>
        l.lead_name?.toLowerCase().includes(existingSearch.toLowerCase()) ||
        l.whatsapp?.includes(existingSearch)
      )
    : existingLeads.slice(0, 20);

  const handleSave = async () => {
    if (!currentMonthId || !selectedMetric) return;
    setSaving(true);

    const validRows = rows.filter(r => r.lead_name.trim());
    const count = validRows.length;

    // Save leads
    if (count > 0) {
      const inserts = validRows.map(r => ({
        member_id: teamMemberId,
        date: todayStr,
        lead_name: r.lead_name.trim(),
        whatsapp: r.whatsapp.trim(),
        social_link: r.social_link.trim(),
        metric_type: selectedMetric,
        source: entrySource,
      }));
      await supabase.from("lead_entries").insert(inserts);
    }

    // Update daily_metrics: increment the selected metric by count
    const dateObj = new Date(todayStr + "T12:00:00");
    const dayName = DAY_NAMES[dateObj.getDay()];

    const { data: existing } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", todayStr)
      .eq("month_id", currentMonthId)
      .maybeSingle();

    if (existing) {
      const currentVal = (existing as any)[selectedMetric] || 0;
      await supabase.from("daily_metrics")
        .update({ [selectedMetric]: currentVal + count })
        .eq("id", existing.id);
    } else {
      const payload: any = {
        member_id: teamMemberId,
        month_id: currentMonthId,
        date: todayStr,
        day_of_week: dayName,
      };
      // Zero all metrics first
      roleMetrics.forEach(k => { payload[k] = 0; });
      payload[selectedMetric] = count;
      await supabase.from("daily_metrics").insert(payload);
    }

    toast.success(`+${count} ${METRIC_LABELS[selectedMetric]} registrado(s)! 🚀`);
    onSaved();
    setSaving(false);
    setStep("select-metric");
    setSelectedMetric(null);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className={cn(
          "mt-4 w-full rounded-xl py-3.5 text-sm font-bold flex items-center justify-center gap-2 transition-all",
          todayMetrics
            ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 border border-border"
            : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_-4px_hsl(var(--primary)/0.4)]"
        )}>
          {todayMetrics ? (
            <>
              <CheckCircle2 size={16} /> Atualizar dados de hoje
            </>
          ) : (
            <>
              <Plus size={16} /> Cadastrar dados do dia
            </>
          )}
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">

        {step === "select-metric" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                <Calendar size={14} className="text-primary" />
                O que você quer registrar?
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                {format(new Date(todayStr + "T12:00:00"), "EEEE, dd 'de' MMMM", { locale: ptBR })}
              </p>
            </DialogHeader>


            <div className="grid grid-cols-2 gap-2.5">
              {roleMetrics.map(k => {
                const currentVal = todayMetrics?.[k] || 0;
                return (
                  <button
                    key={k}
                    onClick={() => handleSelectMetric(k)}
                    disabled={saving && selectedMetric === k}
                    className="group relative rounded-xl border border-border bg-secondary/30 hover:bg-primary/10 hover:border-primary/40 p-4 text-left transition-all disabled:opacity-50"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-lg">{METRIC_ICONS[k]}</span>
                      {currentVal > 0 && (
                        <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">
                          {currentVal} hoje
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-bold text-card-foreground">{METRIC_LABELS[k]}</p>
                    {k === "numero" ? (
                      <span className="absolute top-3 right-3 text-[7px] font-bold text-chart-4 bg-chart-4/10 px-1 py-0.5 rounded">📋</span>
                    ) : saving && selectedMetric === k ? (
                      <Loader2 size={12} className="absolute top-3 right-3 text-primary animate-spin" />
                    ) : (
                      <span className="absolute top-3 right-3 text-[8px] font-bold text-muted-foreground/40 group-hover:text-primary transition-colors">+1</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Today's activity log */}
            <TodayActivityLog
              teamMemberId={teamMemberId}
              todayStr={todayStr}
              currentMonthId={currentMonthId}
              onChanged={onSaved}
            />
          </>
        ) : step === "quantity-picker" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                <span className="text-lg">{METRIC_ICONS[selectedMetric || ""]}</span>
                {METRIC_LABELS[selectedMetric || ""]}
              </DialogTitle>
              <p className="text-[10px] text-muted-foreground mt-1">
                Quantos você quer somar ao dia de hoje?
              </p>
            </DialogHeader>

            <div className="flex flex-col items-center gap-5 py-4">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setQuickQty(q => Math.max(1, q - 1))}
                  className="w-12 h-12 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xl font-bold text-card-foreground transition-all active:scale-95"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={quickQty}
                  onChange={e => setQuickQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="text-4xl font-black tabular-nums text-primary w-20 text-center bg-transparent border-b-2 border-primary/30 focus:border-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <button
                  onClick={() => setQuickQty(q => q + 1)}
                  className="w-12 h-12 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-xl font-bold text-card-foreground transition-all active:scale-95"
                >
                  +
                </button>
              </div>

              {/* Quick presets */}
              <div className="flex gap-2">
                {(selectedMetric === "follow_up" ? [70, 100, 140, 200] : [1, 5, 10, 20]).map(n => (
                  <button
                    key={n}
                    onClick={() => setQuickQty(n)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                      quickQty === n
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => { setStep("select-metric"); setSelectedMetric(null); }}
                className="flex-1 rounded-xl py-3 text-xs font-bold border border-border bg-secondary/30 text-muted-foreground hover:bg-secondary/50 transition-all"
              >
                Voltar
              </button>
              <button
                onClick={handleSaveQuickMetric}
                disabled={saving}
                className="flex-1 rounded-xl py-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Salvar +{quickQty}
              </button>
            </div>
          </>
        ) : step === "uploading" ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 size={20} className="animate-spin text-primary" />
            <p className="text-sm font-bold text-card-foreground">Processando...</p>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                <span className="text-base">{METRIC_ICONS[selectedMetric!]}</span>
                {METRIC_LABELS[selectedMetric!]}
                <span className="text-[10px] font-normal text-muted-foreground ml-auto">
                  {rows.filter(r => r.lead_name.trim()).length} lead(s)
                </span>
              </DialogTitle>
            </DialogHeader>

            {/* Spreadsheet */}
            <div className="rounded-xl border border-border overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_1fr_28px] gap-0 bg-secondary/60 border-b border-border">
                <div className="px-2.5 py-2 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Nome do Lead</div>
                <div className="px-2.5 py-2 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">WhatsApp</div>
                <div className="px-2.5 py-2 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">LinkedIn/Insta</div>
                <div />
              </div>

              {rows.map((row, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "grid grid-cols-[1fr_1fr_1fr_28px] gap-0 transition-colors",
                    idx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                    idx < rows.length - 1 && "border-b border-border/30",
                    row.fromExisting && "bg-accent/5"
                  )}
                >
                  <input
                    value={row.lead_name}
                    onChange={e => updateRow(idx, "lead_name", e.target.value)}
                    placeholder="João Silva"
                    className="px-2.5 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-primary/5 transition-colors"
                    autoFocus={idx === rows.length - 1 && entrySource === "manual"}
                  />
                  <input
                    value={row.whatsapp}
                    onChange={e => updateRow(idx, "whatsapp", e.target.value)}
                    placeholder="(11) 99999-9999"
                    className="px-2.5 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none border-l border-border/30 focus:bg-primary/5 transition-colors"
                  />
                  <input
                    value={row.social_link}
                    onChange={e => updateRow(idx, "social_link", e.target.value)}
                    placeholder="linkedin.com/in/..."
                    className="px-2.5 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none border-l border-border/30 focus:bg-primary/5 transition-colors"
                  />
                  <button
                    onClick={() => removeRow(idx)}
                    disabled={rows.length <= 1}
                    className="flex items-center justify-center text-muted-foreground/40 hover:text-destructive disabled:opacity-0 transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={addRow}
                className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-all animate-pulse hover:animate-none px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/15 border border-primary/20"
              >
                <Plus size={12} /> Adicionar Linha
              </button>

              {existingLeads.length > 0 && (
                <button
                  onClick={() => setShowExistingPicker(!showExistingPicker)}
                  className="flex items-center gap-1.5 text-[10px] font-bold text-accent hover:text-accent/80 transition-all px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/15 border border-accent/20"
                >
                  <UserPlus size={12} /> Lead já cadastrado
                </button>
              )}
            </div>

            {/* Existing lead picker */}
            {showExistingPicker && (
              <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
                <input
                  value={existingSearch}
                  onChange={e => setExistingSearch(e.target.value)}
                  placeholder="Buscar lead existente..."
                  className="w-full text-[10px] bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-secondary-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-accent"
                  autoFocus
                />
                <div className="max-h-[150px] overflow-y-auto space-y-0.5">
                  {filteredExisting.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum lead encontrado</p>
                  ) : (
                    filteredExisting.map((lead: any) => (
                      <button
                        key={lead.id}
                        onClick={() => addExistingLead(lead)}
                        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-accent/10 transition-colors group"
                      >
                        <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                          <User size={10} className="text-accent" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[10px] font-semibold text-card-foreground truncate">{lead.lead_name}</p>
                          <p className="text-[8px] text-muted-foreground truncate">
                            {lead.whatsapp || lead.social_link || "Sem contato"}
                          </p>
                        </div>
                        <Plus size={10} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Save / Back */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => {
                  setStep("select-metric");
                  setSelectedMetric(null);
                }}
                className="px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || rows.filter(r => r.lead_name.trim()).length === 0}
                className="flex-1 rounded-xl bg-primary py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Salvar {rows.filter(r => r.lead_name.trim()).length} lead(s)
              </button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
