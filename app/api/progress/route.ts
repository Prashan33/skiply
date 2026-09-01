import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

import { clampSeconds, completionThresholdSeconds } from "@/lib/progress";
import { getReadClient } from "@/sanity/lib/fetch";
import { getWriteClient } from "@/sanity/lib/write";

/**
 * `POST /api/progress` — persist a learner's watch progress for one lesson
 * (AGENTS.md §5/§7). The browser never writes the dataset directly; this route
 * holds the write token.
 *
 * The learner is taken from the Clerk session, never the body, and the progress
 * document id is `progress.<userId>`, so a learner can only write their own
 * record. `secondsWatched` / `lastPosition` are clamped to the real video
 * duration, and completion is decided server-side against the §7 threshold
 * (7 min, or 90% for shorter videos). `secondsWatched` is monotonic and
 * `completed` never regresses.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  lessonId: z.string().min(1).max(200),
  secondsWatched: z.number().min(0).max(60 * 60 * 24),
  lastPosition: z.number().min(0).max(60 * 60 * 24),
});

type StoredEntry = {
  _key: string;
  _type?: "entry";
  lessonId: string;
  secondsWatched: number;
  completed: boolean;
  completedAt?: string;
  lastPosition: number;
  updatedAt: string;
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

  const lesson = await getReadClient().fetch<{ id: string; duration: number | null } | null>(
    `*[_type == "lesson" && _id == $lessonId][0]{ "id": _id, duration }`,
    { lessonId: parsed.lessonId },
    { cache: "no-store" },
  );
  if (!lesson) {
    return Response.json({ error: "Unknown lesson" }, { status: 404 });
  }

  const overrideRaw = Number.parseInt(process.env.PROGRESS_COMPLETE_SECONDS ?? "", 10);
  const override = Number.isFinite(overrideRaw) && overrideRaw > 0 ? overrideRaw : null;

  const incomingSeconds = clampSeconds(parsed.secondsWatched, lesson.duration);
  const lastPosition = clampSeconds(parsed.lastPosition, lesson.duration);
  const threshold = completionThresholdSeconds(lesson.duration, override);

  const docId = `progress.${userId}`;
  const existing = await getReadClient().fetch<{ entries?: StoredEntry[] } | null>(
    `*[_id == $id][0]{ entries }`,
    { id: docId },
    { cache: "no-store" },
  );

  const entries = existing?.entries ?? [];
  const prev = entries.find((e) => e.lessonId === parsed.lessonId);

  const now = new Date().toISOString();
  const secondsWatched = Math.max(prev?.secondsWatched ?? 0, incomingSeconds);
  const wasCompleted = prev?.completed ?? false;
  const completed = wasCompleted || secondsWatched >= threshold;

  const nextEntry: StoredEntry = {
    _key: parsed.lessonId,
    _type: "entry",
    lessonId: parsed.lessonId,
    secondsWatched,
    completed,
    completedAt: wasCompleted ? prev?.completedAt : completed ? now : undefined,
    lastPosition,
    updatedAt: now,
  };

  const nextEntries = prev
    ? entries.map((e) => (e.lessonId === parsed.lessonId ? nextEntry : e))
    : [...entries, nextEntry];

  try {
    await getWriteClient()
      .transaction()
      .createIfNotExists({ _id: docId, _type: "progress", userId, entries: [] })
      .patch(docId, (p) => p.set({ entries: nextEntries }))
      .commit({ visibility: "async" });
  } catch {
    return Response.json({ error: "Write failed" }, { status: 502 });
  }

  // The progress read helper uses `revalidate: 0`, so the lesson/course pages
  // pick up this write on their next request without an explicit tag purge.
  return Response.json({ completed, secondsWatched, threshold });
}
