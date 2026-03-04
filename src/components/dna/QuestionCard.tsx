import { Question } from '@/data/dna-questions';
import { MultipleChoice } from './inputs/MultipleChoice';
import { OpenText } from './inputs/OpenText';
import { ScaleInput } from './inputs/ScaleInput';

interface QuestionCardProps {
  question: Question;
  answer: string | undefined;
  onAnswer: (value: string) => void;
  questionNumber: number;
}

export function QuestionCard({ question, answer, onAnswer, questionNumber }: QuestionCardProps) {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Pergunta {questionNumber}
        </span>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground leading-relaxed">
          {question.text}
        </h1>
        {question.hint && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {question.hint}
          </p>
        )}
      </div>

      <div>
        {question.type === 'multiple-choice' && question.options && (
          <MultipleChoice options={question.options} selected={answer} onSelect={onAnswer} />
        )}
        {question.type === 'open-text' && (
          <OpenText value={answer || ''} onChange={onAnswer} placeholder={question.placeholder} />
        )}
        {question.type === 'scale' && (
          <ScaleInput
            value={answer ? Number(answer) : undefined}
            onChange={(v) => onAnswer(String(v))}
            min={question.scaleMin ?? 0}
            max={question.scaleMax ?? 10}
            minLabel={question.scaleMinLabel}
            maxLabel={question.scaleMaxLabel}
          />
        )}
      </div>
    </div>
  );
}
