import type { LucideIcon } from "lucide-react";
import {
  Code,
  Gauge,
  Layers,
  Puzzle,
  Rocket,
  Shield,
  Sparkles,
  Workflow,
} from "lucide-react";

/** Allow-list of the `learningOutcome.icon` names used in the content. */
const ICONS: Record<string, LucideIcon> = {
  layers: Layers,
  workflow: Workflow,
  gauge: Gauge,
  rocket: Rocket,
  sparkles: Sparkles,
  shield: Shield,
  puzzle: Puzzle,
  code: Code,
};

export type LearningOutcome = {
  _key: string;
  icon: string | null;
  title: string | null;
  description: string | null;
};

export function LearnGrid({ outcomes }: { outcomes: LearningOutcome[] }) {
  if (outcomes.length === 0) return null;

  return (
    <section className="rounded-[var(--radius-lg)] border border-neutral-200 bg-white p-8 shadow-[var(--shadow-sm)]">
      <h2 className="mb-6 font-display text-heading-1 text-neutral-900">
        What you&rsquo;ll learn
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {outcomes.map((outcome) => {
          const Icon = (outcome.icon && ICONS[outcome.icon]) || Sparkles;
          return (
            <div
              key={outcome._key}
              className="flex gap-4 rounded-[var(--radius-md)] border border-neutral-200 p-5"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-500">
                <Icon className="h-5 w-5" strokeWidth={2} />
              </span>
              <div className="min-w-0">
                <h3 className="mb-1 text-heading-3 font-medium text-neutral-900">
                  {outcome.title}
                </h3>
                {outcome.description && (
                  <p className="text-body text-neutral-500">
                    {outcome.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
