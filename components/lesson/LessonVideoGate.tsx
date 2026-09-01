"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { SignInButton, SignUpButton, useAuth } from "@clerk/nextjs";
import { Lock } from "lucide-react";

import { Button } from "@/components/ui/Button";

type Props = {
  poster?: { url: string; alt: string } | null;
  monogram: string;
  title: string;
};

/**
 * Signed-out stand-in for `LessonVideo` (AGENTS.md §5 — playback is gated, the
 * rest of the lesson page stays public). Mirrors the "Video unavailable" frame
 * styling in `LessonVideo`. Once the user signs in via the modal, `isSignedIn`
 * flips and we `router.refresh()` so the server component swaps in the real
 * player without a full reload.
 */
export function LessonVideoGate({ poster, monogram, title }: Props) {
  const { isSignedIn } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isSignedIn) router.refresh();
  }, [isSignedIn, router]);

  return (
    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[var(--radius-lg)] bg-neutral-900 text-white">
      {poster?.url ? (
        <Image
          src={poster.url}
          alt={poster.alt || title}
          fill
          className="object-cover opacity-30"
          sizes="(min-width: 1024px) 720px, 100vw"
        />
      ) : (
        <span
          aria-hidden
          className="font-display text-[6rem] leading-none font-bold text-white/20"
        >
          {monogram}
        </span>
      )}

      <div className="relative flex max-w-sm flex-col items-center gap-4 px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10">
          <Lock className="h-5 w-5" strokeWidth={2} />
        </span>
        <div>
          <p className="text-body-lg font-medium">Sign in to watch this lesson</p>
          <p className="mt-1 text-small text-white/70">
            Browsing is free. Create an account to play videos and track your
            progress.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <SignInButton mode="modal">
            <Button variant="primary" className="h-10 px-4 text-small">
              Sign in to watch
            </Button>
          </SignInButton>
          <SignUpButton mode="modal">
            <button className="text-small font-medium text-white/80 hover:text-white">
              Create an account
            </button>
          </SignUpButton>
        </div>
      </div>
    </div>
  );
}
