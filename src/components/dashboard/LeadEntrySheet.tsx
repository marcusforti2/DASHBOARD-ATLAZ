import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { METRIC_LABELS } from "@/lib/db";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, X, User, UserPlus, Save, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const METRIC_ICONS: Record<string, string> = {
  conexoes: "🔗", conexoes_aceitas: "✅", abordagens: "💬", inmail: "📩", follow_up: "🔄",
  numero: "📞", lig_agendada: "📅", lig_realizada: "☎️", reuniao_agendada: "🗓️", reuniao_realizada: "🤝",
};

interface LeadEntrySheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMemberId: string;
  metricKey: string;
  todayStr: string;
  currentMonthId: string;
  roleMetrics: readonly string[];
  onSaved: () => void;
  onDecrement?: (key: string, qty: number) => Promise<void>;
  currentActual?: number;
}

const DAY_NAMES: Record<number, string> = { 0: "Dom", 1: "Seg", 2: "Ter", 3: "Qua", 4: "Qui", 5: "Sex", 6: "Sáb" };

export function LeadEntrySheet({
  open,
  onOpenChange,
  teamMemberId,
  metricKey,
  todayStr,
  currentMonthId,
  roleMetrics,
  onSaved,
  onDecrement,
  currentActual = 0,
}: LeadEntrySheetProps) {
  const [rows, setRows] = useState<{ lead_name: string; whatsapp: string; social_link: string; fromExisting?: boolean }[]>([
    { lead_name: "", whatsapp: "", social_link: "" },
  ]);
  const [saving, setSaving] = useState(false);
  const [existingLeads, setExistingLeads] = useState<any[]>([]);
  const [showExisting, setShowExisting] = useState(false);
  const [existingSearch, setExistingSearch] = useState("");

  useEffect(() => {
    if (!open) return;
    setRows([{ lead_name: "", whatsapp: "", social_link: "" }]);
    setShowExisting(false);
    setExistingSearch("");
    supabase
      .from("lead_entries")
      .select("*")
      .eq("member_id", teamMemberId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) {
          const seen = new Set<string>();
          setExistingLeads(
            data.filter((l: any) => {
              const key = l.lead_name?.toLowerCase().trim();
              if (!key || seen.has(key)) return false;
              seen.add(key);
              return true;
            })
          );
        }
      });
  }, [open, teamMemberId]);

  const updateRow = (idx: number, field: string, value: string) => {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r)));
  };

  const addRow = () => setRows(prev => [...prev, { lead_name: "", whatsapp: "", social_link: "" }]);

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const addExistingLead = (lead: any) => {
    setRows(prev => [
      ...prev,
      { lead_name: lead.lead_name, whatsapp: lead.whatsapp || "", social_link: lead.social_link || "", fromExisting: true },
    ]);
    setShowExisting(false);
    setExistingSearch("");
  };

  const filteredExisting = existingSearch.trim()
    ? existingLeads.filter(
        l =>
          l.lead_name?.toLowerCase().includes(existingSearch.toLowerCase()) ||
          l.whatsapp?.includes(existingSearch)
      )
    : existingLeads.slice(0, 20);

  const handleSave = async () => {
    const validRows = rows.filter(r => r.lead_name.trim());
    const count = validRows.length;
    if (count === 0) return;
    setSaving(true);

    const inserts = validRows.map(r => ({
      member_id: teamMemberId,
      date: todayStr,
      lead_name: r.lead_name.trim(),
      whatsapp: r.whatsapp.trim(),
      social_link: r.social_link.trim(),
      metric_type: metricKey,
      source: "manual",
    }));
    await supabase.from("lead_entries").insert(inserts);

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
      const currentVal = (existing as any)[metricKey] || 0;
      await supabase
        .from("daily_metrics")
        .update({ [metricKey]: currentVal + count })
        .eq("id", existing.id);
    } else {
      const payload: any = {
        member_id: teamMemberId,
        month_id: currentMonthId,
        date: todayStr,
        day_of_week: dayName,
      };
      roleMetrics.forEach(k => { payload[k] = 0; });
      payload[metricKey] = count;
      await supabase.from("daily_metrics").insert(payload);
    }

    toast.success(`+${count} ${METRIC_LABELS[metricKey]} registrado(s)! 🚀`);
    onSaved();
    setSaving(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-bold text-card-foreground flex items-center gap-2">
            <span className="text-base">{METRIC_ICONS[metricKey]}</span>
            {METRIC_LABELS[metricKey]}
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
              <input value={row.lead_name} onChange={e => updateRow(idx, "lead_name", e.target.value)} placeholder="João Silva" className="px-2.5 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-primary/5 transition-colors" autoFocus={idx === rows.length - 1} />
              <input value={row.whatsapp} onChange={e => updateRow(idx, "whatsapp", e.target.value)} placeholder="(11) 99999-9999" className="px-2.5 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none border-l border-border/30 focus:bg-primary/5 transition-colors" />
              <input value={row.social_link} onChange={e => updateRow(idx, "social_link", e.target.value)} placeholder="linkedin.com/in/..." className="px-2.5 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none border-l border-border/30 focus:bg-primary/5 transition-colors" />
              <button onClick={() => removeRow(idx)} disabled={rows.length <= 1} className="flex items-center justify-center text-muted-foreground/40 hover:text-destructive disabled:opacity-0 transition-colors">
                <X size={11} />
              </button>
            </div>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button onClick={addRow} className="flex items-center gap-1.5 text-[10px] font-bold text-primary hover:text-primary/80 transition-all px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/15 border border-primary/20">
            <Plus size={12} /> Adicionar Linha
          </button>
          {existingLeads.length > 0 && (
            <button onClick={() => setShowExisting(!showExisting)} className="flex items-center gap-1.5 text-[10px] font-bold text-accent hover:text-accent/80 transition-all px-3 py-2 rounded-lg bg-accent/10 hover:bg-accent/15 border border-accent/20">
              <UserPlus size={12} /> Lead já cadastrado
            </button>
          )}
        </div>

        {/* Existing lead picker */}
        {showExisting && (
          <div className="rounded-xl border border-accent/30 bg-accent/5 p-3 space-y-2 animate-in fade-in slide-in-from-top-2">
            <input value={existingSearch} onChange={e => setExistingSearch(e.target.value)} placeholder="Buscar lead existente..." className="w-full text-[10px] bg-secondary border border-border rounded-lg px-2.5 py-1.5 text-secondary-foreground placeholder:text-muted-foreground/50 outline-none focus:ring-1 focus:ring-accent" autoFocus />
            <div className="max-h-[150px] overflow-y-auto space-y-0.5">
              {filteredExisting.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum lead encontrado</p>
              ) : (
                filteredExisting.map((lead: any) => (
                  <button key={lead.id} onClick={() => addExistingLead(lead)} className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left hover:bg-accent/10 transition-colors group">
                    <div className="w-6 h-6 rounded-full bg-accent/15 flex items-center justify-center shrink-0">
                      <User size={10} className="text-accent" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold text-card-foreground truncate">{lead.lead_name}</p>
                      <p className="text-[8px] text-muted-foreground truncate">{lead.whatsapp || lead.social_link || "Sem contato"}</p>
                    </div>
                    <Plus size={10} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* Save */}
        <button
          onClick={handleSave}
          disabled={saving || rows.filter(r => r.lead_name.trim()).length === 0}
          className="w-full rounded-xl bg-primary py-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          Salvar {rows.filter(r => r.lead_name.trim()).length} lead(s)
        </button>
      </DialogContent>
    </Dialog>
  );
}
