import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { BarChart3, Bookmark, ChevronRight, Clock, Users } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { TopNav } from "@/components/ui/Navigation";
import { Badge } from "@/components/ui/Badge";
import { LessonVideo } from "@/components/lesson/LessonVideo";
import { LessonTabs } from "@/components/lesson/LessonTabs";
import { LessonNotesContent } from "@/components/lesson/LessonNotesContent";
import {
  LessonSidebar,
  type SidebarModule,
} from "@/components/lesson/LessonSidebar";
import { LessonNav, type NavLesson } from "@/components/lesson/LessonNav";
import { LESSON_BY_SLUG_QUERY, LESSON_SLUGS_QUERY } from "@/sanity/lib/queries";
import { getReadClient } from "@/sanity/lib/fetch";
import { urlFor } from "@/sanity/lib/image";
import { getPostHogClient } from "@/lib/posthog-server";
import { capitalize, formatClock, formatDurationFromSeconds } from "@/lib/format";
import { parseStartSeconds } from "@/lib/video";

export const dynamicParams = true;

function getLessonBySlug(slug: string) {
  return getReadClient().fetch(
    LESSON_BY_SLUG_QUERY,
    { slug },
    { next: { revalidate: 60, tags: ["lesson", `lesson:${slug}`] } },
  );
}

export async function generateStaticParams() {
  const slugs = await getReadClient().fetch(LESSON_SLUGS_QUERY);
  return slugs
    .filter((s): s is { slug: string } => Boolean(s.slug))
    .map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const lesson = await getLessonBySlug(slug);
  if (!lesson) return {};
  return {
    title: lesson.title ? `${lesson.title} — Skiply` : "Skiply",
    description: lesson.summary || undefined,
  };
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const [lesson, { userId }] = await Promise.all([getLessonBySlug(slug), auth()]);

  if (!lesson) notFound();

  const course = lesson.course;
  const modules = course?.modules ?? [];

  // Flatten lessons in authored order to derive labels, neighbours, progress.
  const flat = modules.flatMap((m, mi) =>
    (m.lessons ?? []).map((l, li) => ({
      id: l._id,
      title: l.title ?? "Untitled lesson",
      slug: l.slug,
      clock: formatClock(l.duration),
      moduleIndex: mi,
      lessonIndex: li,
    })),
  );

  const currentIndex = flat.findIndex((l) => l.id === lesson._id);
  const activeModuleIndex = currentIndex >= 0 ? flat[currentIndex].moduleIndex : 0;
  const lessonInModuleIndex = currentIndex >= 0 ? flat[currentIndex].lessonIndex : 0;
  const lessonLabel = `Lesson ${activeModuleIndex + 1}.${lessonInModuleIndex + 1}`;
  const moduleLabel = `Module ${activeModuleIndex + 1} of ${modules.length || 1}`;
  const activeModuleTitle = modules[activeModuleIndex]?.title ?? null;

  const previous: NavLesson | null =
    currentIndex > 0
      ? {
          title: flat[currentIndex - 1].title,
          slug: flat[currentIndex - 1].slug,
          clock: flat[currentIndex - 1].clock,
        }
      : null;
  const next: NavLesson | null =
    currentIndex >= 0 && currentIndex < flat.length - 1
      ? {
          title: flat[currentIndex + 1].title,
          slug: flat[currentIndex + 1].slug,
          clock: flat[currentIndex + 1].clock,
        }
      : null;

  // Placeholder progress — no per-learner backend yet (see LessonSidebar).
  const percentComplete =
    flat.length > 0 && currentIndex >= 0
      ? Math.round((currentIndex / flat.length) * 100)
      : 0;

  const sidebarModules: SidebarModule[] = modules.map((m, mi) => {
    const lessons = (m.lessons ?? []).map((l) => {
      const flatIdx = flat.findIndex((f) => f.id === l._id);
      const status =
        flatIdx === currentIndex
          ? ("active" as const)
          : flatIdx >= 0 && flatIdx < currentIndex
            ? ("done" as const)
            : ("upcoming" as const);
      return {
        id: l._id,
        title: l.title ?? "Untitled lesson",
        slug: l.slug,
        clock: formatClock(l.duration),
        status,
      };
    });
    const moduleSeconds = (m.lessons ?? []).reduce((s, l) => s + (l.duration ?? 0), 0);
    return {
      key: m._key,
      title: m.title ?? "Untitled module",
      durationLabel: formatDurationFromSeconds(moduleSeconds),
      lessons,
      completed: mi < activeModuleIndex,
      hasActive: mi === activeModuleIndex,
    };
  });

  const courseTitle = course?.title ?? "Course";
  const monogram = courseTitle.trim().charAt(0).toUpperCase() || "?";

  const posterUrl = lesson.poster?.asset
    ? urlFor(lesson.poster).width(1280).height(720).fit("crop").url()
    : null;
  const poster = posterUrl
    ? { url: posterUrl, alt: lesson.poster?.alt || lesson.title || "" }
    : null;

  const startSeconds = parseStartSeconds(sp.t ?? sp.start, lesson.duration);

  const studentCount =
    typeof lesson.studentCount === "number"
      ? lesson.studentCount.toLocaleString("en-US")
      : null;

  // Server-side engagement events (mirror the course page).
  const posthog = getPostHogClient();
  if (posthog) {
    const distinctId = userId ?? "anonymous";
    posthog.capture({
      distinctId,
      event: "lesson_viewed",
      properties: {
        lesson_slug: slug,
        lesson_title: lesson.title ?? undefined,
        course_slug: course?.slug ?? undefined,
        course_title: course?.title ?? undefined,
        module_label: moduleLabel,
        is_free_preview: Boolean(lesson.freePreview),
      },
    });
    // Arrived at a specific second — a search "watch from" jump or a shared deep link.
    if (startSeconds > 0) {
      const ref = Array.isArray(sp.ref) ? sp.ref[0] : sp.ref;
      posthog.capture({
        distinctId,
        event: "lesson_resumed",
        properties: {
          lesson_slug: slug,
          course_slug: course?.slug ?? undefined,
          start_seconds: startSeconds,
          source: ref === "search" ? "search" : "deep_link",
        },
      });
    }
    await posthog.flush();
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <TopNav showActions />

      <Container as="main" className="flex-1 pt-8 pb-16">
        <div className="lg:grid lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-12">
          {/* Sidebar */}
          <aside className="mb-10 lg:mb-0">
            <div className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto lg:pr-2">
              <LessonSidebar
                courseTitle={courseTitle}
                courseSlug={course?.slug ?? null}
                monogram={monogram}
                percentComplete={percentComplete}
                activeModuleLabel={moduleLabel}
                modules={sidebarModules}
              />
            </div>
          </aside>

          {/* Main column */}
          <div className="min-w-0">
            {/* Breadcrumbs */}
            <nav className="mb-6 flex flex-wrap items-center gap-2 text-body text-neutral-500">
              <Link href="/courses" className="hover:text-neutral-700">
                All Courses
              </Link>
              {course?.slug && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  <Link
                    href={`/courses/${course.slug}`}
                    className="hover:text-neutral-700"
                  >
                    {courseTitle}
                  </Link>
                </>
              )}
              {activeModuleTitle && (
                <>
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
                  <span>{activeModuleTitle}</span>
                </>
              )}
              <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              <span className="text-neutral-900">{lesson.title}</span>
            </nav>

            {/* Title block */}
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex items-center gap-2">
                  <Badge variant="lesson">{lessonLabel}</Badge>
                  {lesson.freePreview && <Badge variant="lesson">Free</Badge>}
                </div>
                <h1 className="font-display text-display-1 text-neutral-900">
                  {lesson.title}
                </h1>
                {lesson.summary && (
                  <p className="mt-3 max-w-2xl text-body-lg text-neutral-500">
                    {lesson.summary}
                  </p>
                )}
              </div>
              <button
                type="button"
                aria-label="Save lesson"
                title="Save lesson"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-neutral-200 text-neutral-500 hover:border-neutral-300 hover:text-neutral-700"
              >
                <Bookmark className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            {/* Meta row */}
            <div className="mt-5 mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-small text-neutral-500">
              <span className="inline-flex items-center gap-1.5">
                <Clock className="h-4 w-4" strokeWidth={2} />
                {formatDurationFromSeconds(lesson.duration)}
              </span>
              {course?.level && (
                <span className="inline-flex items-center gap-1.5">
                  <BarChart3 className="h-4 w-4" strokeWidth={2} />
                  {capitalize(course.level)}
                </span>
              )}
              {studentCount && (
                <span className="inline-flex items-center gap-1.5">
                  <Users className="h-4 w-4" strokeWidth={2} />
                  {studentCount} students
                </span>
              )}
            </div>

            {/* Video */}
            <LessonVideo
              videoUrl={lesson.videoUrl}
              startSeconds={startSeconds}
              title={lesson.title ?? "Lesson video"}
              poster={poster}
              monogram={monogram}
              lessonSlug={slug}
              courseSlug={course?.slug ?? null}
            />

            {/* Tabs */}
            <div className="mt-8">
              <LessonTabs
                lessonSlug={slug}
                content={
                  <LessonNotesContent
                    notes={lesson.notes}
                    keyPoints={lesson.keyPoints}
                    proTip={lesson.proTip}
                    resources={lesson.resources}
                    lessonSlug={slug}
                  />
                }
                notes={
                  <div className="rounded-[var(--radius-md)] border border-dashed border-neutral-200 bg-white p-8 text-center">
                    <p className="text-body font-medium text-neutral-700">
                      Your notes for this lesson will appear here.
                    </p>
                    <p className="mt-1 text-small text-neutral-500">
                      Note-taking is coming soon.
                    </p>
                  </div>
                }
              />
            </div>
          </div>
        </div>
      </Container>

      <LessonNav previous={previous} next={next} />
    </div>
  );
}
