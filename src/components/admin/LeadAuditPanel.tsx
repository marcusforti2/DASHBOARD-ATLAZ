import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Search, User, Phone, Link, Loader2, Trash2, Pencil, Check, X, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { METRIC_LABELS } from "@/lib/db";

interface LeadEntry {
  id: string;
  date: string;
  lead_name: string;
  whatsapp: string;
  social_link: string;
  metric_type: string;
  source: string;
  created_at: string;
}

type FilterMode = "day" | "week" | "month" | "all";

interface LeadAuditPanelProps {
  memberId: string;
  memberName: string;
}

export function LeadAuditPanel({ memberId, memberName }: LeadAuditPanelProps) {
  const [leads, setLeads] = useState<LeadEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState<FilterMode>("week");
  const [filterDate, setFilterDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [searchTerm, setSearchTerm] = useState("");
  const [deleting, setDeleting] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<LeadEntry>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  useEffect(() => {
    fetchLeads();
  }, [memberId]);

  const fetchLeads = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("lead_entries")
      .select("*")
      .eq("member_id", memberId)
      .order("date", { ascending: false })
      .order("created_at", { ascending: false });
    if (!error && data) setLeads(data as LeadEntry[]);
    setLoading(false);
  };

  const decrementMetric = async (entry: LeadEntry) => {
    if (!entry.metric_type) return;
    const { data: metric } = await supabase
      .from("daily_metrics")
      .select("*")
      .eq("member_id", memberId)
      .eq("date", entry.date)
      .maybeSingle();

    if (metric) {
      const currentVal = (metric as any)[entry.metric_type] || 0;
      if (currentVal > 0) {
        await supabase.from("daily_metrics")
          .update({ [entry.metric_type]: currentVal - 1 })
          .eq("id", metric.id);
      }
    }
  };

  const handleDelete = async (entry: LeadEntry) => {
    if (!confirm(`Apagar lead "${entry.lead_name}"? A métrica associada será decrementada.`)) return;
    setDeleting(entry.id);

    const { error } = await supabase.from("lead_entries").delete().eq("id", entry.id);
    if (error) {
      toast.error("Erro ao apagar: " + error.message);
      setDeleting(null);
      return;
    }

    await decrementMetric(entry);
    setLeads(prev => prev.filter(l => l.id !== entry.id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(entry.id); return n; });
    toast.success("Lead apagado e métrica ajustada!");
    setDeleting(null);
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Apagar ${selectedIds.size} lead(s) selecionados? As métricas associadas serão decrementadas.`)) return;
    setBulkDeleting(true);

    const entriesToDelete = leads.filter(l => selectedIds.has(l.id));

    // Delete all selected
    const { error } = await supabase
      .from("lead_entries")
      .delete()
      .in("id", Array.from(selectedIds));

    if (error) {
      toast.error("Erro ao apagar em massa: " + error.message);
      setBulkDeleting(false);
      return;
    }

    // Decrement metrics - group by date+metric_type to batch
    const decrements: Record<string, { date: string; metric_type: string; count: number }> = {};
    for (const entry of entriesToDelete) {
      if (!entry.metric_type) continue;
      const key = `${entry.date}__${entry.metric_type}`;
      if (!decrements[key]) decrements[key] = { date: entry.date, metric_type: entry.metric_type, count: 0 };
      decrements[key].count++;
    }

    for (const { date, metric_type, count } of Object.values(decrements)) {
      const { data: metric } = await supabase
        .from("daily_metrics")
        .select("*")
        .eq("member_id", memberId)
        .eq("date", date)
        .maybeSingle();

      if (metric) {
        const currentVal = (metric as any)[metric_type] || 0;
        await supabase.from("daily_metrics")
          .update({ [metric_type]: Math.max(0, currentVal - count) })
          .eq("id", metric.id);
      }
    }

    setLeads(prev => prev.filter(l => !selectedIds.has(l.id)));
    setSelectedIds(new Set());
    toast.success(`${entriesToDelete.length} leads apagados e métricas ajustadas!`);
    setBulkDeleting(false);
  };

  const startEdit = (entry: LeadEntry) => {
    setEditingId(entry.id);
    setEditValues({ lead_name: entry.lead_name, whatsapp: entry.whatsapp, social_link: entry.social_link });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async (entry: LeadEntry) => {
    const { error } = await supabase
      .from("lead_entries")
      .update({
        lead_name: editValues.lead_name?.trim() || entry.lead_name,
        whatsapp: editValues.whatsapp?.trim() || "",
        social_link: editValues.social_link?.trim() || "",
      })
      .eq("id", entry.id);

    if (error) {
      toast.error("Erro ao editar: " + error.message);
      return;
    }

    setLeads(prev => prev.map(l => l.id === entry.id ? {
      ...l,
      lead_name: editValues.lead_name?.trim() || l.lead_name,
      whatsapp: editValues.whatsapp?.trim() || "",
      social_link: editValues.social_link?.trim() || "",
    } : l));
    toast.success("Lead atualizado!");
    cancelEdit();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = (entries: LeadEntry[]) => {
    const allSelected = entries.every(e => selectedIds.has(e.id));
    setSelectedIds(prev => {
      const n = new Set(prev);
      entries.forEach(e => { if (allSelected) n.delete(e.id); else n.add(e.id); });
      return n;
    });
  };

  const filteredLeads = useMemo(() => {
    let result = leads;
    const refDate = new Date(filterDate + "T12:00:00");

    if (filterMode === "day") {
      result = result.filter(l => l.date === filterDate);
    } else if (filterMode === "week") {
      const ws = format(startOfWeek(refDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      const we = format(endOfWeek(refDate, { weekStartsOn: 1 }), "yyyy-MM-dd");
      result = result.filter(l => l.date >= ws && l.date <= we);
    } else if (filterMode === "month") {
      const ms = format(startOfMonth(refDate), "yyyy-MM-dd");
      const me = format(endOfMonth(refDate), "yyyy-MM-dd");
      result = result.filter(l => l.date >= ms && l.date <= me);
    }

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase();
      result = result.filter(l =>
        l.lead_name.toLowerCase().includes(s) ||
        l.whatsapp.includes(s) ||
        l.social_link.toLowerCase().includes(s)
      );
    }

    return result;
  }, [leads, filterMode, filterDate, searchTerm]);

  // Group by date
  const groupedByDate = useMemo(() => {
    const groups: Record<string, LeadEntry[]> = {};
    filteredLeads.forEach(l => {
      if (!groups[l.date]) groups[l.date] = [];
      groups[l.date].push(l);
    });
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [filteredLeads]);

  const FILTERS: { id: FilterMode; label: string }[] = [
    { id: "day", label: "Dia" },
    { id: "week", label: "Semana" },
    { id: "month", label: "Mês" },
    { id: "all", label: "Tudo" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 size={16} className="animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Search size={14} className="text-primary" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Trilha de Leads — {memberName}
        </span>
        <span className="text-[9px] text-muted-foreground ml-auto">
          {leads.length} total · {filteredLeads.length} exibidos
        </span>
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

        {filterMode !== "all" && (
          <input
            type="date"
            value={filterDate}
            onChange={e => setFilterDate(e.target.value)}
            className="text-[10px] bg-secondary border border-border rounded-lg px-2 py-1 text-secondary-foreground outline-none focus:ring-1 focus:ring-primary"
          />
        )}

        <div className="flex-1 min-w-[120px]">
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar lead..."
            className="w-full text-[10px] bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-secondary-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2">
          <AlertTriangle size={12} className="text-destructive" />
          <span className="text-[10px] font-bold text-destructive">
            {selectedIds.size} selecionado(s)
          </span>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-[10px] font-bold hover:bg-destructive/90 transition-colors disabled:opacity-50"
          >
            {bulkDeleting ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
            Apagar selecionados
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="px-2 py-1.5 rounded-lg bg-secondary text-secondary-foreground text-[10px] font-semibold hover:bg-secondary/80 transition-colors"
          >
            Cancelar
          </button>
        </div>
      )}

      {/* Lead table */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground">Nenhum lead registrado neste período</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {groupedByDate.map(([date, entries]) => {
            const allSelected = entries.every(e => selectedIds.has(e.id));
            const someSelected = entries.some(e => selectedIds.has(e.id));

            return (
              <div key={date}>
                <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
                  <button
                    onClick={() => toggleSelectAll(entries)}
                    className="p-0.5 rounded hover:bg-secondary transition-colors"
                    title="Selecionar todos do dia"
                  >
                    {allSelected ? (
                      <CheckSquare size={12} className="text-primary" />
                    ) : someSelected ? (
                      <CheckSquare size={12} className="text-primary/40" />
                    ) : (
                      <Square size={12} className="text-muted-foreground/40" />
                    )}
                  </button>
                  <Calendar size={10} className="text-primary" />
                  <span className="text-[10px] font-bold text-primary">
                    {format(new Date(date + "T12:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })}
                  </span>
                  <span className="text-[9px] text-muted-foreground">({entries.length} leads)</span>
                </div>

                <div className="rounded-lg border border-border overflow-hidden">
                  <div className="grid grid-cols-[24px_1fr_1fr_1fr_55px_55px] gap-0 bg-secondary/40 border-b border-border">
                    <div />
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <User size={9} /> Nome
                    </div>
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-l border-border">
                      <Phone size={9} /> WhatsApp
                    </div>
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-l border-border">
                      <Link size={9} /> Social
                    </div>
                    <div className="px-2 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center">
                      Fonte
                    </div>
                    <div className="px-1 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center">
                      Ações
                    </div>
                  </div>

                  {entries.map((entry, idx) => {
                    const isEditing = editingId === entry.id;
                    const isSelected = selectedIds.has(entry.id);

                    return (
                      <div
                        key={entry.id}
                        className={cn(
                          "grid grid-cols-[24px_1fr_1fr_1fr_55px_55px] gap-0",
                          isSelected ? "bg-primary/5" : idx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                          idx < entries.length - 1 && "border-b border-border/30"
                        )}
                      >
                        {/* Checkbox */}
                        <div className="flex items-center justify-center">
                          <button onClick={() => toggleSelect(entry.id)} className="p-0.5">
                            {isSelected ? (
                              <CheckSquare size={11} className="text-primary" />
                            ) : (
                              <Square size={11} className="text-muted-foreground/30 hover:text-muted-foreground" />
                            )}
                          </button>
                        </div>

                        {/* Name */}
                        <div className="px-2 py-1.5 text-[10px] text-card-foreground font-medium truncate">
                          {isEditing ? (
                            <input
                              value={editValues.lead_name || ""}
                              onChange={e => setEditValues(prev => ({ ...prev, lead_name: e.target.value }))}
                              className="w-full bg-secondary border border-primary/30 rounded px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary"
                              autoFocus
                            />
                          ) : (
                            entry.lead_name || "—"
                          )}
                        </div>

                        {/* WhatsApp */}
                        <div className="px-2 py-1.5 text-[10px] text-card-foreground font-mono border-l border-border/30 truncate">
                          {isEditing ? (
                            <input
                              value={editValues.whatsapp || ""}
                              onChange={e => setEditValues(prev => ({ ...prev, whatsapp: e.target.value }))}
                              className="w-full bg-secondary border border-primary/30 rounded px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary"
                              placeholder="(11) 99999-9999"
                            />
                          ) : entry.whatsapp ? (
                            <a href={`https://wa.me/${entry.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                              className="text-accent hover:underline">
                              {entry.whatsapp}
                            </a>
                          ) : "—"}
                        </div>

                        {/* Social */}
                        <div className="px-2 py-1.5 text-[10px] text-card-foreground border-l border-border/30 truncate">
                          {isEditing ? (
                            <input
                              value={editValues.social_link || ""}
                              onChange={e => setEditValues(prev => ({ ...prev, social_link: e.target.value }))}
                              className="w-full bg-secondary border border-primary/30 rounded px-1.5 py-0.5 text-[10px] outline-none focus:ring-1 focus:ring-primary"
                              placeholder="linkedin.com/in/..."
                            />
                          ) : entry.social_link ? (
                            <a href={entry.social_link.startsWith("http") ? entry.social_link : `https://${entry.social_link}`}
                              target="_blank" rel="noreferrer" className="text-primary hover:underline">
                              {entry.social_link}
                            </a>
                          ) : "—"}
                        </div>

                        {/* Source badge */}
                        <div className="px-1 py-1.5 text-[10px] border-l border-border/30 flex items-center justify-center">
                          {entry.source === "dripify" ? (
                            <span className="text-[7px] font-bold text-chart-4 bg-chart-4/10 px-1.5 py-0.5 rounded">DRIP</span>
                          ) : (
                            <span className="text-[7px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">MAN</span>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-center gap-0.5 border-l border-border/30">
                          {isEditing ? (
                            <>
                              <button
                                onClick={() => saveEdit(entry)}
                                className="p-1 rounded text-accent hover:bg-accent/10 transition-colors"
                                title="Salvar"
                              >
                                <Check size={10} />
                              </button>
                              <button
                                onClick={cancelEdit}
                                className="p-1 rounded text-muted-foreground hover:bg-secondary transition-colors"
                                title="Cancelar"
                              >
                                <X size={10} />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => startEdit(entry)}
                                className="p-1 rounded text-muted-foreground/40 hover:text-primary hover:bg-primary/10 transition-colors"
                                title="Editar"
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                onClick={() => handleDelete(entry)}
                                disabled={deleting === entry.id}
                                className="p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                                title="Apagar"
                              >
                                {deleting === entry.id ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
