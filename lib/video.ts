/**
 * Pure helpers for turning an authored video URL into an on-site provider embed.
 * No dependencies — safe on server or client.
 *
 * AGENTS.md §7: playback stays on the site via the provider's own player. A result
 * links to the lesson page with a start-seconds param and the embed starts at that
 * second using the provider's own start parameter. We never link the learner out.
 */

export type VideoProvider = "youtube" | "vimeo" | "bunny";

export type ParsedVideo =
  | { provider: "youtube"; id: string }
  | { provider: "vimeo"; id: string }
  | { provider: "bunny"; libraryId: string; guid: string };

function parseYouTube(u: URL): ParsedVideo | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host === "youtu.be") {
    const id = u.pathname.slice(1).split("/")[0];
    return id ? { provider: "youtube", id } : null;
  }
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "m.youtube.com") {
    const v = u.searchParams.get("v");
    if (v) return { provider: "youtube", id: v };
    const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/);
    if (m) return { provider: "youtube", id: m[1] };
  }
  return null;
}

function parseVimeo(u: URL): ParsedVideo | null {
  const host = u.hostname.replace(/^www\./, "");
  if (host !== "vimeo.com" && host !== "player.vimeo.com") return null;
  const m = u.pathname.match(/\/(?:video\/)?(\d+)/);
  return m ? { provider: "vimeo", id: m[1] } : null;
}

function parseBunny(u: URL): ParsedVideo | null {
  if (u.hostname.replace(/^www\./, "") !== "iframe.mediadelivery.net") return null;
  const m = u.pathname.match(/^\/(?:play|embed)\/([^/]+)\/([^/?#]+)/);
  return m ? { provider: "bunny", libraryId: m[1], guid: m[2] } : null;
}

/** Recognise a YouTube / Vimeo / Bunny URL. Returns `null` for anything else. */
export function parseVideoUrl(url: string | null | undefined): ParsedVideo | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  return parseYouTube(u) ?? parseVimeo(u) ?? parseBunny(u);
}

/**
 * Build the provider embed URL, starting playback at `startSeconds` via each
 * provider's own start parameter. When `startSeconds > 0` the learner has jumped
 * to a specific moment (a search "watch from" result or a shared deep link), so
 * we also request autoplay via each provider's own flag — the result click is
 * the user gesture. A browser that still blocks it just shows the player ready
 * at that second (AGENTS §7: the action watches from that second).
 */
export function embedSrc(parsed: ParsedVideo, startSeconds = 0): string {
  const start = Math.max(0, Math.floor(startSeconds || 0));
  const autoplay = start > 0;
  switch (parsed.provider) {
    case "youtube": {
      const params = new URLSearchParams({
        rel: "0",
        modestbranding: "1",
        playsinline: "1",
        enablejsapi: "1",
      });
      if (start > 0) params.set("start", String(start));
      if (autoplay) params.set("autoplay", "1");
      return `https://www.youtube-nocookie.com/embed/${parsed.id}?${params.toString()}`;
    }
    case "vimeo": {
      const params = new URLSearchParams({ title: "0", byline: "0", portrait: "0" });
      if (autoplay) params.set("autoplay", "1");
      const hash = start > 0 ? `#t=${start}s` : "";
      return `https://player.vimeo.com/video/${parsed.id}?${params.toString()}${hash}`;
    }
    case "bunny": {
      const params = new URLSearchParams({
        autoplay: autoplay ? "true" : "false",
        preload: "true",
      });
      if (start > 0) params.set("t", String(start));
      return `https://iframe.mediadelivery.net/embed/${parsed.libraryId}/${parsed.guid}?${params.toString()}`;
    }
  }
}

/** Parse a `?t=` / `?start=` value into a clamped non-negative integer of seconds. */
export function parseStartSeconds(
  raw: string | string[] | undefined,
  maxSeconds?: number | null,
): number {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return 0;
  const n = Number.parseInt(value, 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  if (typeof maxSeconds === "number" && maxSeconds > 0) return Math.min(n, maxSeconds);
  return n;
}
