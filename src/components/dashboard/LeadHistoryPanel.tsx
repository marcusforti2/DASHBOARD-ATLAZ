import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { METRIC_LABELS } from "@/lib/db";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  ClipboardList, Loader2, CheckCircle2, X, PenLine, Trash2, ChevronDown, User,
} from "lucide-react";

type AuditFilterMode = "day" | "week" | "month";

const METRIC_SHORT: Record<string, string> = {
  conexoes: "Conexão", conexoes_aceitas: "Aceita", abordagens: "Abordagem",
  inmail: "InMail", follow_up: "Follow-up", numero: "Número",
  lig_agendada: "Lig.Agend", lig_realizada: "Lig.Real",
  reuniao_agendada: "Reun.Agend", reuniao_realizada: "Reun.Real",
};

export function LeadHistoryPanel({ teamMemberId }: { teamMemberId: string }) {
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
      .from("daily_metrics").select("*").eq("member_id", teamMemberId).eq("date", entry.date).maybeSingle();
    if (metric) {
      const val = (metric as any)[entry.metric_type] || 0;
      if (val > 0) {
        await supabase.from("daily_metrics").update({ [entry.metric_type]: val - 1 }).eq("id", metric.id);
      }
    }
  };

  const handleDelete = async (entry: any) => {
    setDeleting(entry.id);
    const { error } = await supabase.from("lead_entries").delete().eq("id", entry.id);
    if (error) { toast.error("Erro: " + error.message); setDeleting(null); return; }
    await decrementMetric(entry);
    setLeads(prev => prev.filter(l => l.id !== entry.id));
    queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });

    toast("Registro apagado", {
      description: `${entry.lead_name || METRIC_LABELS[entry.metric_type] || "Registro"} removido e métrica ajustada`,
      icon: <Trash2 size={14} />,
    });
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
    setBulkDeleting(true);
    const entriesToDelete = leads.filter(l => selectedIds.has(l.id));

    const { error } = await supabase.from("lead_entries").delete().in("id", Array.from(selectedIds));
    if (error) { toast.error("Erro: " + error.message); setBulkDeleting(false); return; }

    const decrements: Record<string, any> = {};
    entriesToDelete.forEach((e: any) => {
      if (!e.metric_type) return;
      const key = `${e.date}__${e.metric_type}`;
      if (!decrements[key]) decrements[key] = { date: e.date, metric_type: e.metric_type, count: 0 };
      decrements[key].count += 1;
    });

    for (const key of Object.keys(decrements)) {
      const { date, metric_type, count } = decrements[key];
      const { data: metric } = await supabase
        .from("daily_metrics").select("*").eq("member_id", teamMemberId).eq("date", date).maybeSingle();
      if (metric) {
        const val = (metric as any)[metric_type] || 0;
        await supabase.from("daily_metrics").update({ [metric_type]: Math.max(0, val - count) }).eq("id", metric.id);
      }
    }

    setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set());
    queryClient.invalidateQueries({ queryKey: ["daily-metrics"] });
    toast.success(`${entriesToDelete.length} registros apagados!`);
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
    } else {
      const ms = format(startOfMonth(refDate), "yyyy-MM-dd");
      const me = format(endOfMonth(refDate), "yyyy-MM-dd");
      result = result.filter(l => l.date >= ms && l.date <= me);
    }

    if (metricFilter !== "all") result = result.filter(l => l.metric_type === metricFilter);
    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(l => l.lead_name?.toLowerCase().includes(s) || l.whatsapp?.includes(s) || l.social_link?.toLowerCase().includes(s));
    }
    return result;
  }, [leads, filterMode, filterDate, searchTerm, metricFilter]);

  const metricCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredLeads.forEach(l => { const mt = l.metric_type || "unknown"; counts[mt] = (counts[mt] || 0) + 1; });
    return counts;
  }, [filteredLeads]);

  const availableMetrics = useMemo(() => {
    const set = new Set<string>();
    leads.forEach(l => { if (l.metric_type) set.add(l.metric_type); });
    return Array.from(set);
  }, [leads]);

  const todayCount = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    return leads.filter(l => l.date === today).length;
  }, [leads]);

  const PERIOD_FILTERS: { id: AuditFilterMode; label: string }[] = [
    { id: "day", label: "Dia" }, { id: "week", label: "Semana" }, { id: "month", label: "Mês" },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full p-4 flex items-center justify-between hover:bg-secondary/20 transition-colors">
        <div className="flex items-center gap-2">
          <ClipboardList size={14} className="text-primary" />
          <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">Meus Registros</h3>
          {todayCount > 0 && <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-md">{todayCount} hoje</span>}
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
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex bg-secondary/50 rounded-lg p-0.5">
                  {PERIOD_FILTERS.map(f => (
                    <button key={f.id} onClick={() => setFilterMode(f.id)} className={cn("px-2.5 py-1 text-[10px] font-semibold rounded-md transition-all", filterMode === f.id ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <input type="date" value={filterDate} onChange={e => setFilterDate(e.target.value)} className="text-[10px] bg-secondary border border-border rounded-lg px-2 py-1 text-secondary-foreground outline-none focus:ring-1 focus:ring-primary" />
                <input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Buscar..." className="flex-1 min-w-[80px] text-[10px] bg-secondary border border-border rounded-lg px-2.5 py-1 text-secondary-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary" />
              </div>

              {availableMetrics.length > 1 && (
                <div className="flex flex-wrap gap-1">
                  <button onClick={() => setMetricFilter("all")} className={cn("px-2 py-0.5 rounded-full text-[8px] font-bold transition-all", metricFilter === "all" ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                    Todos ({filteredLeads.length})
                  </button>
                  {availableMetrics.map(mt => (
                    <button key={mt} onClick={() => setMetricFilter(metricFilter === mt ? "all" : mt)} className={cn("px-2 py-0.5 rounded-full text-[8px] font-bold transition-all", metricFilter === mt ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground")}>
                      {METRIC_SHORT[mt] || mt} {metricCounts[mt] ? `(${metricCounts[mt]})` : ""}
                    </button>
                  ))}
                </div>
              )}

              {selectedIds.size > 0 && (
                <div className="flex items-center justify-between bg-destructive/10 border border-destructive/30 rounded-lg px-3 py-2">
                  <span className="text-[10px] font-bold text-destructive">{selectedIds.size} selecionado(s)</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setSelectedIds(new Set())} className="text-[9px] text-muted-foreground hover:text-foreground transition-colors">Limpar</button>
                    <button onClick={handleBulkDelete} disabled={bulkDeleting} className="flex items-center gap-1 text-[9px] font-bold text-destructive bg-destructive/15 hover:bg-destructive/25 px-2 py-1 rounded-md transition-colors disabled:opacity-50">
                      {bulkDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      Apagar selecionados
                    </button>
                  </div>
                </div>
              )}

              {filteredLeads.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-4">Nenhum registro neste período</p>
              ) : (
                <div className="rounded-lg border border-border overflow-hidden max-h-[400px] overflow-y-auto">
                  <div className="grid grid-cols-[24px_auto_1fr_60px_50px] gap-0 bg-secondary/40 border-b border-border sticky top-0 z-10">
                    <div className="flex items-center justify-center py-1.5">
                      <input type="checkbox" checked={selectedIds.size === filteredLeads.length && filteredLeads.length > 0} onChange={toggleSelectAll} className="w-3 h-3 rounded border-border accent-primary cursor-pointer" />
                    </div>
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border">Data</div>
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
                      <div key={entry.id} className={cn("grid grid-cols-[24px_auto_1fr_60px_50px] gap-0", isSelected ? "bg-primary/5" : idx % 2 === 0 ? "bg-card" : "bg-secondary/10", idx < filteredLeads.length - 1 && "border-b border-border/30")}>
                        <div className="flex items-center justify-center py-1.5">
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(entry.id)} className="w-3 h-3 rounded border-border accent-primary cursor-pointer" />
                        </div>
                        <div className="px-2 py-1.5 text-[9px] text-muted-foreground tabular-nums whitespace-nowrap border-l border-border/30">
                          <div>{format(new Date(entry.date + "T12:00:00"), "dd/MM")}</div>
                          {createdAt && <div className="text-[7px] text-muted-foreground/60">{format(createdAt, "HH:mm")}</div>}
                        </div>
                        <div className="px-2 py-1.5 text-[10px] text-card-foreground border-l border-border/30 truncate">
                          {isEditing ? (
                            <input value={editValues.lead_name || ""} onChange={e => setEditValues((p: any) => ({ ...p, lead_name: e.target.value }))} className="w-full bg-secondary border border-primary/30 rounded px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary" autoFocus />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <span className={cn("font-medium", isNumero ? "text-card-foreground" : "text-muted-foreground")}>{entry.lead_name || "—"}</span>
                              {isNumero && entry.whatsapp && <span className="text-[8px] text-muted-foreground">📱{entry.whatsapp}</span>}
                            </div>
                          )}
                        </div>
                        <div className="px-1 py-1.5 border-l border-border/30 flex items-center justify-center">
                          <span className="text-[7px] font-bold text-primary bg-primary/10 px-1 py-0.5 rounded truncate">{METRIC_SHORT[entry.metric_type] || entry.metric_type || "—"}</span>
                        </div>
                        <div className="flex items-center justify-center gap-0.5 border-l border-border/30">
                          {isEditing ? (
                            <>
                              <button onClick={() => saveEdit(entry)} className="p-0.5 rounded text-accent hover:bg-accent/10 transition-colors"><CheckCircle2 size={10} /></button>
                              <button onClick={() => { setEditingId(null); setEditValues({}); }} className="p-0.5 rounded text-muted-foreground hover:bg-secondary transition-colors"><X size={10} /></button>
                            </>
                          ) : (
                            <>
                              {isNumero && <button onClick={() => startEdit(entry)} className="p-0.5 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"><PenLine size={9} /></button>}
                              <button onClick={() => handleDelete(entry)} disabled={deleting === entry.id} className="p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50">
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
