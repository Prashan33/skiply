"use client";

import { type ReactNode, useState } from "react";
import posthog from "posthog-js";
import { cn } from "@/lib/cn";

type TabKey = "content" | "notes";

export function LessonTabs({
  content,
  notes,
  lessonSlug,
}: {
  content: ReactNode;
  notes: ReactNode;
  lessonSlug: string;
}) {
  const [active, setActive] = useState<TabKey>("content");

  const tab = (key: TabKey, label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={active === key}
      onClick={() => {
        setActive(key);
        posthog.capture("lesson_tab_changed", { lesson_slug: lessonSlug, tab: key });
      }}
      className={cn(
        "-mb-px border-b-2 px-1 pb-3 text-body font-medium transition-colors",
        active === key
          ? "border-primary-500 text-primary-500"
          : "border-transparent text-neutral-500 hover:text-neutral-700",
      )}
    >
      {label}
    </button>
  );

  return (
    <div>
      <div role="tablist" className="flex items-center gap-8 border-b border-neutral-200">
        {tab("content", "Lesson Content")}
        {tab("notes", "Notes")}
      </div>
      <div role="tabpanel" className="pt-8">
        {active === "content" ? content : notes}
      </div>
    </div>
  );
}
