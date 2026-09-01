"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Input } from "@/components/ui/Input";

/**
 * The homepage hero search box. Navigates to /search?q=… — all the work happens
 * there.
 */
export function SearchLauncher({ className }: { className?: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl-K focuses the search box (the input renders the hint).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        if (q) router.push(`/search?q=${encodeURIComponent(q)}`);
      }}
    >
      <Input
        ref={inputRef}
        icon
        shortcut="⌘ K"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Ask anything about your learning..."
        aria-label="Search courses and lessons"
        className={className}
      />
    </form>
  );
}
