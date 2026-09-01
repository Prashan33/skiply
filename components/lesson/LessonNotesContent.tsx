import Image from "next/image";
import {
  PortableText,
  type PortableTextComponents,
} from "@portabletext/react";
import {
  CheckCircle2,
  Code2,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Link2,
} from "lucide-react";
import { urlFor } from "@/sanity/lib/image";
import { ResourceLink } from "@/components/lesson/ResourceLink";
import type { LESSON_BY_SLUG_QUERY_RESULT } from "@/sanity.types";

type Lesson = NonNullable<LESSON_BY_SLUG_QUERY_RESULT>;
type Notes = NonNullable<Lesson["notes"]>;
type Resource = NonNullable<Lesson["resources"]>[number];

const portableComponents: PortableTextComponents = {
  block: {
    h2: ({ children }) => (
      <h3 className="mt-10 mb-3 font-display text-heading-2 text-neutral-900 first:mt-0">
        {children}
      </h3>
    ),
    h3: ({ children }) => (
      <h4 className="mt-8 mb-2 font-display text-heading-3 text-neutral-900">
        {children}
      </h4>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-4 border-l-2 border-primary-300 pl-4 text-body-lg text-neutral-500 italic">
        {children}
      </blockquote>
    ),
    normal: ({ children }) => (
      <p className="mb-4 text-body-lg leading-relaxed text-neutral-500">{children}</p>
    ),
  },
  list: {
    bullet: ({ children }) => <ul className="mb-4 space-y-2">{children}</ul>,
    number: ({ children }) => (
      <ol className="mb-4 list-decimal space-y-2 pl-5 text-body-lg text-neutral-500">
        {children}
      </ol>
    ),
  },
  listItem: {
    bullet: ({ children }) => (
      <li className="flex gap-2.5 text-body-lg text-neutral-500">
        <span
          aria-hidden
          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500"
        />
        <span>{children}</span>
      </li>
    ),
    number: ({ children }) => <li className="text-body-lg text-neutral-500">{children}</li>,
  },
  marks: {
    strong: ({ children }) => (
      <strong className="font-semibold text-neutral-700">{children}</strong>
    ),
    em: ({ children }) => <em>{children}</em>,
    link: ({ children, value }) => (
      <a
        href={value?.href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-500 underline underline-offset-2 hover:text-primary-400"
      >
        {children}
      </a>
    ),
  },
  types: {
    image: ({ value }) => {
      if (!value?.asset) return null;
      const src = urlFor(value).width(1200).fit("max").auto("format").url();
      return (
        <span className="my-6 block overflow-hidden rounded-[var(--radius-md)] border border-neutral-200">
          <Image
            src={src}
            alt={value.alt || ""}
            width={1200}
            height={675}
            className="h-auto w-full"
            sizes="(min-width: 1024px) 720px, 100vw"
          />
        </span>
      );
    },
  },
};

function resourceIcon(type: Resource["type"]) {
  switch (type) {
    case "code":
      return Code2;
    case "download":
      return Download;
    case "documentation":
      return FileText;
    default:
      return Link2;
  }
}

export function LessonNotesContent({
  notes,
  keyPoints,
  proTip,
  resources,
  lessonSlug,
}: {
  notes: Notes | null;
  keyPoints: string[] | null;
  proTip: string | null;
  resources: Resource[] | null;
  lessonSlug: string;
}) {
  const points = keyPoints ?? [];
  const items = (resources ?? []).filter((r) => r.url);

  return (
    <div>
      <h2 className="mb-4 font-display text-heading-1 text-neutral-900">Overview</h2>

      {notes && notes.length > 0 && (
        <div className="max-w-2xl">
          <PortableText value={notes} components={portableComponents} />
        </div>
      )}

      {points.length > 0 && (
        <div className="mt-10 border-t border-neutral-200 pt-8">
          <h3 className="mb-4 text-heading-3 font-medium text-neutral-900">
            In this lesson you will:
          </h3>
          <ul className="space-y-3">
            {points.map((point) => (
              <li key={point} className="flex items-start gap-3 text-body text-neutral-700">
                <CheckCircle2
                  className="mt-0.5 h-4 w-4 shrink-0 text-primary-500"
                  strokeWidth={2}
                />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {proTip && (
        <div className="mt-8 flex gap-3 rounded-[var(--radius-md)] bg-primary-100 p-5">
          <Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-primary-500" strokeWidth={2} />
          <div>
            <p className="mb-1 text-body font-semibold text-neutral-900">Pro Tip</p>
            <p className="text-body text-neutral-700">{proTip}</p>
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-10 border-t border-neutral-200 pt-8">
          <h3 className="mb-4 text-heading-1 font-display text-neutral-900">Resources</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((resource) => {
              const Icon = resourceIcon(resource.type);
              return (
                <ResourceLink
                  key={resource._key}
                  href={resource.url ?? undefined}
                  resourceType={resource.type}
                  lessonSlug={lessonSlug}
                  className="group flex flex-col rounded-[var(--radius-md)] border border-neutral-200 bg-white p-4 shadow-[var(--shadow-sm)] transition-colors hover:border-neutral-300"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <span className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-sm)] bg-neutral-100 text-neutral-700">
                      <Icon className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <ExternalLink
                      className="h-3.5 w-3.5 text-neutral-300 group-hover:text-neutral-500"
                      strokeWidth={2}
                    />
                  </div>
                  <p className="mb-1 text-body font-medium text-neutral-900">
                    {resource.title}
                  </p>
                  {resource.description && (
                    <p className="text-small leading-relaxed text-neutral-500">
                      {resource.description}
                    </p>
                  )}
                </ResourceLink>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
