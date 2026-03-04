import { motion } from 'framer-motion';

interface ScaleInputProps {
  value: number | undefined;
  onChange: (value: number) => void;
  min: number;
  max: number;
  minLabel?: string;
  maxLabel?: string;
}

export function ScaleInput({ value, onChange, min, max, minLabel, maxLabel }: ScaleInputProps) {
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-center">
        {range.map((num, index) => {
          const isSelected = value === num;
          return (
            <motion.button
              key={num}
              onClick={() => onChange(num)}
              className={`w-11 h-11 sm:w-12 sm:h-12 rounded-xl border-2 font-medium text-sm transition-all duration-200 ${
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-card-foreground hover:border-primary/30 hover:bg-accent/50'
              }`}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03, duration: 0.2 }}
            >
              {num}
            </motion.button>
          );
        })}
      </div>
      {(minLabel || maxLabel) && (
        <div className="flex justify-between text-xs text-muted-foreground px-1">
          <span>{minLabel}</span>
          <span>{maxLabel}</span>
        </div>
      )}
    </div>
  );
}
