import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2, User, Phone, Link, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadRow {
  lead_name: string;
  whatsapp: string;
  social_link: string;
}

interface LeadEntrySheetProps {
  teamMemberId: string;
  date: string;
  metricType?: string;
  onClose: () => void;
}

const EMPTY_ROW: LeadRow = { lead_name: "", whatsapp: "", social_link: "" };

export function LeadEntrySheet({ teamMemberId, date, metricType, onClose }: LeadEntrySheetProps) {
  const [rows, setRows] = useState<LeadRow[]>([{ ...EMPTY_ROW }]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const updateRow = (idx: number, field: keyof LeadRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [field]: value } : r));
  };

  const addRow = () => setRows(prev => [...prev, { ...EMPTY_ROW }]);

  const removeRow = (idx: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    const validRows = rows.filter(r => r.lead_name.trim());
    if (validRows.length === 0) {
      onClose();
      return;
    }

    setSaving(true);
    const inserts = validRows.map(r => ({
      member_id: teamMemberId,
      date,
      lead_name: r.lead_name.trim(),
      whatsapp: r.whatsapp.trim(),
      social_link: r.social_link.trim(),
      metric_type: metricType || "",
    }));

    const { error } = await supabase.from("lead_entries").insert(inserts);
    if (error) {
      toast.error("Erro ao salvar leads: " + error.message);
    } else {
      setSaved(true);
      toast.success(`${validRows.length} lead(s) registrado(s)! 📋`);
      setTimeout(onClose, 800);
    }
    setSaving(false);
  };

  if (saved) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 animate-in fade-in">
        <CheckCircle2 size={40} className="text-accent" />
        <p className="text-sm font-bold text-accent">Leads registrados!</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-card-foreground flex items-center gap-2">
            📋 Registrar Leads
          </h3>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Opcional — registre os leads trabalhados para histórico auditável
          </p>
        </div>
      </div>

      {/* Spreadsheet-like header */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1fr_32px] gap-0 bg-secondary/60 border-b border-border">
          <div className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
            <User size={10} /> Nome do Lead
          </div>
          <div className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-l border-border">
            <Phone size={10} /> WhatsApp
          </div>
          <div className="px-3 py-2 text-[9px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 border-l border-border">
            <Link size={10} /> LinkedIn / Instagram
          </div>
          <div />
        </div>

        {/* Rows */}
        {rows.map((row, idx) => (
          <div
            key={idx}
            className={cn(
              "grid grid-cols-[1fr_1fr_1fr_32px] gap-0 transition-colors",
              idx % 2 === 0 ? "bg-card" : "bg-secondary/20",
              idx < rows.length - 1 && "border-b border-border/50"
            )}
          >
            <input
              value={row.lead_name}
              onChange={e => updateRow(idx, "lead_name", e.target.value)}
              placeholder="João Silva"
              className="px-3 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none focus:bg-primary/5 transition-colors"
              autoFocus={idx === 0}
            />
            <input
              value={row.whatsapp}
              onChange={e => updateRow(idx, "whatsapp", e.target.value)}
              placeholder="(11) 99999-9999"
              className="px-3 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none border-l border-border/50 focus:bg-primary/5 transition-colors"
            />
            <input
              value={row.social_link}
              onChange={e => updateRow(idx, "social_link", e.target.value)}
              placeholder="linkedin.com/in/... ou @instagram"
              className="px-3 py-2.5 text-xs bg-transparent text-card-foreground placeholder:text-muted-foreground/40 outline-none border-l border-border/50 focus:bg-primary/5 transition-colors"
            />
            <button
              onClick={() => removeRow(idx)}
              disabled={rows.length <= 1}
              className="flex items-center justify-center text-muted-foreground/40 hover:text-destructive disabled:opacity-0 transition-colors"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Add row button */}
      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
      >
        <Plus size={12} /> Adicionar linha
      </button>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          Pular
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex-1 px-4 py-2.5 text-xs rounded-xl font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
          Salvar Leads
        </button>
      </div>
    </div>
  );
}
