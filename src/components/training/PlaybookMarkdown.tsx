import ReactMarkdown from "react-markdown";
import { cn } from "@/lib/utils";
import {
  CheckSquare, Square, ChevronRight, Lightbulb, AlertTriangle,
  BookOpen, Target, Zap, Quote,
} from "lucide-react";

interface PlaybookMarkdownProps {
  content: string;
  className?: string;
}

export function PlaybookMarkdown({ content, className }: PlaybookMarkdownProps) {
  return (
    <div className={cn("playbook-markdown", className)}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <div className="mb-6 pb-4 border-b border-primary/20">
              <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-3">
                <div className="w-1.5 h-8 rounded-full bg-primary shrink-0" />
                {children}
              </h1>
            </div>
          ),
          h2: ({ children }) => (
            <div className="mt-8 mb-4">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                  <Target size={14} className="text-primary" />
                </div>
                {children}
              </h2>
              <div className="mt-2 h-px bg-gradient-to-r from-primary/30 via-primary/10 to-transparent" />
            </div>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-bold text-foreground mt-6 mb-2 flex items-center gap-2">
              <ChevronRight size={14} className="text-primary" />
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-xs font-bold text-foreground/80 uppercase tracking-wider mt-4 mb-2 flex items-center gap-1.5">
              <Zap size={12} className="text-accent" />
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-sm text-foreground/80 leading-relaxed mb-3">{children}</p>
          ),
          strong: ({ children }) => (
            <strong className="font-bold text-foreground">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-primary/90 not-italic font-medium">{children}</em>
          ),
          blockquote: ({ children }) => (
            <div className="my-4 rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
              <div className="shrink-0 mt-0.5">
                <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center">
                  <Lightbulb size={14} className="text-primary" />
                </div>
              </div>
              <div className="flex-1 text-sm text-foreground/80 [&>p]:mb-1 [&>p:last-child]:mb-0">
                {children}
              </div>
            </div>
          ),
          ul: ({ children }) => (
            <ul className="my-3 space-y-1.5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 space-y-2 counter-reset-item">{children}</ol>
          ),
          li: ({ children, ...props }) => {
            const text = String(children);
            // Checklist detection
            const isChecked = text.startsWith("[x] ") || text.startsWith("[X] ");
            const isUnchecked = text.startsWith("[ ] ");
            if (isChecked || isUnchecked) {
              const cleanText = text.replace(/^\[[ xX]\]\s*/, "");
              return (
                <li className="flex items-start gap-2.5 group">
                  {isChecked ? (
                    <CheckSquare size={16} className="text-accent shrink-0 mt-0.5" />
                  ) : (
                    <Square size={16} className="text-muted-foreground/40 shrink-0 mt-0.5" />
                  )}
                  <span className={cn(
                    "text-sm leading-relaxed",
                    isChecked ? "text-muted-foreground line-through" : "text-foreground/80"
                  )}>
                    {cleanText}
                  </span>
                </li>
              );
            }
            // Regular list item
            return (
              <li className="flex items-start gap-2.5 text-sm text-foreground/80 leading-relaxed">
                <div className="w-1.5 h-1.5 rounded-full bg-primary/50 shrink-0 mt-2" />
                <span>{children}</span>
              </li>
            );
          },
          hr: () => (
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-primary/40" />
                <div className="w-1 h-1 rounded-full bg-primary/60" />
                <div className="w-1 h-1 rounded-full bg-primary/40" />
              </div>
              <div className="flex-1 h-px bg-border" />
            </div>
          ),
          code: ({ children, className: codeClass, ...props }) => {
            const isBlock = codeClass?.includes("language-");
            if (isBlock) {
              return (
                <div className="my-4 rounded-xl border border-border overflow-hidden">
                  <div className="px-4 py-2 bg-secondary/80 border-b border-border flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-destructive/60" />
                      <div className="w-2 h-2 rounded-full bg-[hsl(45,93%,47%)]/60" />
                      <div className="w-2 h-2 rounded-full bg-accent/60" />
                    </div>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">
                      {codeClass?.replace("language-", "") || "código"}
                    </span>
                  </div>
                  <pre className="p-4 bg-secondary/30 overflow-x-auto">
                    <code className="text-xs font-mono text-foreground/90 leading-relaxed">{children}</code>
                  </pre>
                </div>
              );
            }
            return (
              <code className="px-1.5 py-0.5 rounded-md bg-primary/10 text-primary text-xs font-mono font-medium">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <>{children}</>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline underline-offset-2 decoration-primary/30 hover:decoration-primary transition-colors font-medium"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="my-4 rounded-xl border border-border overflow-hidden">
              <table className="w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-secondary/50">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-xs font-bold text-foreground uppercase tracking-wider border-b border-border">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-sm text-foreground/80 border-b border-border/50">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
