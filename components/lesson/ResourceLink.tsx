"use client";

import type { ReactNode } from "react";
import posthog from "posthog-js";

/**
 * Lesson resource link with a `lesson_resource_clicked` capture. Only the
 * resource `type` enum is sent — no title, URL, or other free text.
 */
export function ResourceLink({
  href,
  resourceType,
  lessonSlug,
  className,
  children,
}: {
  href: string | undefined;
  resourceType: string | null | undefined;
  lessonSlug: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      onClick={() =>
        posthog.capture("lesson_resource_clicked", {
          lesson_slug: lessonSlug,
          resource_type: resourceType ?? "link",
        })
      }
    >
      {children}
    </a>
  );
}
