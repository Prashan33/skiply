import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProgressBar } from "@/components/ui/ProgressBar";

/**
 * Presentational only. Per-learner progress has no backend yet (separate
 * decided feature), so the percentage below is a static placeholder. Once
 * progress is wired to the Clerk user id, feed the real value in as a prop.
 */
const PLACEHOLDER_PERCENT = 35;

export function CourseProgressBar({ continueHref }: { continueHref: string }) {
  return (
    <div className="sticky bottom-0 z-20 border-t border-neutral-200 bg-white shadow-[var(--shadow-lg)] print:hidden">
      <Container className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:gap-6">
        <div className="shrink-0">
          <p className="text-small text-neutral-500">Your Progress</p>
          <p className="text-body font-semibold text-neutral-900">
            {PLACEHOLDER_PERCENT}% complete
          </p>
        </div>
        <ProgressBar
          value={PLACEHOLDER_PERCENT}
          showLabel={false}
          className="flex-1"
        />
        <Link
          href={continueHref}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary-500 px-4 text-body font-medium text-white transition-colors hover:bg-primary-400"
        >
          Continue Learning
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </Container>
    </div>
  );
}
