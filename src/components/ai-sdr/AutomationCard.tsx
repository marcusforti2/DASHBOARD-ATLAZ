import { useState } from "react";
import { ChevronDown, ToggleLeft, ToggleRight, Info, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Checkbox } from "@/components/ui/checkbox";

export interface AutomationFieldOption {
  value: string;
  label: string;
}

export interface AutomationField {
  key: string;
  label: string;
  type: "number" | "text" | "textarea" | "multi-select";
  placeholder?: string;
  suffix?: string;
  min?: number;
  max?: number;
  options?: AutomationFieldOption[];
}

export interface AutomationDef {
  key: string;
  icon: React.ElementType;
  title: string;
  desc: string;
  color: string;
  explanation: string;
  fields?: AutomationField[];
  warnings?: string[];
}

interface AutomationCardProps {
  def: AutomationDef;
  isOn: boolean;
  config: Record<string, any>;
  onToggle: () => void;
  onFieldChange: (key: string, value: any) => void;
}

export function AutomationCard({ def, isOn, config, onToggle, onFieldChange }: AutomationCardProps) {
  const [open, setOpen] = useState(false);
  const Icon = def.icon;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className={`rounded-xl border transition-all ${
        isOn ? "border-primary/40 bg-primary/5 shadow-sm" : "border-border bg-card opacity-80 hover:opacity-100"
      }`}>
        {/* Header */}
        <div className="flex items-center gap-3 p-4">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${isOn ? "bg-primary/15" : "bg-muted"}`}>
            <Icon className={`w-5 h-5 ${isOn ? def.color : "text-muted-foreground"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-xs font-bold ${isOn ? "text-foreground" : "text-muted-foreground"}`}>{def.title}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{def.desc}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={e => { e.stopPropagation(); onToggle(); }}
              className="p-1 rounded-md hover:bg-accent/50 transition-colors"
              title={isOn ? "Desativar" : "Ativar"}
            >
              {isOn
                ? <ToggleRight className="w-6 h-6 text-primary" />
                : <ToggleLeft className="w-6 h-6 text-muted-foreground" />}
            </button>
            <CollapsibleTrigger asChild>
              <button className="p-1.5 rounded-md hover:bg-accent/50 transition-colors">
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-0 space-y-3 border-t border-border/50">
            {/* Explanation */}
            <div className="flex gap-2 p-3 rounded-lg bg-muted/50 mt-3">
              <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <p className="text-[11px] text-muted-foreground leading-relaxed">{def.explanation}</p>
            </div>

            {/* Warnings */}
            {def.warnings && def.warnings.length > 0 && (
              <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <span className="text-destructive text-xs shrink-0 mt-0.5">⚠️</span>
                <div className="space-y-1">
                  {def.warnings.map((w, i) => (
                    <p key={i} className="text-[11px] text-destructive/80 leading-relaxed">{w}</p>
                  ))}
                </div>
              </div>
            )}

            {/* Fields */}
            {isOn && def.fields && def.fields.length > 0 && (
              <div className="space-y-3 pt-1">
                {def.fields.map(field => (
                  <div key={field.key}>
                    <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 block">
                      {field.label}
                    </label>
                    {field.type === "textarea" ? (
                      <Textarea
                        value={config[field.key] ?? ""}
                        onChange={e => onFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        rows={4}
                        className="text-sm resize-none font-mono"
                      />
                    ) : field.type === "number" ? (
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={field.min}
                          max={field.max}
                          value={config[field.key] ?? ""}
                          onChange={e => onFieldChange(field.key, parseInt(e.target.value) || 0)}
                          className="h-9 w-24 text-sm"
                        />
                        {field.suffix && <span className="text-xs text-muted-foreground">{field.suffix}</span>}
                      </div>
                    ) : field.type === "multi-select" && field.options ? (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {field.options.length === 0 ? (
                          <p className="text-[11px] text-muted-foreground/60 italic">Nenhum membro disponível.</p>
                        ) : (
                          field.options.map(opt => {
                            const selectedIds: string[] = config[field.key] || [];
                            const isChecked = selectedIds.includes(opt.value);
                            return (
                              <label key={opt.value} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors">
                                <Checkbox
                                  checked={isChecked}
                                  onCheckedChange={(checked) => {
                                    const current: string[] = config[field.key] || [];
                                    const next = checked
                                      ? [...current, opt.value]
                                      : current.filter((id: string) => id !== opt.value);
                                    onFieldChange(field.key, next);
                                  }}
                                />
                                <span className="text-xs text-foreground">{opt.label}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    ) : (
                      <Input
                        value={config[field.key] ?? ""}
                        onChange={e => onFieldChange(field.key, e.target.value)}
                        placeholder={field.placeholder}
                        className="h-9 text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {!isOn && def.fields && def.fields.length > 0 && (
              <p className="text-[11px] text-muted-foreground/60 italic">Ative esta automação para configurar os parâmetros.</p>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
