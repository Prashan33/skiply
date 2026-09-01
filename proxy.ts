import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Browsing is public (AGENTS.md §5). Only the routes a feature marks as
 * protected are gated: search ("ask anything") and the per-learner My Learning
 * page. Lesson video playback is gated in the page itself (see
 * `components/lesson/LessonVideoGate.tsx`), and `POST /api/search` does its own
 * 401 check so it returns JSON rather than a redirect.
 */
const isProtectedRoute = createRouteMatcher(["/search(.*)", "/my-learning(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
