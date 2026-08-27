import { type ElementType, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({
  as: Tag = "div",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag className={cn("mx-auto w-full max-w-[1440px] px-6 lg:px-10", className)}>
      {children}
    </Tag>
  );
}
