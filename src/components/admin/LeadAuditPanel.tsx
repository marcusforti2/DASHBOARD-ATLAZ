import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Calendar, Search, User, Phone, Link, Filter, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

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

      {/* Lead table */}
      {groupedByDate.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground">Nenhum lead registrado neste período</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
          {groupedByDate.map(([date, entries]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-1.5 sticky top-0 bg-card/95 backdrop-blur-sm py-1 z-10">
                <Calendar size={10} className="text-primary" />
                <span className="text-[10px] font-bold text-primary">
                  {format(new Date(date + "T12:00:00"), "EEEE, dd/MM/yyyy", { locale: ptBR })}
                </span>
                <span className="text-[9px] text-muted-foreground">({entries.length} leads)</span>
              </div>

              <div className="rounded-lg border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_1fr_60px] gap-0 bg-secondary/40 border-b border-border">
                  <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <User size={9} /> Nome
                  </div>
                  <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-l border-border">
                    <Phone size={9} /> WhatsApp
                  </div>
                  <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-l border-border">
                    <Link size={9} /> Social
                  </div>
                  <div className="px-2.5 py-1.5 text-[8px] font-bold text-muted-foreground uppercase tracking-wider border-l border-border text-center">
                    Fonte
                  </div>
                </div>

                {entries.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className={cn(
                      "grid grid-cols-[1fr_1fr_1fr_60px] gap-0",
                      idx % 2 === 0 ? "bg-card" : "bg-secondary/10",
                      idx < entries.length - 1 && "border-b border-border/30"
                    )}
                  >
                    <div className="px-2.5 py-2 text-[10px] text-card-foreground font-medium truncate">
                      {entry.lead_name || "—"}
                    </div>
                    <div className="px-2.5 py-2 text-[10px] text-card-foreground font-mono border-l border-border/30 truncate">
                      {entry.whatsapp ? (
                        <a href={`https://wa.me/${entry.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"
                          className="text-accent hover:underline">
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
                        <span className="text-[7px] font-bold text-chart-4 bg-chart-4/10 px-1.5 py-0.5 rounded">DRIPIFY</span>
                      ) : (
                        <span className="text-[7px] font-bold text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">MANUAL</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
