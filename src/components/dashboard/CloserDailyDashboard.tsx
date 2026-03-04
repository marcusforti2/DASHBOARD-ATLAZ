import { useState, useMemo, useEffect, useRef } from "react";
import { useMonths, useDailyMetrics, useWeeklyGoals } from "@/hooks/use-metrics";
import { METRIC_KEYS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS, METRIC_LABELS, sumMetrics, getWorkingDaysCount } from "@/lib/db";
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
  X, UserPlus, User, Upload, FileSpreadsheet, PenLine
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
  const roleMetrics = memberRole === "closer"
    ? (CLOSER_METRIC_KEYS as readonly string[])
    : (SDR_METRIC_KEYS as readonly string[]);
  const { data: months } = useMonths();
  const queryClient = useQueryClient();
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const currentMonth = months?.find(m => m.year === today.getFullYear() && m.month === today.getMonth() + 1);

  const { data: dailyMetrics, isLoading: metricsLoading } = useDailyMetrics(currentMonth?.id);
  const { data: weeklyGoals } = useWeeklyGoals(currentMonth?.id, teamMemberId);

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

  // Overall day completion %
  const dayCompletion = useMemo(() => {
    if (!dailyGoals || !todayMetrics) return 0;
    const totalGoal = roleMetrics.reduce((s, k) => s + (dailyGoals[k] || 0), 0);
    const totalActual = roleMetrics.reduce((s, k) => s + (todayMetrics[k] || 0), 0);
    return totalGoal > 0 ? Math.min(Math.round((totalActual / totalGoal) * 100), 100) : 0;
  }, [dailyGoals, todayMetrics, roleMetrics]);

  const achievedCount = useMemo(() => {
    if (!dailyGoals || !todayMetrics) return 0;
    return roleMetrics.filter(k => dailyGoals[k] > 0 && (todayMetrics[k] || 0) >= dailyGoals[k]).length;
  }, [dailyGoals, todayMetrics, roleMetrics]);

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
                ? `${achievedCount} de ${roleMetrics.filter(k => (dailyGoals?.[k] || 0) > 0).length} metas batidas hoje`
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
                stroke={dayCompletion >= 100 ? "hsl(var(--accent))" : "hsl(var(--primary))"}
                strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 34}`}
                strokeDashoffset={`${2 * Math.PI * 34 * (1 - dayCompletion / 100)}`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-lg font-black tabular-nums", dayCompletion >= 100 ? "text-accent" : "text-primary")}>
                {dayCompletion}%
              </span>
              {dayCompletion >= 100 && <Flame size={12} className="text-accent" />}
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

      {/* Daily Metric Cards */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Zap size={14} className="text-primary" />
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Progresso do Dia</h3>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
          {roleMetrics.map(k => {
            const goal = dailyGoals?.[k] || 0;
            const actual = todayMetrics?.[k] || 0;
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
                  {achieved && <CheckCircle2 size={12} className="text-accent" />}
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

      {/* Weekly Summary */}
      {currentWeekGoal && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-chart-4" />
              <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">
                Semana {currentWeekGoal.week_number}
              </h3>
            </div>
            {currentWeekGoal.start_date && currentWeekGoal.end_date && (
              <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                <Calendar size={10} />
                {format(new Date(currentWeekGoal.start_date + "T12:00:00"), "dd/MM")} — {format(new Date(currentWeekGoal.end_date + "T12:00:00"), "dd/MM")}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
            {roleMetrics.map(k => {
              const goal = (currentWeekGoal as any)[k] || 0;
              const actual = weekMetrics?.[k] || 0;
              const pct = goal > 0 ? Math.round((actual / goal) * 100) : 0;
              const achieved = pct >= 100;

              return (
                <div key={k} className="rounded-lg bg-secondary/40 p-2.5 text-center">
                  <p className="text-[8px] font-semibold text-muted-foreground uppercase tracking-wider">{METRIC_LABELS[k]}</p>
                  <p className={cn("text-sm font-black tabular-nums mt-1", achieved ? "text-accent" : "text-card-foreground")}>
                    {actual}<span className="text-[9px] text-muted-foreground font-normal">/{goal}</span>
                  </p>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    {achieved ? (
                      <CheckCircle2 size={9} className="text-accent" />
                    ) : pct > 0 ? (
                      <ArrowUpRight size={9} className="text-primary" />
                    ) : null}
                    <span className={cn("text-[9px] font-bold", achieved ? "text-accent" : pct >= 50 ? "text-primary" : "text-muted-foreground")}>
                      {pct}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Lead History */}
      <LeadHistoryPanel teamMemberId={teamMemberId} />
    </div>
  );
}

/* ========== Lead History Panel ========== */

type LeadFilterMode = "day" | "week" | "month";

function LeadHistoryPanel({ teamMemberId }: { teamMemberId: string }) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<LeadFilterMode>("day");
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
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
    fetchLeads();
  }, [teamMemberId]);

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

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(l =>
        l.lead_name?.toLowerCase().includes(s) ||
        l.whatsapp?.includes(s) ||
        l.social_link?.toLowerCase().includes(s)
      );
    }
    return result;
  }, [leads, filterMode, filterDate, searchTerm]);

  const FILTERS: { id: LeadFilterMode; label: string }[] = [
    { id: "day", label: "Dia" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mês" },
  ];

  if (loading) return null;
  if (leads.length === 0) return null;

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-primary" />
          <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">Meus Leads</h3>
          <span className="text-[9px] text-muted-foreground">({filteredLeads.length})</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-secondary/50 rounded-lg p-0.5">
          {FILTERS.map(f => (
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

      {/* Lead list */}
      {filteredLeads.length === 0 ? (
        <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum lead neste período</p>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden max-h-[300px] overflow-y-auto">
          <div className="grid grid-cols-[1fr_1fr_1fr_50px] gap-0 bg-secondary/40 border-b border-border sticky top-0 z-10">
            <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider">Nome</div>
            <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">WhatsApp</div>
            <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">Social</div>
            <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center">Fonte</div>
          </div>
          {filteredLeads.map((entry: any, idx: number) => (
            <div
              key={entry.id}
              className={cn(
                "grid grid-cols-[1fr_1fr_1fr_50px] gap-0",
                idx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                idx < filteredLeads.length - 1 && "border-b border-border/30"
              )}
            >
              <div className="px-2.5 py-2 text-[10px] text-card-foreground font-medium truncate">
                <span className="text-[8px] text-muted-foreground mr-1">{format(new Date(entry.date + "T12:00:00"), "dd/MM")}</span>
                {entry.lead_name || "—"}
              </div>
              <div className="px-2.5 py-2 text-[10px] text-card-foreground font-mono border-l border-border/30 truncate">
                {entry.whatsapp ? (
                  <a href={`https://wa.me/${entry.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                    {entry.whatsapp}
                  </a>
                ) : "—"}
              </div>
              <div className="px-2.5 py-2 text-[10px] text-card-foreground border-l border-border/30 truncate">
                {entry.social_link ? (
                  <a href={entry.social_link.startsWith("http") ? entry.social_link : `https://${entry.social_link}`}
                    target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    {entry.social_link}
                  </a>
                ) : "—"}
              </div>
              <div className="px-2.5 py-2 text-[10px] border-l border-border/30 text-center">
                {entry.source === "dripify" ? (
                  <span className="text-[7px] font-bold text-chart-4 bg-chart-4/10 px-1 py-0.5 rounded">DRIP</span>
                ) : (
                  <span className="text-[7px] font-bold text-muted-foreground bg-secondary px-1 py-0.5 rounded">MAN</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ========== Data Entry Dialog ========== */

type EntryStep = "select-metric" | "source-choice" | "lead-sheet" | "uploading" | "dripify-preview";

const DRIPIFY_METRICS = ["conexoes", "conexoes_aceitas", "abordagens"];

type DripifyDayData = { date: string; metrics: Record<string, number> };

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
  const [entrySource, setEntrySource] = useState<"manual" | "dripify">("manual");
  const [existingLeads, setExistingLeads] = useState<any[]>([]);
  const [rows, setRows] = useState<{ lead_name: string; whatsapp: string; social_link: string; fromExisting?: boolean }[]>([]);
  const [saving, setSaving] = useState(false);
  const [showExistingPicker, setShowExistingPicker] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dripifyData, setDripifyData] = useState<DripifyDayData[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dripifyFileRef = useRef<HTMLInputElement>(null);

  // Load existing leads when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep("select-metric");
    setSelectedMetric(null);
    setEntrySource("manual");
    setRows([]);
    setShowExistingPicker(false);
    setUploading(false);
    setDripifyData([]);
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
    setEntrySource("manual");
    setRows([{ lead_name: "", whatsapp: "", social_link: "" }]);
    setStep("lead-sheet");
  };

  const handleDripifyUpload = () => {
    dripifyFileRef.current?.click();
  };

  const processDripifyFile = async (file: File) => {
    setStep("uploading");
    setUploading(true);
    setDragging(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-dripify`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: formData,
        }
      );

      const result = await res.json();

      if (result.daily_data && result.daily_data.length > 0) {
        setDripifyData(result.daily_data);
        setStep("dripify-preview");
        toast.success(`${result.daily_data.length} dias encontrados no relatório! 📊`);
      } else {
        toast.error(result.error || "Nenhum dado encontrado no arquivo");
        setStep("select-metric");
      }
    } catch (err) {
      console.error("Erro no upload:", err);
      toast.error("Erro ao processar arquivo. Tente novamente.");
      setStep("select-metric");
    } finally {
      setUploading(false);
      if (dripifyFileRef.current) dripifyFileRef.current.value = "";
    }
  };

  const handleDripifyFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processDripifyFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processDripifyFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragging(false);
  };

  const handleSaveDripify = async () => {
    if (!currentMonthId || dripifyData.length === 0) return;
    setSaving(true);

    const DAY_NAMES_MAP: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

    try {
      for (const dayData of dripifyData) {
        const dateObj = new Date(dayData.date + "T12:00:00");
        const dayName = DAY_NAMES_MAP[dateObj.getDay()];

        const { data: existing } = await supabase
          .from("daily_metrics")
          .select("*")
          .eq("member_id", teamMemberId)
          .eq("date", dayData.date)
          .eq("month_id", currentMonthId)
          .maybeSingle();

        if (existing) {
          const updates: Record<string, number> = {};
          for (const [metric, val] of Object.entries(dayData.metrics)) {
            updates[metric] = ((existing as any)[metric] || 0) + val;
          }
          await supabase.from("daily_metrics")
            .update(updates)
            .eq("id", existing.id);
        } else {
          const payload: any = {
            member_id: teamMemberId,
            month_id: currentMonthId,
            date: dayData.date,
            day_of_week: dayName,
          };
          roleMetrics.forEach(k => { payload[k] = 0; });
          for (const [metric, val] of Object.entries(dayData.metrics)) {
            payload[metric] = val;
          }
          await supabase.from("daily_metrics").insert(payload);
        }

        // Small delay between batches
        await new Promise(r => setTimeout(r, 50));
      }

      const totalMetrics = dripifyData.reduce((sum, d) => {
        return sum + Object.values(d.metrics).reduce((s, v) => s + v, 0);
      }, 0);

      toast.success(`${totalMetrics} métricas importadas de ${dripifyData.length} dias! 🚀`);
      onSaved();
      setSaving(false);
      setOpen(false);
    } catch (err) {
      console.error("Erro ao salvar Dripify:", err);
      toast.error("Erro ao salvar dados. Tente novamente.");
      setSaving(false);
    }
  };

  // Legacy per-metric file upload (kept for manual source choice)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedMetric) return;
    // Not used anymore for Dripify - redirect to dripify flow
    if (dripifyFileRef.current) dripifyFileRef.current.value = "";
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
        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.xlsx,.xls,.csv,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleFileUpload}
        />
        <input
          ref={dripifyFileRef}
          type="file"
          accept=".csv,.pdf,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={handleDripifyFile}
        />

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

            {/* Dripify Import Drop Zone */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={handleDripifyUpload}
              className={cn(
                "w-full rounded-xl border-2 border-dashed p-4 flex flex-col items-center gap-2 transition-all cursor-pointer",
                dragging
                  ? "border-chart-4 bg-chart-4/15 scale-[1.02]"
                  : "border-chart-4/30 hover:border-chart-4/60 bg-chart-4/5 hover:bg-chart-4/10"
              )}
            >
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-colors",
                dragging ? "bg-chart-4/25" : "bg-chart-4/15"
              )}>
                <Upload size={20} className={cn("transition-transform", dragging ? "text-chart-4 -translate-y-1" : "text-chart-4")} />
              </div>
              <div className="text-center">
                <p className="text-xs font-bold text-card-foreground">
                  {dragging ? "Solte o arquivo aqui!" : "📊 Importar Relatório Dripify"}
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5">
                  {dragging ? "CSV, PDF ou imagem" : "Arraste o arquivo ou clique para selecionar"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 py-1">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[9px] text-muted-foreground">ou registre manualmente</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              {roleMetrics.map(k => {
                const currentVal = todayMetrics?.[k] || 0;
                return (
                  <button
                    key={k}
                    onClick={() => handleSelectMetric(k)}
                    className="group relative rounded-xl border border-border bg-secondary/30 hover:bg-primary/10 hover:border-primary/40 p-4 text-left transition-all"
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
                    <ArrowUpRight size={12} className="absolute top-3 right-3 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                  </button>
                );
              })}
            </div>
          </>
        ) : step === "dripify-preview" ? (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                <FileSpreadsheet size={14} className="text-chart-4" />
                Dados do Dripify
                <span className="text-[9px] font-bold text-chart-4 bg-chart-4/10 px-1.5 py-0.5 rounded">
                  {dripifyData.length} dias
                </span>
              </DialogTitle>
            </DialogHeader>

            <div className="rounded-lg border border-border overflow-hidden max-h-[300px] overflow-y-auto">
              <div className="grid grid-cols-[90px_1fr_1fr_1fr] gap-0 bg-secondary/40 border-b border-border sticky top-0 z-10">
                <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase">Data</div>
                <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase border-l border-border text-center">Conexões</div>
                <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase border-l border-border text-center">Aceitas</div>
                <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase border-l border-border text-center">Abordagens</div>
              </div>
              {dripifyData.map((day, idx) => (
                <div
                  key={day.date}
                  className={cn(
                    "grid grid-cols-[90px_1fr_1fr_1fr] gap-0",
                    idx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                    idx < dripifyData.length - 1 && "border-b border-border/30"
                  )}
                >
                  <div className="px-2 py-2 text-[10px] text-card-foreground font-medium">
                    {format(new Date(day.date + "T12:00:00"), "dd/MM (EEE)", { locale: ptBR })}
                  </div>
                  <div className="px-2 py-2 text-[11px] font-bold text-card-foreground text-center border-l border-border/30 tabular-nums">
                    {day.metrics.conexoes || 0}
                  </div>
                  <div className="px-2 py-2 text-[11px] font-bold text-card-foreground text-center border-l border-border/30 tabular-nums">
                    {day.metrics.conexoes_aceitas || 0}
                  </div>
                  <div className="px-2 py-2 text-[11px] font-bold text-card-foreground text-center border-l border-border/30 tabular-nums">
                    {day.metrics.abordagens || 0}
                  </div>
                </div>
              ))}
              {/* Totals row */}
              <div className="grid grid-cols-[90px_1fr_1fr_1fr] gap-0 bg-primary/5 border-t border-border font-bold">
                <div className="px-2 py-2 text-[10px] text-primary uppercase">Total</div>
                <div className="px-2 py-2 text-[11px] text-primary text-center border-l border-border/30 tabular-nums">
                  {dripifyData.reduce((s, d) => s + (d.metrics.conexoes || 0), 0)}
                </div>
                <div className="px-2 py-2 text-[11px] text-primary text-center border-l border-border/30 tabular-nums">
                  {dripifyData.reduce((s, d) => s + (d.metrics.conexoes_aceitas || 0), 0)}
                </div>
                <div className="px-2 py-2 text-[11px] text-primary text-center border-l border-border/30 tabular-nums">
                  {dripifyData.reduce((s, d) => s + (d.metrics.abordagens || 0), 0)}
                </div>
              </div>
            </div>

            <div className="flex gap-2 mt-1">
              <button
                onClick={() => { setStep("select-metric"); setDripifyData([]); }}
                className="px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                ← Voltar
              </button>
              <button
                onClick={handleSaveDripify}
                disabled={saving}
                className="flex-1 rounded-xl bg-chart-4 py-2.5 text-xs font-bold text-white hover:bg-chart-4/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Importar {dripifyData.length} dias
              </button>
            </div>
          </>
        ) : step === "uploading" ? (
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-chart-4/10 flex items-center justify-center animate-pulse">
              <FileSpreadsheet size={28} className="text-chart-4" />
            </div>
            <div className="text-center">
              <p className="text-sm font-bold text-card-foreground">Processando relatório...</p>
              <p className="text-[10px] text-muted-foreground mt-1">Lendo dados do Dripify</p>
            </div>
            <Loader2 size={20} className="animate-spin text-chart-4" />
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
                <span className="text-base">{METRIC_ICONS[selectedMetric!]}</span>
                {METRIC_LABELS[selectedMetric!]}
                {entrySource === "dripify" && (
                  <span className="text-[8px] font-bold text-chart-4 bg-chart-4/10 px-1.5 py-0.5 rounded-md">
                    DRIPIFY
                  </span>
                )}
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
                  if (DRIPIFY_METRICS.includes(selectedMetric!)) {
                    setStep("source-choice");
                  } else {
                    setStep("select-metric");
                    setSelectedMetric(null);
                  }
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
