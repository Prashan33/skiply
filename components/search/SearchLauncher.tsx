"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/Input";

/**
 * The homepage hero search box. Navigates to /search?q=… — all the work happens
 * there.
 */
export function SearchLauncher({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Input
        icon
        shortcut="⌘K"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask anything about your learning..."
        aria-label="Search courses and lessons"
        className={className}
      />
    </form>
  );
}
