import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SearchLauncher } from "@/components/search/SearchLauncher";
import { TopNav } from "@/components/ui/Navigation";
import { CourseGrid } from "@/components/course/CourseGrid";
import { getCatalogCourses } from "@/sanity/lib/fetch";

function SkylineDecoration() {
  const heights = [40, 80, 56, 96, 64, 32, 88, 48, 72, 100, 56, 40, 84, 60];
  return (
    <div className="flex h-40 items-end justify-center gap-3 overflow-hidden px-6">
      {heights.map((h, i) => (
        <div
          key={i}
          className="w-10 rounded-t-[var(--radius-sm)] bg-gradient-to-b from-primary-300 to-primary-100"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

export default async function Home() {
  const courses = (await getCatalogCourses()).slice(0, 6);

  return (
    <div className="flex-1 bg-neutral-50">
      <TopNav showActions />

      <Container as="section" className="pt-20 pb-16 text-center">
        <div className="mx-auto max-w-2xl">
          <span className="mb-6 inline-flex items-center rounded-full border border-primary-200 bg-primary-100 px-3 py-1 text-small font-semibold uppercase tracking-wide text-primary-500">
            Intelligent Learning
          </span>
          <h1 className="mb-6 font-display text-display-1 text-neutral-900">
            Search your learning in plain English.
          </h1>
          <p className="mx-auto mb-8 max-w-xl text-body-lg text-neutral-500">
            Skiply understands what you want to learn and finds the exact
            lessons across all your courses.
          </p>
          <Link
            href="/courses"
            className="mb-10 inline-flex h-11 items-center justify-center gap-1.5 rounded-[var(--radius-md)] bg-primary-500 px-4 text-body font-medium text-white transition-colors hover:bg-primary-400"
          >
            Explore Courses
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Link>
          <SearchLauncher className="h-14 rounded-[var(--radius-lg)] text-body-lg shadow-[var(--shadow-sm)]" />
        </div>
      </Container>

      <section className="border-t border-neutral-200">
        <Container className="py-14">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-heading-1 text-neutral-900">
              All Courses
            </h2>
            <Link
              href="/courses"
              className="inline-flex items-center gap-1 text-body font-medium text-primary-500 hover:text-primary-400"
            >
              View all courses
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
          <CourseGrid courses={courses} />
        </Container>
      </section>

      <Container as="section" className="pt-6">
        <div className="mx-auto flex max-w-3xl items-center gap-4">
          <span className="h-px flex-1 bg-neutral-200" />
          <span className="inline-flex items-center gap-2 whitespace-nowrap text-body text-neutral-500">
            <Star className="h-4 w-4 text-primary-500" strokeWidth={2} />
            New courses and lessons added every week.
          </span>
          <span className="h-px flex-1 bg-neutral-200" />
        </div>
        <SkylineDecoration />
      </Container>
    </div>
  );
}
