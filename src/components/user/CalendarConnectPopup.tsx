import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Calendar, Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface CalendarConnectPopupProps {
  teamMemberId: string;
  memberRole: string;
  onConnected?: () => void;
  onGoToCalendar?: () => void;
}

export function CalendarConnectPopup({ teamMemberId, memberRole, onConnected, onGoToCalendar }: CalendarConnectPopupProps) {
  const [show, setShow] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isCloser = memberRole?.includes("closer");

  useEffect(() => {
    if (!isCloser || dismissed) return;

    // Check if already dismissed this session
    const dismissedKey = `calendar_popup_dismissed_${teamMemberId}`;
    if (sessionStorage.getItem(dismissedKey)) return;

    const checkConnection = async () => {
      try {
        const { data } = await supabase.functions.invoke("google-calendar-events", {
          body: { action: "list_connected_closers" },
        });
        const closers = data?.closers || [];
        const own = closers.find((c: any) => c.memberId === teamMemberId);
        if (own && !own.connected) {
          // Delay showing popup for better UX
          setTimeout(() => setShow(true), 2000);
        }
      } catch {
        // Silent fail
      }
    };

    checkConnection();
  }, [teamMemberId, isCloser, dismissed]);

  const handleDismiss = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem(`calendar_popup_dismissed_${teamMemberId}`, "1");
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-calendar-auth");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank", "width=600,height=700");
        toast.info("Complete a autorização na janela do Google");

        const interval = setInterval(async () => {
          const { data: check } = await supabase.from("google_calendar_tokens").select("calendar_email").maybeSingle();
          if (check) {
            clearInterval(interval);
            setConnecting(false);
            setShow(false);
            toast.success("Google Calendar conectado! 🎉");
            onConnected?.();
          }
        }, 3000);
        setTimeout(() => { clearInterval(interval); setConnecting(false); }, 120000);
      }
    } catch {
      toast.error("Erro ao conectar com Google Calendar");
      setConnecting(false);
    }
  };

  const handleGoToCalendar = () => {
    setShow(false);
    setDismissed(true);
    sessionStorage.setItem(`calendar_popup_dismissed_${teamMemberId}`, "1");
    onGoToCalendar?.();
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-[100] max-w-sm w-full"
        >
          <div className="rounded-2xl border border-primary/20 bg-card shadow-2xl shadow-primary/10 overflow-hidden">
            {/* Header accent */}
            <div className="h-1 bg-gradient-to-r from-primary via-primary/80 to-accent" />

            <div className="p-5 space-y-4">
              {/* Close button */}
              <button
                onClick={handleDismiss}
                className="absolute top-3 right-3 p-1 rounded-full text-muted-foreground/40 hover:text-foreground hover:bg-secondary transition-colors"
              >
                <X size={14} />
              </button>

              {/* Icon + Title */}
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Calendar className="text-primary" size={22} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Conecte sua Agenda</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Conecte o Google Calendar para que o time possa agendar reuniões diretamente na sua agenda.
                  </p>
                </div>
              </div>

              {/* Benefits */}
              <div className="bg-secondary/40 rounded-xl p-3 space-y-1.5">
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-accent">✓</span> SDRs agendam direto na sua agenda
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-accent">✓</span> Links do Google Meet automáticos
                </div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                  <span className="text-accent">✓</span> Lembretes via WhatsApp para leads
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleConnect}
                  disabled={connecting}
                  size="sm"
                  className="flex-1 gap-2"
                >
                  {connecting ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Link2 size={14} />
                  )}
                  {connecting ? "Conectando..." : "Conectar agora"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGoToCalendar}
                  className="text-xs text-muted-foreground"
                >
                  Ver depois
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
