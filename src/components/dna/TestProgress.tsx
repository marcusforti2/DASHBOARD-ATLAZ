import { motion } from 'framer-motion';

interface TestProgressProps {
  current: number;
  total: number;
  answered: number;
  blockTitle: string;
  blockSubtitle: string;
  block: number;
}

const BLOCK_COLORS = [
  'bg-primary',
  'bg-chart-4',
  'bg-destructive',
  'bg-accent',
  'bg-primary',
  'bg-chart-4',
  'bg-accent',
];

export function TestProgress({ current, total, answered, blockTitle, blockSubtitle, block }: TestProgressProps) {
  const progress = ((current + 1) / total) * 100;

  return (
    <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-lg border-b border-border">
      <div className="h-1 bg-muted w-full">
        <motion.div
          className={`h-full ${BLOCK_COLORS[(block - 1) % BLOCK_COLORS.length]} opacity-70`}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3 sm:py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm sm:text-base font-semibold text-foreground">
              Pergunta {current + 1} de {total}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Respondidas</p>
            <p className="text-lg font-bold text-primary">{answered}<span className="text-muted-foreground font-normal text-sm">/{total}</span></p>
          </div>
        </div>
      </div>
    </div>
  );
}
