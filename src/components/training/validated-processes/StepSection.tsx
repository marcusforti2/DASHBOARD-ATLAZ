import { FadeIn } from "./FadeIn";

interface StepSectionProps {
  number: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  id?: string;
}

export const StepSection = ({ number, title, subtitle, children, id }: StepSectionProps) => (
  <section id={id} className="relative py-16 md:py-24">
    <div className="container max-w-4xl mx-auto px-6">
      <FadeIn>
        <div className="flex items-center gap-4 mb-4">
          <span className="inline-flex items-center justify-center w-12 h-12 rounded-full text-lg font-bold bg-primary text-primary-foreground shrink-0">
            {number}
          </span>
          <div className="h-px flex-1 bg-gradient-to-r from-primary/30 to-transparent" />
        </div>
      </FadeIn>
      <FadeIn delay={0.1}>
        <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-3 text-foreground">
          {title}
        </h2>
      </FadeIn>
      {subtitle && (
        <FadeIn delay={0.15}>
          <p className="text-muted-foreground text-lg md:text-xl max-w-2xl mb-12">{subtitle}</p>
        </FadeIn>
      )}
      <FadeIn delay={0.2}>
        <div className="space-y-8">{children}</div>
      </FadeIn>
    </div>
  </section>
);
