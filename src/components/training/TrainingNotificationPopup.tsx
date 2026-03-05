import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { GraduationCap, X, Play } from "lucide-react";
import { cn } from "@/lib/utils";
import { getMemberRoles } from "@/lib/db";
import { AnimatePresence, motion } from "framer-motion";

interface TrainingNotificationPopupProps {
  memberRole: string;
  onGoToTraining: () => void;
}

export function TrainingNotificationPopup({ memberRole, onGoToTraining }: TrainingNotificationPopupProps) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const [currentNotif, setCurrentNotif] = useState<any>(null);
  const roles = getMemberRoles({ member_role: memberRole });

  // Load dismissed IDs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("dismissed_training_notifs");
    if (stored) setDismissed(JSON.parse(stored));
  }, []);

  const { data: notifications = [] } = useQuery({
    queryKey: ["training-notifications"],
    queryFn: async () => {
      const { data } = await supabase
        .from("training_notifications" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      return (data || []) as any[];
    },
    refetchInterval: 30000, // poll every 30s
  });

  // Find first un-dismissed notification matching role
  useEffect(() => {
    const match = notifications.find((n: any) => {
      if (dismissed.includes(n.id)) return false;
      if (n.target_role === "all") return true;
      return roles.includes(n.target_role);
    });
    setCurrentNotif(match || null);
  }, [notifications, dismissed, roles]);

  const handleDismiss = () => {
    if (!currentNotif) return;
    const newDismissed = [...dismissed, currentNotif.id];
    setDismissed(newDismissed);
    localStorage.setItem("dismissed_training_notifs", JSON.stringify(newDismissed));
    setCurrentNotif(null);
  };

  const handleGo = () => {
    handleDismiss();
    onGoToTraining();
  };

  return (
    <AnimatePresence>
      {currentNotif && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:w-[360px] z-[90]"
        >
          <div className="rounded-2xl border border-primary/30 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-primary/15 to-primary/5 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <GraduationCap size={16} className="text-primary" />
                </div>
                <p className="text-sm font-bold text-foreground">{currentNotif.title}</p>
              </div>
              <button
                onClick={handleDismiss}
                className="w-6 h-6 rounded-full bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} />
              </button>
            </div>

            {/* Body */}
            <div className="px-4 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{currentNotif.message}</p>
              <button
                onClick={handleGo}
                className="mt-3 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition-opacity"
              >
                <Play size={14} /> Assistir agora
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
