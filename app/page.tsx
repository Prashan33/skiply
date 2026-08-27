import {
  Bell,
  Bookmark,
  BarChart3,
  Clock,
  FileText,
  Play,
  Search,
  User,
  ChevronRight,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Badge } from "@/components/ui/Badge";
import { StatusIndicator } from "@/components/ui/StatusIndicator";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { CourseCard, LessonCard, ResourceCard } from "@/components/ui/Card";
import { TopNav, Breadcrumbs, Pagination } from "@/components/ui/Navigation";

const colorSwatches = [
  { name: "Primary 500", value: "#F97316", className: "bg-primary-500" },
  { name: "Primary 400", value: "#FB923C", className: "bg-primary-400" },
  { name: "Primary 300", value: "#FDBA74", className: "bg-primary-300" },
  { name: "Primary 200", value: "#FED7AA", className: "bg-primary-200" },
  { name: "Primary 100", value: "#FFEEE5", className: "bg-primary-100" },
];

const neutralSwatches = [
  { name: "Neutral 900", value: "#0F172A", className: "bg-neutral-900" },
  { name: "Neutral 700", value: "#33415F", className: "bg-neutral-700" },
  { name: "Neutral 500", value: "#64748B", className: "bg-neutral-500" },
  { name: "Neutral 300", value: "#CBD5E1", className: "bg-neutral-300" },
  { name: "Neutral 200", value: "#E2E8F0", className: "bg-neutral-200" },
  { name: "Neutral 100", value: "#F1F5F9", className: "bg-neutral-100" },
  {
    name: "Neutral 50",
    value: "#FAFAFC",
    className: "bg-neutral-50 border border-neutral-200",
  },
  {
    name: "White",
    value: "#FFFFFF",
    className: "bg-white border border-neutral-200",
  },
];

const typeScale = [
  {
    style: "Display 1",
    font: "Playfair Display",
    size: "48 / 56",
    weight: "Bold",
    use: "Page titles",
  },
  {
    style: "Display 2",
    font: "Playfair Display",
    size: "36 / 44",
    weight: "Bold",
    use: "Section titles",
  },
  {
    style: "Heading 1",
    font: "Inter",
    size: "28 / 36",
    weight: "Semi Bold",
    use: "Card titles",
  },
  {
    style: "Heading 2",
    font: "Inter",
    size: "22 / 30",
    weight: "Semi Bold",
    use: "Sub section",
  },
  {
    style: "Heading 3",
    font: "Inter",
    size: "18 / 26",
    weight: "Medium",
    use: "Small titles",
  },
  {
    style: "Body Large",
    font: "Inter",
    size: "16 / 24",
    weight: "Regular",
    use: "Body copy",
  },
  {
    style: "Body",
    font: "Inter",
    size: "14 / 20",
    weight: "Regular",
    use: "Supporting text",
  },
  {
    style: "Small",
    font: "Inter",
    size: "12 / 16",
    weight: "Regular",
    use: "Captions, meta",
  },
];

const spacingScale = [4, 8, 12, 16, 24, 32, 40, 48, 64];

const radiusScale = [
  { label: "4px", sub: "xs", className: "rounded-[4px]" },
  { label: "8px", sub: "sm", className: "rounded-[8px]" },
  { label: "12px", sub: "md", className: "rounded-[12px]" },
  { label: "16px", sub: "lg", className: "rounded-[16px]" },
  { label: "24px", sub: "xl", className: "rounded-[24px]" },
  { label: "Full", sub: "circle", className: "rounded-full" },
];

const shadowScale = [
  { label: "Sm", value: "0 1px 2px 0", className: "shadow-[var(--shadow-sm)]" },
  {
    label: "Md",
    value: "0 4px 12px -2px",
    className: "shadow-[var(--shadow-md)]",
  },
  {
    label: "Lg",
    value: "0 12px 24px -4px",
    className: "shadow-[var(--shadow-lg)]",
  },
  {
    label: "Xl",
    value: "0 20px 40px -8px",
    className: "shadow-[var(--shadow-xl)]",
  },
];

const outlineIcons = [Bell, Search, Play, FileText, Bookmark, BarChart3, Clock, User];

function Section({
  number,
  title,
  children,
  className,
}: {
  number: string;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-md)] border border-neutral-200 bg-white p-6 ${className ?? ""}`}
    >
      <div className="mb-5 flex items-center gap-2">
        <span className="text-small font-semibold text-primary-500">
          {number}
        </span>
        <h2 className="text-small font-semibold uppercase tracking-wide text-neutral-500">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

export default function Home() {
  return (
    <div className="flex-1 bg-neutral-50">
      <div className="mx-auto max-w-[1100px] space-y-6 px-6 py-10">
        {/* Header */}
        <header className="rounded-[var(--radius-md)] border border-neutral-200 bg-white p-8">
          <Logo className="mb-6" />
          <h1 className="mb-3 font-display text-display-1 text-neutral-900">
            Design System
          </h1>
          <p className="max-w-xl text-body-lg text-neutral-500">
            A unified design language for the Skiply learning platform. Clean,
            modern and focused on clarity, consistency and intuitive learning
            experiences.
          </p>
          <p className="mt-4 text-small font-medium uppercase tracking-wide text-neutral-500">
            Version 1.0 &middot; August 2026
          </p>
        </header>

        {/* Colors */}
        <Section number="01" title="Colors">
          <p className="mb-3 text-body font-medium text-neutral-700">
            Primary
          </p>
          <div className="mb-6 flex flex-wrap gap-4">
            {colorSwatches.map((c) => (
              <div key={c.name} className="w-32">
                <div
                  className={`mb-2 h-16 w-full rounded-[var(--radius-sm)] ${c.className}`}
                />
                <p className="text-body text-neutral-900">{c.name}</p>
                <p className="text-small text-neutral-500">{c.value}</p>
              </div>
            ))}
          </div>
          <p className="mb-3 text-body font-medium text-neutral-700">
            Neutral
          </p>
          <div className="flex flex-wrap gap-4">
            {neutralSwatches.map((c) => (
              <div key={c.name} className="w-32">
                <div
                  className={`mb-2 h-16 w-full rounded-[var(--radius-sm)] ${c.className}`}
                />
                <p className="text-body text-neutral-900">{c.name}</p>
                <p className="text-small text-neutral-500">{c.value}</p>
              </div>
            ))}
          </div>
        </Section>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Typography */}
          <Section number="02" title="Typography">
            <div className="space-y-6">
              <div>
                <p className="font-display text-4xl font-bold text-neutral-900">
                  Ag
                </p>
                <p className="text-body font-medium text-neutral-900">
                  Playfair Display
                </p>
                <p className="text-small text-neutral-500">
                  Elegant &middot; Readable &middot; Timeless
                </p>
              </div>
              <div>
                <p className="font-sans text-4xl font-bold text-neutral-900">
                  Ag
                </p>
                <p className="text-body font-medium text-neutral-900">
                  Inter
                </p>
                <p className="text-small text-neutral-500">
                  Clean &middot; Modern &middot; Highly legible
                </p>
              </div>
            </div>
          </Section>

          {/* Type scale */}
          <Section number="03" title="Type Scale">
            <div className="space-y-3">
              {typeScale.map((t) => (
                <div
                  key={t.style}
                  className="flex items-center justify-between border-b border-neutral-100 pb-2 text-body last:border-0"
                >
                  <span className="w-24 font-medium text-neutral-900">
                    {t.style}
                  </span>
                  <span className="w-16 text-small text-neutral-500">
                    {t.size}
                  </span>
                  <span className="text-small text-neutral-500">{t.use}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Spacing */}
          <Section number="04" title="Spacing System">
            <p className="mb-4 text-small text-neutral-500">Base unit: 4px</p>
            <div className="flex flex-wrap items-end gap-4">
              {spacingScale.map((s) => (
                <div key={s} className="text-center">
                  <div
                    className="mb-2 rounded-[4px] bg-primary-100"
                    style={{ width: s, height: s }}
                  />
                  <p className="text-small text-neutral-500">{s}</p>
                </div>
              ))}
            </div>
          </Section>

          {/* Radius & shadows */}
          <Section number="05" title="Radius & Shadows">
            <p className="mb-3 text-body font-medium text-neutral-700">
              Radius
            </p>
            <div className="mb-6 flex flex-wrap gap-4">
              {radiusScale.map((r) => (
                <div key={r.label} className="text-center">
                  <div
                    className={`mb-2 h-12 w-12 border border-neutral-300 ${r.className}`}
                  />
                  <p className="text-small text-neutral-500">
                    {r.label} ({r.sub})
                  </p>
                </div>
              ))}
            </div>
            <p className="mb-3 text-body font-medium text-neutral-700">
              Shadows
            </p>
            <div className="flex flex-wrap gap-4">
              {shadowScale.map((s) => (
                <div
                  key={s.label}
                  className={`w-24 rounded-[var(--radius-sm)] bg-white p-3 ${s.className}`}
                >
                  <p className="text-body font-medium text-neutral-900">
                    {s.label}
                  </p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Icons */}
          <Section number="06" title="Icons">
            <p className="mb-3 text-body font-medium text-neutral-700">
              Outline Style
            </p>
            <div className="mb-4 flex flex-wrap gap-3">
              {outlineIcons.map((Icon, i) => (
                <div
                  key={i}
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-xs)] text-neutral-700"
                >
                  <Icon className="h-5 w-5" strokeWidth={2} />
                </div>
              ))}
            </div>
            <p className="text-small text-neutral-500">
              24x24 grid &middot; 2px stroke &middot; Rounded caps
            </p>
          </Section>

          {/* Badges */}
          <Section number="09" title="Badges / Tags">
            <div className="flex flex-col gap-3">
              <div>
                <p className="mb-1 text-small text-neutral-500">Video</p>
                <Badge variant="video">Video</Badge>
              </div>
              <div>
                <p className="mb-1 text-small text-neutral-500">Lesson</p>
                <Badge variant="lesson">Lesson</Badge>
              </div>
              <div>
                <p className="mb-1 text-small text-neutral-500">Popular</p>
                <Badge variant="popular">Popular</Badge>
              </div>
            </div>
          </Section>

          {/* Status */}
          <Section number="10" title="Status / Indicators">
            <div className="flex flex-col gap-3">
              <StatusIndicator status="in-progress" />
              <StatusIndicator status="completed" />
              <StatusIndicator status="now-playing" />
              <StatusIndicator status="locked" />
            </div>
          </Section>
        </div>

        {/* Buttons */}
        <Section number="07" title="Buttons">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <p className="mb-2 text-small text-neutral-500">Primary</p>
              <Button variant="primary">Get Started</Button>
            </div>
            <div>
              <p className="mb-2 text-small text-neutral-500">Secondary</p>
              <Button variant="secondary">Explore Courses</Button>
            </div>
            <div>
              <p className="mb-2 text-small text-neutral-500">Tertiary</p>
              <Button variant="tertiary">
                View Lesson <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
            <div>
              <p className="mb-2 text-small text-neutral-500">Text</p>
              <Button variant="text">
                Watch Video <Play className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Section>

        {/* Inputs */}
        <Section number="08" title="Inputs">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-small text-neutral-500">
                Search / Text Input
              </p>
              <Input icon placeholder="Search anything..." shortcut="⌘K" />
            </div>
            <div>
              <p className="mb-2 text-small text-neutral-500">Select</p>
              <Select defaultValue="Most Relevant">
                <option>Most Relevant</option>
                <option>Newest</option>
                <option>Popular</option>
              </Select>
            </div>
          </div>
        </Section>

        {/* Progress bar */}
        <Section number="11" title="Progress Bar">
          <ProgressBar value={35} className="max-w-md" />
        </Section>

        {/* Cards */}
        <Section number="12" title="Cards">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <CourseCard
              icon={<span className="text-body font-bold">N</span>}
              title="Next.js for Production"
              description="Build scalable, high-performance web applications with Next.js."
              level="Intermediate"
              duration="18h 24m"
              modules="12 modules"
            />
            <LessonCard
              badgeVariant="video"
              badgeLabel="Video"
              title="Data Fetching in Server Components"
              description="Learn how to fetch data on the server using async/await and Next.js best practices."
              meta="Lesson 5.1 • 12:45"
              actionLabel="Watch from 12:45"
            />
            <LessonCard
              badgeVariant="lesson"
              badgeLabel="Lesson"
              title="Data Fetching & Caching"
              description="Explore different data fetching methods in Next.js and how to cache and revalidate data for optimal performance."
              meta="Module 5"
              actionLabel="View lesson"
            />
            <ResourceCard
              title="Caching and Revalidation Guide"
              description="Deep dive into Next.js caching strategies."
              meta="PDF • 1.2 MB"
            />
          </div>
        </Section>

        {/* Navigation */}
        <Section number="13" title="Navigation">
          <div className="-m-6 mb-4 overflow-hidden rounded-t-[var(--radius-md)]">
            <TopNav />
          </div>
          <div className="flex flex-col gap-4 px-0">
            <Breadcrumbs
              items={["All Courses", "Next.js for Production", "Data Fetching & Caching"]}
            />
            <Pagination page={1} totalPages={8} />
          </div>
        </Section>

        {/* Principles */}
        <Section number="14" title="Principles">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4">
            {[
              {
                title: "Clarity First",
                desc: "Every element should communicate clearly.",
              },
              {
                title: "Consistency",
                desc: "Use components and patterns consistently across the platform.",
              },
              {
                title: "Focus & Calm",
                desc: "Remove noise and help learners focus on what matters.",
              },
              {
                title: "Accessible",
                desc: "Design with accessibility and inclusivity in mind.",
              },
            ].map((p) => (
              <div key={p.title}>
                <p className="mb-1 text-body font-medium text-neutral-900">
                  {p.title}
                </p>
                <p className="text-small text-neutral-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
