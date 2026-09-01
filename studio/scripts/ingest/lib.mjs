// Shared helpers for the offline video ingestion pipeline (AGENTS §9).
// Pure Node 20 — no npm dependencies. The fetch stage shells out to `yt-dlp`.

const NAMED_ENTITIES = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
}

/** Decode the handful of HTML entities that show up in captions, then collapse whitespace. */
export function normalizeText(raw) {
  return String(raw ?? '')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => safeCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => safeCodePoint(parseInt(d, 10)))
    .replace(/&[a-zA-Z]+;/g, (m) => NAMED_ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim()
}

function safeCodePoint(cp) {
  if (!Number.isFinite(cp) || cp < 0 || cp > 0x10ffff) return ''
  try {
    return String.fromCodePoint(cp)
  } catch {
    return ''
  }
}

/**
 * A json3 caption payload -> [{ startSeconds, text }], blanks dropped. Both
 * yt-dlp's `.json3` subtitle files and YouTube's timedtext use this shape.
 */
export function cuesFromJson3(payload) {
  const events = Array.isArray(payload?.events) ? payload.events : []
  const cues = []
  for (const ev of events) {
    if (!Array.isArray(ev.segs)) continue
    const text = normalizeText(ev.segs.map((s) => s?.utf8 ?? '').join(''))
    if (!text) continue
    cues.push({startSeconds: (ev.tStartMs ?? 0) / 1000, text})
  }
  return cues
}

/**
 * yt-dlp info.json `chapters` -> [{ startSeconds, label }], sorted & de-duped.
 * `[]` when the video has no creator chapters.
 */
export function chaptersFromInfoJson(info) {
  const raw = Array.isArray(info?.chapters) ? info.chapters : []
  const chapters = []
  for (const c of raw) {
    const label = normalizeText(c?.title ?? '')
    const startSeconds = Math.floor(Number(c?.start_time) || 0)
    if (!label || !Number.isFinite(startSeconds) || startSeconds < 0) continue
    chapters.push({startSeconds, label})
  }
  return dedupeSorted(chapters)
}

/**
 * Given an info.json `subtitles` / `automatic_captions` map, return the best
 * English language key and whether it is manual. null when neither has English.
 */
export function pickEnglish(subtitles = {}, autoCaptions = {}) {
  const englishKey = (map) => {
    const keys = Object.keys(map || {})
    return (
      keys.find((k) => k.toLowerCase() === 'en') ||
      keys.find((k) => k.toLowerCase().startsWith('en')) ||
      null
    )
  }
  const manual = englishKey(subtitles)
  if (manual) return {lang: manual, kind: 'manual'}
  const auto = englishKey(autoCaptions)
  if (auto) return {lang: auto, kind: 'asr'}
  return null
}

/** Sort by startSeconds and drop entries that repeat a startSeconds already taken. */
export function dedupeSorted(entries) {
  const seen = new Set()
  return [...entries]
    .sort((a, b) => a.startSeconds - b.startSeconds)
    .filter((e) => {
      if (seen.has(e.startSeconds)) return false
      seen.add(e.startSeconds)
      return true
    })
}

/**
 * Group consecutive cues into short timestamped chunks. Flush when the running
 * text hits `maxChars` or the span from the chunk's first cue reaches `maxSpan`
 * seconds. Keeps chunks small so a query never pulls a whole transcript (AGENTS §8).
 */
export function chunkCues(cues, {maxChars = 200, maxSpan = 18} = {}) {
  const chunks = []
  let startSeconds = null
  let parts = []

  const flush = () => {
    if (!parts.length) return
    const text = normalizeText(parts.join(' '))
    if (text) chunks.push({startSeconds: Math.floor(startSeconds), text})
    startSeconds = null
    parts = []
  }

  for (const cue of cues) {
    if (startSeconds === null) startSeconds = cue.startSeconds
    parts.push(cue.text)
    const chars = parts.join(' ').length
    const span = cue.startSeconds - startSeconds
    if (chars >= maxChars || span >= maxSpan) flush()
  }
  flush()
  return chunks
}

/** YouTube ids are [A-Za-z0-9_-]; Sanity rejects an _id element starting with -/_. */
export function docIdElement(id) {
  return /^[A-Za-z0-9]/.test(id) ? id : `yt${id}`
}

export function watchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`
}

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}
