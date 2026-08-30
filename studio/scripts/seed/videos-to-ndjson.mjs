// Transform the committed videos.json into NDJSON `video` documents for
// `sanity dataset import`. Does NOT modify videos.json. Writes NDJSON to stdout.
//
//   node studio/scripts/seed/videos-to-ndjson.mjs > videos.ndjson
//   cd studio && npx sanity dataset import ../videos.ndjson --dataset production --replace
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'

const SRC = fileURLToPath(new URL('./videos.json', import.meta.url))
const entries = JSON.parse(readFileSync(SRC, 'utf8'))

const seen = new Set()
const lines = []
for (const v of Object.values(entries)) {
  const id = v.id
  if (seen.has(id)) continue // one doc per unique video
  seen.add(id)
  // Sanity rejects doc-id elements that start with "-" or "_" (AGENTS §9:
  // "stripping any characters the datastore rejects in ids"). Only the _id
  // element is adjusted; the `id` field and `url` keep the real video id.
  const idElement = /^[A-Za-z0-9]/.test(id) ? id : `yt${id}`
  lines.push(
    JSON.stringify({
      _id: `video.${idElement}`,
      _type: 'video',
      id,
      url: `https://www.youtube.com/watch?v=${id}`,
      chapters: [],
      chunks: [],
    }),
  )
}
process.stdout.write(lines.join('\n') + '\n')
process.stderr.write(`${lines.length} video docs from ${Object.keys(entries).length} entries\n`)
