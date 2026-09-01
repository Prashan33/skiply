import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { getReadClient } from "@/sanity/lib/fetch";
import { getWriteClient } from "@/sanity/lib/write";

/**
 * `POST /api/bookmarks` — toggle a learner's bookmark for one lesson or course
 * (AGENTS.md §5/§7). The browser never writes the dataset directly; this route
 * holds the write token.
 *
 * The learner comes from the Clerk session, never the body, and the record id is
 * `progress.<userId>`, so a learner can only ever write their own bookmarks.
 * Bookmarks live on the same document as watch `entries`; this route patches
 * only `bookmarks` and always `createIfNotExists` first, so it never races
 * `POST /api/progress`. `_key == refId` keeps it idempotent: bookmarking twice
 * is one entry, un-bookmarking a missing entry is a no-op success.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["lesson", "course"]),
  refId: z.string().min(1).max(200),
  bookmarked: z.boolean(),
});

type StoredBookmark = {
  _key: string;
  _type: "bookmark";
  kind: "lesson" | "course";
  refId: string;
  bookmarkedAt: string;
};

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "Bad request" }, { status: 400 });
  }

  const target = await getReadClient().fetch<{ _id: string } | null>(
    `*[_type == $type && _id == $refId][0]{ _id }`,
    { type: parsed.kind, refId: parsed.refId },
    { cache: "no-store" },
  );
  if (!target) {
    return Response.json({ error: "Unknown target" }, { status: 404 });
  }

  const docId = `progress.${userId}`;
  const existing = await getReadClient().fetch<{ bookmarks?: StoredBookmark[] } | null>(
    `*[_id == $id][0]{ bookmarks }`,
    { id: docId },
    { cache: "no-store" },
  );

  const current = existing?.bookmarks ?? [];
  const without = current.filter((b) => b._key !== parsed.refId);
  const nextBookmarks: StoredBookmark[] = parsed.bookmarked
    ? [
        ...without,
        {
          _key: parsed.refId,
          _type: "bookmark",
          kind: parsed.kind,
          refId: parsed.refId,
          bookmarkedAt: new Date().toISOString(),
        },
      ]
    : without;

  try {
    await getWriteClient()
      .transaction()
      .createIfNotExists({ _id: docId, _type: "progress", userId, entries: [] })
      .patch(docId, (p) => p.set({ bookmarks: nextBookmarks }))
      .commit({ visibility: "async" });
  } catch (err) {
    console.error("[/api/bookmarks] write failed", err);
    return Response.json({ error: "Write failed" }, { status: 502 });
  }

  // `getProgressForUser` / `getBookmarkedCourses` read with `revalidate: 0`, so
  // the lesson/course/My Learning pages pick up this write on their next request
  // (the client calls `router.refresh()` after a successful toggle).
  return Response.json({ bookmarked: parsed.bookmarked });
}
