import { useState, useRef } from "react";
import { METRIC_LABELS } from "@/lib/db";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Minus, Plus } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const METRIC_ICONS: Record<string, string> = {
  conexoes: "🔗", conexoes_aceitas: "✅", abordagens: "💬", inmail: "📩", follow_up: "🔄",
  numero: "📞", lig_agendada: "📅", lig_realizada: "☎️", reuniao_agendada: "🗓️", reuniao_realizada: "🤝",
};

interface MetricCardProps {
  metricKey: string;
  actual: number;
  goal: number;
  onIncrement: (key: string, qty: number) => Promise<void>;
  onDecrement: (key: string) => Promise<void>;
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
  isCloserView,
}: MetricCardProps) {
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showQtyPicker, setShowQtyPicker] = useState(false);
  const [qty, setQty] = useState(1);
  const longPressTimer = useRef<ReturnType<typeof setTimeout>>();
  const didLongPress = useRef(false);

  const pct = goal > 0 ? Math.min(Math.round((actual / goal) * 100), 100) : 0;
  const achieved = goal > 0 && actual >= goal;
  const isNumero = metricKey === "numero";

  const handleTap = async () => {
    if (didLongPress.current) { didLongPress.current = false; return; }
    if (loading) return;

    // "numero" needs lead sheet
    if (isNumero && onOpenLeadSheet) {
      onOpenLeadSheet(metricKey);
      return;
    }

    setLoading(true);
    setAnimating(true);
    await onIncrement(metricKey, 1);
    setLoading(false);
    setTimeout(() => setAnimating(false), 600);
  };

  const handlePointerDown = () => {
    if (isNumero) return;
    didLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      didLongPress.current = true;
      setShowQtyPicker(true);
      setQty(1);
    }, 500);
  };

  const handlePointerUp = () => {
    clearTimeout(longPressTimer.current);
  };

  const handleBulkAdd = async () => {
    if (qty < 1 || loading) return;
    setLoading(true);
    await onIncrement(metricKey, qty);
    setLoading(false);
    setShowQtyPicker(false);
  };

  const handleDecrement = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (actual <= 0 || loading) return;
    setLoading(true);
    await onDecrement(metricKey);
    setLoading(false);
  };

  const presets = metricKey === "follow_up" ? [70, 100, 140, 200] : [5, 10, 20, 50];

  return (
    <div className="relative">
      <button
        onClick={handleTap}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        disabled={loading}
        className={cn(
          "w-full rounded-xl border p-3 transition-all text-left select-none active:scale-[0.97] disabled:pointer-events-none",
          achieved
            ? "border-accent/30 bg-accent/5 hover:bg-accent/10"
            : "border-border bg-card hover:bg-primary/5 hover:border-primary/30",
          animating && "ring-2 ring-primary/40 ring-offset-1 ring-offset-background"
        )}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-base">{METRIC_ICONS[metricKey]}</span>
          <div className="flex items-center gap-1">
            {loading && <Loader2 size={10} className="animate-spin text-primary" />}
            {actual > 0 && !loading && (
              <button
                onClick={handleDecrement}
                className="p-1 rounded-md text-muted-foreground/30 hover:text-destructive hover:bg-destructive/10 transition-colors"
                title={`Remover 1 ${METRIC_LABELS[metricKey]}`}
              >
                <Minus size={10} />
              </button>
            )}
            {achieved && <CheckCircle2 size={12} className="text-accent" />}
          </div>
        </div>

        <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">
          {METRIC_LABELS[metricKey]}
        </p>
        <div className="flex items-baseline gap-1 mt-1.5">
          <span className={cn(
            "text-xl font-black tabular-nums transition-all",
            achieved ? "text-accent" : "text-card-foreground",
            animating && "scale-110"
          )}>
            {actual}
          </span>
          <span className="text-[10px] text-muted-foreground">/{goal}</span>
        </div>
        <Progress
          value={pct}
          className={cn("h-1 mt-2", achieved ? "[&>div]:bg-accent" : "")}
        />

        {/* Tap hint */}
        {!isNumero && !loading && (
          <span className="absolute top-2.5 right-2.5 text-[8px] font-bold text-muted-foreground/20">
            tap +1
          </span>
        )}
        {isNumero && (
          <span className="absolute top-2 right-2 text-[7px] font-bold text-chart-4 bg-chart-4/10 px-1 py-0.5 rounded">📋</span>
        )}
      </button>

      {/* Qty Picker Overlay */}
      {showQtyPicker && (
        <div className="absolute inset-0 z-20 bg-card/95 backdrop-blur-sm rounded-xl border border-primary/30 p-3 flex flex-col items-center justify-center gap-2 animate-in fade-in zoom-in-95">
          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
            {METRIC_LABELS[metricKey]}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setQty(q => Math.max(1, q - 1))}
              className="w-8 h-8 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-sm font-bold text-card-foreground transition-all"
            >
              −
            </button>
            <input
              type="number"
              min={1}
              value={qty}
              onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
              className="text-2xl font-black tabular-nums text-primary w-14 text-center bg-transparent border-b-2 border-primary/30 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <button
              onClick={() => setQty(q => q + 1)}
              className="w-8 h-8 rounded-lg border border-border bg-secondary/50 hover:bg-secondary text-sm font-bold text-card-foreground transition-all"
            >
              +
            </button>
          </div>
          <div className="flex gap-1">
            {presets.map(n => (
              <button
                key={n}
                onClick={() => setQty(n)}
                className={cn(
                  "px-2 py-0.5 rounded text-[9px] font-bold transition-all",
                  qty === n ? "bg-primary text-primary-foreground" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5 w-full mt-1">
            <button
              onClick={() => setShowQtyPicker(false)}
              className="flex-1 py-1.5 text-[9px] font-bold rounded-lg border border-border text-muted-foreground hover:bg-secondary transition-all"
            >
              Cancelar
            </button>
            <button
              onClick={handleBulkAdd}
              disabled={loading}
              className="flex-1 py-1.5 text-[9px] font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-all disabled:opacity-50 flex items-center justify-center gap-1"
            >
              {loading ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
              +{qty}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
