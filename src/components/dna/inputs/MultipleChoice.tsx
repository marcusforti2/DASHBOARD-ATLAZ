import { QuestionOption } from '@/data/dna-questions';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';

interface MultipleChoiceProps {
  options: QuestionOption[];
  selected: string | undefined;
  onSelect: (value: string) => void;
}

export function MultipleChoice({ options, selected, onSelect }: MultipleChoiceProps) {
  return (
    <div className="space-y-3">
      {options.map((option, index) => {
        const isSelected = selected === option.value;
        return (
          <motion.button
            key={option.value}
            onClick={() => onSelect(option.value)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all duration-200 ${
              isSelected
                ? 'border-primary bg-primary/10 text-foreground shadow-sm'
                : 'border-border bg-card hover:border-primary/30 hover:bg-accent/50 text-card-foreground'
            }`}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.2 }}
          >
            <div className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/30'
              }`}>
                {isSelected && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
              </div>
              <span className="text-sm sm:text-base leading-relaxed">{option.label}</span>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
