import { Textarea } from '@/components/ui/textarea';
import { MIN_CHARS } from '@/data/dna-questions';

interface OpenTextProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function OpenText({ value, onChange, placeholder }: OpenTextProps) {
  const charCount = value.length;
  const remaining = MIN_CHARS - charCount;
  const isBelowMin = charCount > 0 && remaining > 0;

  return (
    <div className="space-y-2">
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Escreva sua resposta...'}
        className="min-h-[120px] sm:min-h-[150px] text-base bg-card border-border focus:border-primary resize-none rounded-xl p-4 placeholder:text-muted-foreground/60"
      />
      <div className="flex justify-end">
        <span className={`text-xs transition-colors ${isBelowMin ? 'text-destructive' : 'text-muted-foreground/60'}`}>
          {isBelowMin
            ? `Faltam ${remaining} caracteres (mínimo ${MIN_CHARS})`
            : `${charCount} caracteres`}
        </span>
      </div>
    </div>
  );
}
