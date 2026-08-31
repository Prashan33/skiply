import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";

import { Container } from "@/components/ui/Container";
import { TopNav } from "@/components/ui/Navigation";
import { SearchResults } from "@/components/search/SearchResults";
import { getSearchIndex } from "@/sanity/lib/fetch";
import { urlFor } from "@/sanity/lib/image";
import { getPostHogClient } from "@/lib/posthog-server";
import { formatClock } from "@/lib/format";
import type { SearchIndex, SearchIndexLesson } from "@/lib/search";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}): Promise<Metadata> {
  const q = normalizeQuery((await searchParams).q);
  return {
    title: q ? `Results for “${q}” — Skiply` : "Search — Skiply",
    description: "Search every course and lesson on Skiply in plain English.",
  };
}

function normalizeQuery(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().slice(0, 200);
}

/** Flatten the course → module → lesson index into a slug-keyed lookup with derived labels. */
function buildIndex(courses: Awaited<ReturnType<typeof getSearchIndex>>): SearchIndex {
  const index: SearchIndex = {};

  for (const course of courses) {
    const courseTitle = course.courseTitle ?? "Untitled course";
    const courseSlug = course.courseSlug ?? "";
    const courseMonogram = courseTitle.trim().charAt(0).toUpperCase() || "?";
    const modules = course.modules ?? [];

    modules.forEach((mod, moduleIdx) => {
      const moduleTitle = mod.title ?? "Untitled module";
      const lessons = mod.lessons ?? [];

      lessons.forEach((lesson, lessonIdx) => {
        const lessonSlug = lesson.lessonSlug;
        if (!lessonSlug || index[lessonSlug]) return;

        const posterUrl = lesson.poster?.asset
          ? urlFor(lesson.poster).width(480).height(270).fit("crop").url()
          : null;

        const entry: SearchIndexLesson = {
          lessonSlug,
          lessonTitle: lesson.lessonTitle ?? "Untitled lesson",
          lessonLabel: `Lesson ${moduleIdx + 1}.${lessonIdx + 1}`,
          moduleLabel: `Module ${moduleIdx + 1}`,
          moduleTitle,
          courseTitle,
          courseSlug,
          courseMonogram,
          keyPoints: (lesson.keyPoints ?? []).filter(Boolean).slice(0, 3),
          durationClock: formatClock(lesson.duration),
          posterUrl,
        };
        index[lessonSlug] = entry;
      });
    });
  }

  return index;
}

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const [sp, courses, { userId }] = await Promise.all([
    searchParams,
    getSearchIndex(),
    auth(),
  ]);
  const query = normalizeQuery(sp.q);
  const index = buildIndex(courses);

  const posthog = getPostHogClient();
  if (posthog) {
    posthog.capture({
      distinctId: userId ?? "anonymous",
      event: "search_page_viewed",
      properties: { query: query || null },
    });
    await posthog.flush();
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <TopNav showActions />
      <Container as="main" className="flex-1 pt-10 pb-16">
        <SearchResults initialQuery={query} index={index} />
      </Container>
    </div>
  );
}
