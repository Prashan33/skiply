"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useObject } from "@ai-sdk/react";
import { ArrowRight, Search, SearchX } from "lucide-react";
import posthog from "posthog-js";

import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ResultCard } from "@/components/search/ResultCard";
import {
  groundResults,
  searchResponseSchema,
  type GroundedResult,
  type SearchIndex,
} from "@/lib/search";

type SortKey = "relevant" | "course" | "lesson";

const SECONDARY_LINK =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-[var(--radius-md)] border border-primary-500 bg-white px-4 text-body font-medium text-primary-500 transition-colors hover:bg-primary-100";

export function SearchResults({
  initialQuery,
  index,
}: {
  initialQuery: string;
  index: SearchIndex;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const [inputValue, setInputValue] = useState(initialQuery);
  const [submittedQuery, setSubmittedQuery] = useState(initialQuery.trim());
  const [hasSubmitted, setHasSubmitted] = useState(Boolean(initialQuery.trim()));
  const [sort, setSort] = useState<SortKey>("relevant");

  // The query of the request currently in flight — read inside `onFinish`, which
  // must not depend on render-time state.
  const inFlightQueryRef = useRef<string>(initialQuery.trim());

  const { object, submit, isLoading, error } = useObject({
    api: "/api/search",
    schema: searchResponseSchema,
    onFinish({ object: finalObject, error: finishError }) {
      if (finishError) return;
      const results = groundResults(finalObject?.results, index);
      const courses = new Set(results.map((r) => r.courseSlug)).size;
      posthog.capture("search_results_returned", {
        query: inFlightQueryRef.current,
        result_count: results.length,
        course_count: courses,
        has_results: results.length > 0,
      });
    },
  });

  // Join the model's slugs against the Sanity-derived index. Anything not in the
  // index (a hallucinated or stale slug) is dropped here.
  const grounded = useMemo<GroundedResult[]>(
    () => groundResults(object?.results, index),
    [object, index],
  );

  const sorted = useMemo(() => {
    if (sort === "relevant") return grounded;
    const copy = [...grounded];
    if (sort === "course") {
      copy.sort(
        (a, b) =>
          a.courseTitle.localeCompare(b.courseTitle) ||
          a.lessonLabel.localeCompare(b.lessonLabel, undefined, { numeric: true }),
      );
    } else {
      copy.sort((a, b) => a.lessonTitle.localeCompare(b.lessonTitle));
    }
    return copy;
  }, [grounded, sort]);

  const count = grounded.length;
  const courseCount = useMemo(
    () => new Set(grounded.map((r) => r.courseSlug)).size,
    [grounded],
  );

  const errored = Boolean(error);

  function runSearch(raw: string) {
    const q = raw.trim().slice(0, 200);
    if (!q) return;
    setSubmittedQuery(q);
    setHasSubmitted(true);
    inFlightQueryRef.current = q;
    router.replace(`/search?q=${encodeURIComponent(q)}`, { scroll: false });
    submit({ query: q, source: "new_search" });
  }

  // Run once on load when arriving with ?q= (state is already seeded from the
  // prop; this only kicks off the request).
  useEffect(() => {
    const q = initialQuery.trim().slice(0, 200);
    if (q) {
      inFlightQueryRef.current = q;
      submit({ query: q, source: "initial_load" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ⌘K / Ctrl-K focuses the search box (design shows the hint).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // `search_performed` is captured server-side (app/api/search/route.ts).
  // `search_results_returned` is captured in `useObject`'s `onFinish` above.

  const showToolbar = hasSubmitted && !errored;
  const showSkeleton = isLoading && count === 0;
  const showEmpty = hasSubmitted && !isLoading && !errored && count === 0;

  return (
    <div className="mx-auto max-w-4xl">
      {/* Header */}
      <div className="text-center">
        <span className="text-small font-semibold uppercase tracking-wide text-primary-500">
          Search Results
        </span>
        <h1 className="mt-3 font-display text-display-2 text-neutral-900 sm:text-display-1">
          {submittedQuery ? (
            <>
              Results for{" "}
              <span className="text-primary-500">“{submittedQuery}”</span>
            </>
          ) : (
            "Search your learning"
          )}
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-body-lg text-neutral-500">
          {errored
            ? "Search is unavailable right now."
            : !hasSubmitted
              ? "Find the exact lesson across every course."
              : isLoading && count === 0
                ? "Searching…"
                : `Found ${count} result${count === 1 ? "" : "s"} across ${courseCount} course${courseCount === 1 ? "" : "s"}`}
        </p>
      </div>

      {/* Search box */}
      <form
        className="mx-auto mt-8 max-w-2xl"
        onSubmit={(e) => {
          e.preventDefault();
          runSearch(inputValue);
        }}
      >
        <Input
          ref={inputRef}
          icon
          shortcut="⌘ K"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask anything about your learning..."
          aria-label="Search courses and lessons"
          className="h-14 rounded-[var(--radius-lg)] text-body-lg shadow-[var(--shadow-sm)]"
        />
      </form>

      {/* Toolbar */}
      {showToolbar ? (
        <div className="mt-10 flex flex-wrap items-center justify-between gap-3">
          <span className="text-body font-medium text-neutral-900">
            {count} {count === 1 ? "result" : "results"}
          </span>
          <label className="flex items-center gap-2 text-small text-neutral-500">
            <span className="sr-only">Sort by</span>
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="h-10 w-48"
            >
              <option value="relevant">Most Relevant</option>
              <option value="course">Course name</option>
              <option value="lesson">Lesson title</option>
            </Select>
          </label>
        </div>
      ) : null}

      {/* Body */}
      <div className="mt-6 space-y-4">
        {errored ? (
          <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-8 text-center shadow-[var(--shadow-sm)]">
            <p className="text-body font-medium text-neutral-900">
              Search is unavailable right now.
            </p>
            <p className="mt-1 text-small text-neutral-500">
              Please try again in a moment, or browse the full catalog.
            </p>
            <Link href="/courses" className={`${SECONDARY_LINK} mt-4`}>
              Browse all courses
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        ) : showSkeleton ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-[var(--radius-md)] border border-neutral-200 bg-white"
            />
          ))
        ) : showEmpty ? (
          <div className="rounded-[var(--radius-md)] border border-dashed border-neutral-300 bg-white p-10 text-center">
            <SearchX
              className="mx-auto h-8 w-8 text-neutral-300"
              strokeWidth={1.5}
            />
            <p className="mt-3 text-body font-medium text-neutral-900">
              No results for “{submittedQuery}”
            </p>
            <p className="mt-1 text-small text-neutral-500">
              Try different keywords, or browse the full course catalog.
            </p>
          </div>
        ) : (
          sorted.map((result, i) => (
            <ResultCard
              key={result.lessonSlug}
              result={result}
              onSelect={() =>
                posthog.capture("search_result_opened", {
                  query: submittedQuery,
                  result_type: result.kind,
                  lesson_slug: result.lessonSlug,
                  course_slug: result.courseSlug,
                  rank: i + 1,
                  relevance: result.relevance,
                  start_seconds: result.startSeconds,
                  result_count: count,
                })
              }
            />
          ))
        )}
      </div>

      {/* Bottom CTA */}
      <div className="mt-10 flex flex-col items-center justify-between gap-4 rounded-[var(--radius-md)] border border-primary-200 bg-primary-100 p-6 sm:flex-row">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-primary-500">
            <Search className="h-5 w-5" strokeWidth={2} />
          </span>
          <div>
            <p className="text-body font-medium text-neutral-900">
              Can&rsquo;t find what you&rsquo;re looking for?
            </p>
            <p className="text-small text-neutral-500">
              Try different keywords or browse our full course catalog.
            </p>
          </div>
        </div>
        <Link href="/courses" className={SECONDARY_LINK}>
          Browse all courses
          <ArrowRight className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}
