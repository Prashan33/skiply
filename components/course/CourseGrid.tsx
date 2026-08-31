import Link from "next/link";
import { CourseCard } from "@/components/ui/Card";
import type { CATALOG_COURSES_QUERY_RESULT } from "@/sanity.types";
import { urlFor } from "@/sanity/lib/image";
import { capitalize, formatDurationFromSeconds } from "@/lib/format";

type CatalogCourse = CATALOG_COURSES_QUERY_RESULT[number];

function coverImage(course: CatalogCourse) {
  if (!course.coverImage?.asset) return undefined;
  return {
    url: urlFor(course.coverImage)
      .width(800)
      .height(450)
      .fit("crop")
      .auto("format")
      .url(),
    alt: course.coverImage.alt || course.title || "Course cover image",
  };
}

/**
 * The catalog card grid, shared by the homepage "All Courses" section and the
 * `/courses` index. Each card links to its course detail page.
 */
export function CourseGrid({
  courses,
}: {
  courses: CATALOG_COURSES_QUERY_RESULT;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {courses.map((course) => {
        const image = coverImage(course);
        const card = (
          <CourseCard
            image={image}
            icon={
              image ? undefined : (
                <span className="font-display text-body font-bold">
                  {(course.title ?? "?").trim().charAt(0).toUpperCase()}
                </span>
              )
            }
            iconClassName="bg-neutral-900 text-white"
            title={course.title ?? "Untitled course"}
            description={course.summary ?? ""}
            level={capitalize(course.level)}
            duration={formatDurationFromSeconds(course.durationSeconds)}
            modules={`${course.moduleCount ?? 0} modules`}
          />
        );
        return course.slug ? (
          <Link key={course._id} href={`/courses/${course.slug}`}>
            {card}
          </Link>
        ) : (
          <div key={course._id}>{card}</div>
        );
      })}
    </div>
  );
}
