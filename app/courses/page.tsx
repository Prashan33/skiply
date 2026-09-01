import type { Metadata } from "next";
import { auth } from "@clerk/nextjs/server";
import { Container } from "@/components/ui/Container";
import { TopNav } from "@/components/ui/Navigation";
import { CourseGrid } from "@/components/course/CourseGrid";
import { getCatalogCourses } from "@/sanity/lib/fetch";
import { getPostHogClient } from "@/lib/posthog-server";

export const metadata: Metadata = {
  title: "All Courses — Skiply",
  description: "Browse every course on Skiply.",
};

export default async function CoursesPage() {
  const [courses, { userId }] = await Promise.all([getCatalogCourses(), auth()]);

  // Catalog funnel-top, mirroring `course_viewed` on the detail page.
  const posthog = getPostHogClient();
  if (posthog) {
    posthog.capture({
      distinctId: userId ?? "anonymous",
      event: "catalog_viewed",
      properties: { course_count: courses.length },
    });
    await posthog.flush();
  }

  return (
    <div className="flex flex-1 flex-col bg-neutral-50">
      <TopNav showActions />

      <Container as="main" className="flex-1 pt-10 pb-16">
        <div className="mb-6 flex items-end justify-between gap-4">
          <h1 className="font-display text-heading-1 text-neutral-900">
            All Courses
          </h1>
          <span className="whitespace-nowrap text-body text-neutral-500">
            {courses.length} {courses.length === 1 ? "course" : "courses"}
          </span>
        </div>

        <CourseGrid courses={courses} />
      </Container>
    </div>
  );
}
