// Offline video ingestion — BUILD stage (AGENTS §8/§9/§11).
//
// Reads the committed cache (studio/scripts/ingest/cache/*.json) and emits NDJSON
// `video` documents on stdout — one per cached video — ready for:
//
//   node studio/scripts/ingest/build-video-ndjson.mjs > video-docs.ndjson
//   cd studio && npx sanity dataset import ../video-docs.ndjson production --replace
//
// `--replace` updates the 120 skeleton `video` docs in place (same _id convention
// as scripts/seed/videos-to-ndjson.mjs), so the document count stays 120.
import {readdir, readFile} from 'node:fs/promises'
import {fileURLToPath} from 'node:url'

import {chunkCues, dedupeSorted, docIdElement} from './lib.mjs'

const CACHE_DIR = fileURLToPath(new URL('./cache/', import.meta.url))

async function main() {
  const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith('.json')).sort()
  if (files.length === 0) {
    console.error('No cache files. Run fetch-youtube.mjs first.')
    process.exit(1)
  }

  const lines = []
  const chunkHist = {}
  const chapterHist = {}
  let noChunks = 0
  let longChunks = 0

  for (const file of files) {
    const rec = JSON.parse(await readFile(`${CACHE_DIR}${file}`, 'utf8'))

    const chapters = dedupeSorted(
      (rec.chapters ?? [])
        .map((c) => ({
          startSeconds: Math.floor(Number(c.startSeconds) || 0),
          label: String(c.label ?? '').trim(),
        }))
        .filter((c) => c.label && c.startSeconds >= 0),
    ).map((c, i) => ({_key: `ch${i}`, _type: 'chapter', ...c}))

    const chunks = chunkCues(rec.cues ?? []).map((c, i) => ({
      _key: `c${i}`,
      _type: 'chunk',
      ...c,
    }))

    if (chunks.length === 0) noChunks++
    longChunks += chunks.filter((c) => c.text.length > 400).length
    bump(chunkHist, bucket(chunks.length))
    bump(chapterHist, chapters.length)

    lines.push(
      JSON.stringify({
        _id: `video.${docIdElement(rec.id)}`,
        _type: 'video',
        id: rec.id,
        url: rec.url,
        chapters,
        chunks,
      }),
    )
  }

  process.stdout.write(lines.join('\n') + '\n')

  console.error(`\n${lines.length} video docs`)
  console.error(`videos with 0 chunks: ${noChunks}`)
  console.error(`chunks with text > 400 chars: ${longChunks}`)
  console.error(`chunk-count buckets: ${JSON.stringify(chunkHist)}`)
  console.error(`chapter-count histogram: ${JSON.stringify(chapterHist)}`)
}

function bump(obj, key) {
  obj[key] = (obj[key] ?? 0) + 1
}

function bucket(n) {
  if (n === 0) return '0'
  if (n <= 10) return '1-10'
  if (n <= 30) return '11-30'
  if (n <= 60) return '31-60'
  if (n <= 120) return '61-120'
  return '120+'
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
