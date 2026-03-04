import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Popup {
  id: string;
  title: string;
  message: string;
  emoji: string;
  category: string;
}

interface MotivationalPopupProps {
  userRole: string;
}

export function MotivationalPopup({ userRole }: MotivationalPopupProps) {
  const [popup, setPopup] = useState<Popup | null>(null);
  const [visible, setVisible] = useState(false);
  const [allPopups, setAllPopups] = useState<Popup[]>([]);
  const [shownIds, setShownIds] = useState<Set<string>>(new Set());

  // Fetch popups once
  useEffect(() => {
    supabase
      .from("motivational_popups")
      .select("id, title, message, emoji, category, target_role, frequency_minutes")
      .eq("active", true)
      .then(({ data }) => {
        if (!data) return;
        const filtered = data.filter(
          (p: any) => p.target_role === "all" || p.target_role === userRole
        );
        setAllPopups(filtered);
      });
  }, [userRole]);

  const showRandomPopup = useCallback(() => {
    if (!allPopups.length) return;

    // Filter out already shown
    let available = allPopups.filter((p) => !shownIds.has(p.id));
    if (!available.length) {
      setShownIds(new Set());
      available = allPopups;
    }

    const random = available[Math.floor(Math.random() * available.length)];
    setPopup(random);
    setVisible(true);
    setShownIds((prev) => new Set(prev).add(random.id));

    // Auto-hide after 8 seconds
    setTimeout(() => setVisible(false), 8000);
  }, [allPopups, shownIds]);

  // Show popup periodically
  useEffect(() => {
    if (!allPopups.length) return;

    // Show first one after 30 seconds
    const initialTimer = setTimeout(showRandomPopup, 30000);

    // Then every 2 hours
    const interval = setInterval(showRandomPopup, 2 * 60 * 60 * 1000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [allPopups, showRandomPopup]);

  if (!visible || !popup) return null;

  const categoryColors: Record<string, string> = {
    motivation: "from-primary/20 to-accent/20 border-primary/30",
    reminder: "from-chart-4/20 to-primary/20 border-chart-4/30",
    tip: "from-chart-3/20 to-primary/20 border-chart-3/30",
  };

  return (
    <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-500 max-w-sm">
      <div
        className={cn(
          "rounded-2xl border bg-gradient-to-br backdrop-blur-xl p-5 shadow-2xl relative overflow-hidden",
          categoryColors[popup.category] || categoryColors.motivation
        )}
      >
        {/* Glow effect */}
        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />

        <button
          onClick={() => setVisible(false)}
          className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
        >
          <X size={14} />
        </button>

        <div className="relative flex gap-3">
          <div className="text-3xl shrink-0 mt-0.5">{popup.emoji}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={10} className="text-primary" />
              <span className="text-[8px] font-bold text-primary uppercase tracking-[0.2em]">
                {popup.category === "tip" ? "Dica" : popup.category === "reminder" ? "Lembrete" : "Motivação"}
              </span>
            </div>
            <h4 className="text-sm font-bold text-foreground leading-tight">{popup.title}</h4>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{popup.message}</p>
          </div>
        </div>

        {/* Progress bar for auto-dismiss */}
        <div className="mt-3 h-0.5 rounded-full bg-secondary/30 overflow-hidden">
          <div
            className="h-full bg-primary/40 rounded-full"
            style={{
              animation: "shrink 8s linear forwards",
            }}
          />
        </div>
      </div>

      <style>{`
        @keyframes shrink {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
    </div>
  );
}
