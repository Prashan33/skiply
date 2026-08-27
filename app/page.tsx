import { ArrowRight, Braces, Container as ContainerIcon, Star } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CourseCard } from "@/components/ui/Card";
import { Container } from "@/components/ui/Container";
import { TopNav } from "@/components/ui/Navigation";

const courses = [
  {
    icon: <span className="font-display text-body font-bold">N</span>,
    iconClassName: "bg-neutral-900 text-white",
    title: "Next.js for Production",
    description: "Build scalable, high-performance web applications with Next.js.",
    level: "Intermediate",
    duration: "18h 24m",
    modules: "12 modules",
  },
  {
    icon: <ContainerIcon className="h-5 w-5" strokeWidth={2} />,
    iconClassName: "bg-sky-100 text-sky-600",
    title: "Docker Essentials",
    description:
      "Containerize applications and streamline your development workflow.",
    level: "Beginner",
    duration: "10h 12m",
    modules: "8 modules",
  },
  {
    icon: <Braces className="h-5 w-5" strokeWidth={2} />,
    iconClassName: "bg-blue-600 text-white",
    title: "TypeScript Deep Dive",
    description: "Go beyond the basics and write safer, more expressive code.",
    level: "Intermediate",
    duration: "14h 36m",
    modules: "10 modules",
  },
];

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

export default function Home() {
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
          <Button variant="primary" className="mb-10">
            Explore Courses
            <ArrowRight className="h-4 w-4" strokeWidth={2} />
          </Button>
          <Input
            icon
            shortcut="⌘K"
            placeholder="Ask anything about your learning..."
            className="h-14 rounded-[var(--radius-lg)] text-body-lg shadow-[var(--shadow-sm)]"
          />
        </div>
      </Container>

      <section className="border-t border-neutral-200">
        <Container className="py-14">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="font-display text-heading-1 text-neutral-900">
              All Courses
            </h2>
            <a
              href="#"
              className="inline-flex items-center gap-1 text-body font-medium text-primary-500 hover:text-primary-400"
            >
              View all courses
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </a>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((course) => (
              <CourseCard key={course.title} {...course} />
            ))}
          </div>
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
