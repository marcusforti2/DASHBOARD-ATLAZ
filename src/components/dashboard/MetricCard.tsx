import { useState } from "react";
import { METRIC_LABELS } from "@/lib/db";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Minus, Plus, Trash2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent } from "@/components/ui/dialog";

const METRIC_ICONS: Record<string, string> = {
  conexoes: "🔗", conexoes_aceitas: "✅", abordagens: "💬", inmail: "📩", follow_up: "🔄",
  numero: "📞", lig_agendada: "📅", lig_realizada: "☎️", reuniao_agendada: "🗓️", reuniao_realizada: "🤝",
};

interface MetricCardProps {
  metricKey: string;
  actual: number;
  goal: number;
  onIncrement: (key: string, qty: number) => Promise<void>;
  onDecrement: (key: string, qty: number) => Promise<void>;
  onOpenLeadSheet?: (key: string) => void;
  isCloserView?: boolean;
}

export function MetricCard({
  metricKey,
  actual,
  goal,
  onIncrement,
  onDecrement,
  onOpenLeadSheet,
}: MetricCardProps) {
  const [popupOpen, setPopupOpen] = useState(false);
  const [qty, setQty] = useState(1);
  const [deleteQty, setDeleteQty] = useState(1);
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeletePicker, setShowDeletePicker] = useState(false);

  const pct = goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0;
  const achieved = goal > 0 && actual >= goal;
  const isNumero = metricKey === "numero";

  const handleCardClick = () => {
    if (isNumero && onOpenLeadSheet) {
      onOpenLeadSheet(metricKey);
      return;
    }
    setQty(1);
    setDeleteQty(1);
    setShowDeletePicker(false);
    setPopupOpen(true);
  };

  const handleSave = async () => {
    if (qty < 1 || loading) return;
    setLoading(true);
    await onIncrement(metricKey, qty);
    setLoading(false);
    setPopupOpen(false);
  };

  const handleDelete = async () => {
    if (deleteQty < 1 || deleting || actual <= 0) return;
    const toRemove = Math.min(deleteQty, actual);
    setDeleting(true);
    await onDecrement(metricKey, toRemove);
    setDeleting(false);
    setShowDeletePicker(false);
    setPopupOpen(false);
  };

  const presets = metricKey === "follow_up" ? [70, 100, 140, 200] : [1, 5, 10, 20];

  return (
    <>
      <button
        onClick={handleCardClick}
        className={cn(
          "w-full rounded-xl border p-3 transition-all text-left select-none active:scale-[0.97]",
          achieved
            ? "border-accent/30 bg-accent/5 hover:bg-accent/10"
            : "border-border bg-card hover:bg-primary/5 hover:border-primary/30"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-base">{METRIC_ICONS[metricKey]}</span>
          {achieved && <CheckCircle2 size={12} className="text-accent" />}
        </div>

        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
          {METRIC_LABELS[metricKey]}
        </p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className={cn("text-xl font-black tabular-nums", achieved ? "text-accent" : "text-card-foreground")}>
            {actual}
          </span>
          <span className="text-[10px] text-muted-foreground">/{goal}</span>
        </div>
        <Progress value={pct} className={cn("h-1 mt-2", achieved ? "[&>div]:bg-accent" : "")} />

        {isNumero && (
          <span className="absolute top-2 right-2 text-[7px] font-bold text-chart-4 bg-chart-4/10 px-1 py-0.5 rounded">📋</span>
        )}
      </button>

      {/* Popup */}
      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent className="sm:max-w-[320px] bg-card border-border p-5">
          <div className="flex flex-col items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">{METRIC_ICONS[metricKey]}</span>
              <span className="text-sm font-bold text-card-foreground">{METRIC_LABELS[metricKey]}</span>
            </div>

            {actual > 0 && (
              <p className="text-[10px] text-muted-foreground">
                Atual hoje: <span className="font-bold text-card-foreground">{actual}</span>
              </p>
            )}

            {/* Add section */}
            {!showDeletePicker && (
              <>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-lg font-bold text-card-foreground transition-all active:scale-95">−</button>
                  <input
                    type="number" min={1} value={qty}
                    onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="text-3xl font-black tabular-nums text-primary w-16 text-center bg-transparent border-b-2 border-primary/30 focus:border-primary outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => setQty(q => q + 1)} className="w-10 h-10 rounded-xl border border-border bg-secondary/50 hover:bg-secondary text-lg font-bold text-card-foreground transition-all active:scale-95">+</button>
                </div>

                <div className="flex gap-1.5">
                  {presets.map(n => (
                    <button key={n} onClick={() => setQty(n)} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", qty === n ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary")}>
                      {n}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handleSave}
                  disabled={loading}
                  className="w-full rounded-xl py-2.5 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                  Adicionar +{qty}
                </button>

                {/* Toggle to delete mode */}
                {actual > 0 && (
                  <button
                    onClick={() => { setShowDeletePicker(true); setDeleteQty(1); }}
                    className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground/50 hover:text-destructive transition-colors mt-1"
                  >
                    <Trash2 size={10} />
                    Excluir registros
                  </button>
                )}
              </>
            )}

            {/* Delete section */}
            {showDeletePicker && actual > 0 && (
              <>
                <p className="text-[10px] font-bold text-destructive uppercase tracking-wider">Excluir quantos?</p>
                <div className="flex items-center gap-3">
                  <button onClick={() => setDeleteQty(q => Math.max(1, q - 1))} className="w-10 h-10 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-lg font-bold text-destructive transition-all active:scale-95">−</button>
                  <input
                    type="number" min={1} max={actual} value={deleteQty}
                    onChange={e => setDeleteQty(Math.max(1, Math.min(actual, parseInt(e.target.value) || 1)))}
                    className="text-3xl font-black tabular-nums text-destructive w-16 text-center bg-transparent border-b-2 border-destructive/30 focus:border-destructive outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button onClick={() => setDeleteQty(q => Math.min(actual, q + 1))} className="w-10 h-10 rounded-xl border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-lg font-bold text-destructive transition-all active:scale-95">+</button>
                </div>

                {/* Quick delete presets */}
                <div className="flex gap-1.5">
                  {[1, 5, 10].filter(n => n <= actual).concat(actual > 10 ? [actual] : []).map(n => (
                    <button key={n} onClick={() => setDeleteQty(n)} className={cn("px-3 py-1 rounded-lg text-xs font-bold transition-all", deleteQty === n ? "bg-destructive text-white" : "bg-destructive/10 text-destructive hover:bg-destructive/20")}>
                      {n === actual ? `Todos (${n})` : n}
                    </button>
                  ))}
                </div>

                <div className="flex gap-2 w-full">
                  <button
                    onClick={() => setShowDeletePicker(false)}
                    className="flex-1 rounded-xl py-2.5 text-xs font-bold border border-border text-muted-foreground hover:bg-secondary transition-all"
                  >
                    Voltar
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex-1 rounded-xl py-2.5 text-xs font-bold bg-destructive text-white hover:bg-destructive/90 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {deleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    Excluir −{Math.min(deleteQty, actual)}
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
