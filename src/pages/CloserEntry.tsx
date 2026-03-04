import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useMonths, useTeamMembers } from "@/hooks/use-metrics";
import { METRIC_KEYS, METRIC_LABELS, SDR_METRIC_KEYS, CLOSER_METRIC_KEYS } from "@/lib/db";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Save, CheckCircle2, Calendar } from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

interface CloserEntryProps {
  teamMemberId: string;
  memberName: string;
}

export default function CloserEntry({ teamMemberId, memberName }: CloserEntryProps) {
  const { data: months } = useMonths();
  const { data: members } = useTeamMembers();
  const [selectedDate, setSelectedDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [values, setValues] = useState<Record<string, number>>(() =>
    METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>)
  );
  const [loading, setLoading] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [fetchingExisting, setFetchingExisting] = useState(false);

  // Determine role-specific metrics
  const currentMember = members?.find(m => m.id === teamMemberId);
  const isCloserRole = currentMember?.member_role === "closer";
  const visibleKeys: readonly string[] = isCloserRole ? CLOSER_METRIC_KEYS : SDR_METRIC_KEYS;
  const roleLabel = isCloserRole ? "Closer" : "SDR";

  // Find month for selected date
  const dateObj = new Date(selectedDate + "T12:00:00");
  const selectedMonth = months?.find(m => m.year === dateObj.getFullYear() && m.month === dateObj.getMonth() + 1);

  // Load existing entry when date changes
  useEffect(() => {
    if (!selectedMonth) return;
    setFetchingExisting(true);
    supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", teamMemberId)
      .eq("date", selectedDate)
      .eq("month_id", selectedMonth.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setExistingId(data.id);
          const vals: Record<string, number> = {};
          METRIC_KEYS.forEach(k => { vals[k] = (data as any)[k] || 0; });
          setValues(vals);
        } else {
          setExistingId(null);
          setValues(METRIC_KEYS.reduce((acc, k) => ({ ...acc, [k]: 0 }), {} as Record<string, number>));
        }
        setFetchingExisting(false);
      });
  }, [selectedDate, selectedMonth, teamMemberId]);

  const handleSave = async () => {
    if (!selectedMonth) {
      toast.error("Mês não encontrado para esta data. Peça ao gestor para criar o mês.");
      return;
    }
    setLoading(true);
    const dayName = DAY_NAMES[dateObj.getDay()];

    const payload = {
      ...values,
      member_id: teamMemberId,
      month_id: selectedMonth.id,
      date: selectedDate,
      day_of_week: dayName,
    };

    let error;
    if (existingId) {
      ({ error } = await supabase.from("daily_metrics").update(payload).eq("id", existingId));
    } else {
      ({ error } = await supabase.from("daily_metrics").insert(payload));
    }

    if (error) {
      toast.error("Erro ao salvar: " + error.message);
    } else {
      toast.success(existingId ? "Dados atualizados!" : "Dados salvos!");
      if (!existingId) {
        const { data } = await supabase.from("daily_metrics").select("id").eq("member_id", teamMemberId).eq("date", selectedDate).single();
        if (data) setExistingId(data.id);
      }
    }
    setLoading(false);
  };

  return (
    <div className="max-w-lg mx-auto space-y-6">
      {/* Date Picker */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar size={16} className="text-primary" />
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Data</h3>
        </div>
        <input
          type="date"
          value={selectedDate}
          onChange={e => setSelectedDate(e.target.value)}
          className="w-full rounded-lg border border-border bg-secondary px-3 py-2.5 text-sm text-secondary-foreground focus:ring-1 focus:ring-primary outline-none"
        />
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{format(dateObj, "EEEE, dd 'de' MMMM", { locale: ptBR })}</span>
          {existingId && (
            <span className="flex items-center gap-1 text-accent">
              <CheckCircle2 size={12} /> Já preenchido
            </span>
          )}
        </div>
        {!selectedMonth && (
          <p className="text-[10px] text-destructive">Mês não cadastrado. Peça ao gestor.</p>
        )}
      </div>

      {/* Metrics */}
      <div className={`rounded-xl border bg-card p-5 space-y-4 ${isCloserRole ? "border-[hsl(280,30%,18%)] border-l-[3px] border-l-[hsl(280,65%,60%)]" : "border-border border-l-[3px] border-l-primary"}`}>
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-semibold text-card-foreground uppercase tracking-wider">Métricas do Dia</h3>
          <span className={`text-[8px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${isCloserRole ? "text-[hsl(280,65%,80%)] bg-[hsl(280,65%,60%/0.15)] border-[hsl(280,65%,60%/0.3)]" : "text-primary-foreground bg-primary/20 border-primary/30"}`}>
            {roleLabel}
          </span>
        </div>
        {fetchingExisting ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {visibleKeys.map(k => (
              <div key={k}>
                <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                  {METRIC_LABELS[k]}
                </label>
                <input
                  type="number"
                  min={0}
                  value={values[k]}
                  onChange={e => setValues(v => ({ ...v, [k]: parseInt(e.target.value) || 0 }))}
                  className="mt-1 w-full rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-secondary-foreground tabular-nums focus:ring-1 focus:ring-primary outline-none"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleSave}
        disabled={loading || !selectedMonth}
        className="w-full rounded-lg bg-primary py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {loading ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        {existingId ? "Atualizar Dados" : "Salvar Dados"}
      </button>
    </div>
  );
}
