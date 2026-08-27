import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "./Logo";

export function TopNav({ links = ["Courses", "My Learning"] }: { links?: string[] }) {
  return (
    <nav className="flex items-center justify-between border-b border-neutral-200 bg-white px-6 py-4">
      <Logo />
      <div className="flex items-center gap-6">
        {links.map((link) => (
          <a
            key={link}
            href="#"
            className="text-body font-medium text-neutral-700 hover:text-neutral-900"
          >
            {link}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function Breadcrumbs({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-2 text-body text-neutral-500">
      {items.map((item, i) => (
        <span key={item} className="flex items-center gap-2">
          <span
            className={cn(i === items.length - 1 && "text-neutral-900")}
          >
            {item}
          </span>
          {i < items.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          )}
        </span>
      ))}
    </nav>
  );
}

export function Pagination({
  page,
  totalPages,
}: {
  page: number;
  totalPages: number;
}) {
  const pages = [1, 2, 3, "…", totalPages];
  return (
    <nav className="flex items-center gap-1 text-body">
      <button
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        disabled={page === 1}
        aria-label="Previous page"
      >
        <ChevronRight className="h-4 w-4 rotate-180" strokeWidth={2} />
      </button>
      {pages.map((p, i) => (
        <span
          key={i}
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)]",
            p === page
              ? "border border-primary-500 text-primary-500"
              : typeof p === "number"
                ? "text-neutral-700 hover:bg-neutral-100"
                : "text-neutral-300",
          )}
        >
          {p}
        </span>
      ))}
      <button
        className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] text-neutral-500 hover:bg-neutral-100 disabled:opacity-40"
        disabled={page === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="h-4 w-4" strokeWidth={2} />
      </button>
    </nav>
  );
}
