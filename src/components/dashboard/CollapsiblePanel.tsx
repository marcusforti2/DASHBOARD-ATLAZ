import { useState } from "react";
import { ChevronDown, Minimize2, Maximize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CollapsiblePanelProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  accentColor?: string;
}

export function CollapsiblePanel({
  title,
  subtitle,
  icon,
  defaultOpen = true,
  children,
  headerActions,
  accentColor,
}: CollapsiblePanelProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className={cn(
      "rounded-xl border border-border bg-card transition-all",
      open ? "shadow-[0_0_20px_-8px_hsl(var(--primary)/0.1)]" : "shadow-none"
    )}>
      <div className="px-3 sm:px-5 py-2.5 sm:py-3.5">
        <button
          onClick={() => setOpen(!open)}
          className="w-full flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            {icon && (
              <div className={cn(
                "w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shrink-0",
                accentColor || "bg-primary/15"
              )}>
                {icon}
              </div>
            )}
            <div className="text-left min-w-0">
              <h3 className="text-[10px] sm:text-xs font-bold text-card-foreground uppercase tracking-wider truncate">{title}</h3>
              {subtitle && <p className="text-[8px] sm:text-[9px] text-muted-foreground mt-0.5">{subtitle}</p>}
            </div>
          </div>
          <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors shrink-0 ml-2">
            {open ? <Minimize2 size={12} className="text-muted-foreground" /> : <Maximize2 size={12} className="text-muted-foreground" />}
          </div>
        </button>
        {headerActions && (
          <div onClick={e => e.stopPropagation()} className="mt-2 overflow-x-auto scrollbar-none">
            {headerActions}
          </div>
        )}
      </div>
      {open && (
        <div className="px-2.5 sm:px-5 pb-3 sm:pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
