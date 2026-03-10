import { FadeIn } from "./FadeIn";
import { CheckCircle, AlertTriangle } from "lucide-react";

interface ScriptCardProps {
  title?: string;
  items?: string[];
  quote?: string;
  warning?: string;
  tip?: string;
  className?: string;
}

export const ScriptCard = ({ title, items, quote, warning, tip, className = "" }: ScriptCardProps) => (
  <div className={`rounded-2xl bg-card border border-border p-6 md:p-8 ${className}`}>
    {title && (
      <h3 className="text-xl md:text-2xl font-semibold mb-4 text-foreground">{title}</h3>
    )}
    {items && (
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3 text-secondary-foreground">
            <CheckCircle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <span className="text-base leading-relaxed">{item}</span>
          </li>
        ))}
      </ul>
    )}
    {quote && (
      <blockquote className="border-l-2 border-primary pl-5 italic text-secondary-foreground text-lg leading-relaxed">
        "{quote}"
      </blockquote>
    )}
    {warning && (
      <div className="flex items-start gap-3 bg-primary/5 rounded-xl p-4 border border-primary/10">
        <AlertTriangle className="w-5 h-5 text-primary mt-0.5 shrink-0" />
        <p className="text-secondary-foreground font-medium">{warning}</p>
      </div>
    )}
    {tip && (
      <p className="text-muted-foreground text-sm leading-relaxed">{tip}</p>
    )}
  </div>
);

interface DialogueCardProps {
  lines: { speaker?: string; text: string }[];
}

export const DialogueCard = ({ lines }: DialogueCardProps) => (
  <div className="rounded-2xl bg-card border border-border overflow-hidden">
    {lines.map((line, i) => (
      <div
        key={i}
        className={`p-5 md:p-6 ${i !== lines.length - 1 ? "border-b border-border" : ""}`}
      >
        {line.speaker && (
          <span className="text-xs font-semibold uppercase tracking-widest text-primary mb-2 block">
            {line.speaker}
          </span>
        )}
        <p className="text-secondary-foreground text-base leading-relaxed italic">"{line.text}"</p>
      </div>
    ))}
  </div>
);
