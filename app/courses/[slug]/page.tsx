import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  BarChart3,
  ChevronRight,
  Clock,
  FileText,
  Users,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { TopNav } from "@/components/ui/Navigation";
import {
  CourseContent,
  type CourseContentModule,
} from "@/components/course/CourseContent";
import { CourseProgressBar } from "@/components/course/CourseProgressBar";
import { CourseActions } from "@/components/course/CourseActions";
import { LearnGrid, type LearningOutcome } from "@/components/course/LearnGrid";
import {
  COURSE_BY_SLUG_QUERY,
  COURSE_SLUGS_QUERY,
} from "@/sanity/lib/queries";
import { getProgressForUser, getReadClient } from "@/sanity/lib/fetch";
import { getPostHogClient } from "@/lib/posthog-server";
import {
  capitalize,
  formatClock,
  formatCompactCount,
  formatDurationFromSeconds,
} from "@/lib/format";

export const dynamicParams = true;

/**
 * Read the private dataset with the server-only token. `defineLive`'s
 * `sanityFetch` only attaches the token for draft perspectives, so it cannot
 * read published content from a private dataset — use the token-bearing client.
 */
function getCourseBySlug(slug: string) {
  return getReadClient().fetch(
    COURSE_BY_SLUG_QUERY,
    { slug },
    { next: { revalidate: 60, tags: ["course", `course:${slug}`] } },
  );
}

export async function generateStaticParams() {
  const slugs = await getReadClient().fetch(COURSE_SLUGS_QUERY);
  return slugs
    .filter((s): s is { slug: string } => Boolean(s.slug))
    .map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/courses/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const course = await getCourseBySlug(slug);
  if (!course) return {};
  return {
    title: course.title ? `${course.title} — Skiply` : "Skiply",
    description: course.summary ?? undefined,
  };
}

function moduleDurationSeconds(
  lessons: { duration: number | null }[] | null,
): number {
  return (lessons ?? []).reduce((sum, l) => sum + (l.duration ?? 0), 0);
}

export default async function CoursePage({
  params,
}: PageProps<"/courses/[slug]">) {
  const { slug } = await params;
  const [course, { userId }] = await Promise.all([
    getCourseBySlug(slug),
    auth(),
  ]);

  if (!course) notFound();

  const rawModules = course.modules ?? [];

  const totalSeconds = rawModules.reduce(
    (sum, m) => sum + moduleDurationSeconds(m.lessons),
    0,
  );
  const totalDurationLabel = formatDurationFromSeconds(totalSeconds);
  const moduleCount = rawModules.length;

  // Real per-learner progress (AGENTS.md §7). Completion is watch-gated by
  // `POST /api/progress` — see `components/lesson/LessonVideo.tsx`.
  const progress = userId ? await getProgressForUser(userId) : null;
  const progressEntries = progress?.entries ?? [];
  const completedIds = new Set(
    progressEntries.filter((e) => e?.completed && e.lessonId).map((e) => e.lessonId as string),
  );

  const courseBookmarked = (progress?.bookmarks ?? []).some(
    (b) => b?.kind === "course" && b.refId === course._id,
  );

  const flatLessons = rawModules.flatMap((m) => m.lessons ?? []);
  const completedCount = flatLessons.filter((l) => completedIds.has(l._id)).length;
  const percentComplete =
    flatLessons.length > 0 ? Math.round((completedCount / flatLessons.length) * 100) : 0;

  // Resume at the first lesson that is not yet complete; deep-link into it if the
  // learner has an in-progress position there.
  const resumeLesson =
    flatLessons.find((l) => l.slug && !completedIds.has(l._id)) ??
    flatLessons.find((l) => l.slug) ??
    null;
  const resumeEntry = resumeLesson
    ? progressEntries.find((e) => e?.lessonId === resumeLesson._id)
    : null;
  const resumeAt =
    resumeEntry && !resumeEntry.completed && (resumeEntry.lastPosition ?? 0) > 0
      ? Math.round(resumeEntry.lastPosition as number)
      : 0;
  const continueHref = resumeLesson?.slug
    ? `/lessons/${resumeLesson.slug}${resumeAt > 0 ? `?t=${resumeAt}` : ""}`
    : `/courses/${slug}`;

  const contentModules: CourseContentModule[] = rawModules.map((m, mi) => ({
    key: m._key,
    title: m.title ?? "Untitled module",
    summary: m.summary,
    durationLabel: formatDurationFromSeconds(moduleDurationSeconds(m.lessons)),
    lessons: (m.lessons ?? []).map((l, li) => ({
      id: l._id,
      label: `${mi + 1}.${li + 1}`,
      title: l.title ?? "Untitled lesson",
      slug: l.slug,
      clock: formatClock(l.duration),
      freePreview: Boolean(l.freePreview),
      completed: completedIds.has(l._id),
    })),
  }));

  const outcomes: LearningOutcome[] = course.learningOutcomes ?? [];
  const monogram = (course.title ?? "?").trim().charAt(0).toUpperCase();

  // Track course view server-side
  const posthog = getPostHogClient();
  if (posthog) {
    posthog.capture({
      distinctId: userId ?? "anonymous",
      event: "course_viewed",
      properties: {
        course_slug: slug,
        course_title: course.title ?? undefined,
        course_level: course.level ?? undefined,
        module_count: moduleCount,
      },
    });
    await posthog.flush();
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <TopNav showActions />

      <Container as="main" className="flex-1 pt-8 pb-16">
        {/* Breadcrumbs */}
        <nav className="mb-8 flex items-center gap-2 text-body text-neutral-500">
          <Link href="/courses" className="hover:text-neutral-700">
            All Courses
          </Link>
          <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          <span className="text-neutral-900">{course.title}</span>
        </nav>

        {/* Hero */}
        <div className="flex flex-col gap-8 lg:flex-row lg:gap-12">
          <div
            aria-hidden
            className="flex aspect-square w-full max-w-[288px] shrink-0 items-center justify-center rounded-[var(--radius-lg)] bg-neutral-900 text-white lg:w-72"
          >
            <span className="font-display text-[6rem] leading-none font-bold">
              {monogram}
            </span>
          </div>

          <div className="min-w-0 flex-1">
            {course.popular && (
              <span className="mb-4 inline-flex items-center rounded-[4px] bg-primary-100 px-2 py-0.5 text-small font-semibold uppercase tracking-wide text-primary-500">
                Popular
              </span>
            )}
            <h1 className="mb-4 font-display text-display-1 text-neutral-900">
              {course.title}
            </h1>
            {course.summary && (
              <p className="mb-6 max-w-2xl text-body-lg text-neutral-500">
                {course.summary}
              </p>
            )}

            <div className="mb-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-neutral-500">
              {course.level && (
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" strokeWidth={2} />
                  {capitalize(course.level)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" strokeWidth={2} />
                {totalDurationLabel}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <FileText className="h-4 w-4" strokeWidth={2} />
                {moduleCount} modules
              </span>
              {course.studentCount != null && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" strokeWidth={2} />
                  {formatCompactCount(course.studentCount)} students
                </span>
              )}
            </div>

            <CourseActions
              continueHref={continueHref}
              courseId={course._id}
              courseSlug={slug}
              courseTitle={course.title ?? ""}
              initialBookmarked={courseBookmarked}
            />
          </div>
        </div>

        {/* What you'll learn */}
        <div className="mt-12">
          <LearnGrid outcomes={outcomes} />
        </div>

        {/* Course content */}
        <CourseContent
          modules={contentModules}
          totalDurationLabel={totalDurationLabel}
        />
      </Container>

      <CourseProgressBar continueHref={continueHref} percent={percentComplete} />
    </div>
  );
}
