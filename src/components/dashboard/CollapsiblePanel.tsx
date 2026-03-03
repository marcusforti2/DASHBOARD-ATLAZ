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
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 group"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
              accentColor || "bg-primary/15"
            )}>
              {icon}
            </div>
          )}
          <div className="text-left">
            <h3 className="text-xs font-bold text-card-foreground uppercase tracking-wider">{title}</h3>
            {subtitle && <p className="text-[9px] text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerActions && <div onClick={e => e.stopPropagation()}>{headerActions}</div>}
          <div className="w-6 h-6 rounded-md bg-secondary flex items-center justify-center group-hover:bg-secondary/80 transition-colors">
            {open ? <Minimize2 size={12} className="text-muted-foreground" /> : <Maximize2 size={12} className="text-muted-foreground" />}
          </div>
        </div>
      </button>
      {open && (
        <div className="px-5 pb-5 animate-in fade-in slide-in-from-top-1 duration-200">
          {children}
        </div>
      )}
    </div>
  );
}
