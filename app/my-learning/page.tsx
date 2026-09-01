import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { Container } from "@/components/ui/Container";
import { TopNav } from "@/components/ui/Navigation";
import { CourseGrid } from "@/components/course/CourseGrid";
import { getBookmarkedCourses, getProgressForUser } from "@/sanity/lib/fetch";

export const metadata: Metadata = {
  title: "My Learning — Skiply",
  description: "The courses you've bookmarked on Skiply.",
};

/**
 * My Learning is driven by the learner's bookmarks (AGENTS.md §7 — it reads
 * per-learner progress state for display). It lists the courses a learner has
 * bookmarked directly plus the parent course of any bookmarked lesson,
 * de-duplicated. Bookmarks are written only by `POST /api/bookmarks`.
 */
export default async function MyLearningPage() {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in");

  const progress = await getProgressForUser(userId);
  const bookmarks = progress?.bookmarks ?? [];
  const courseIds = bookmarks
    .filter((b) => b?.kind === "course" && b.refId)
    .map((b) => b.refId as string);
  const lessonIds = bookmarks
    .filter((b) => b?.kind === "lesson" && b.refId)
    .map((b) => b.refId as string);

  const courses =
    courseIds.length || lessonIds.length
      ? await getBookmarkedCourses(userId, courseIds, lessonIds)
      : [];

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <TopNav showActions activeLink="My Learning" />

      <Container as="main" className="flex-1 pt-10 pb-16">
        <div className="mb-6">
          <h1 className="font-display text-heading-1 text-neutral-900">
            My Learning
          </h1>
          <p className="mt-1 text-body text-neutral-500">
            Your bookmarked courses.
          </p>
        </div>

        {courses.length === 0 ? (
          <div className="rounded-[var(--radius-md)] border border-neutral-200 bg-white px-6 py-16 text-center">
            <p className="text-body text-neutral-700">
              You haven&apos;t bookmarked anything yet.
            </p>
            <p className="mt-1 text-small text-neutral-500">
              Bookmark a course or lesson and it&apos;ll show up here.
            </p>
            <Link
              href="/courses"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-[var(--radius-md)] bg-primary-500 px-4 text-body font-medium text-white transition-colors hover:bg-primary-400"
            >
              Browse courses
            </Link>
          </div>
        ) : (
          <CourseGrid courses={courses} />
        )}
      </Container>
    </div>
  );
}
