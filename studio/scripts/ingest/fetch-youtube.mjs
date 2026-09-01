// Offline video ingestion — FETCH stage (AGENTS §9).
//
// For every unique video id in studio/scripts/seed/videos.json, use `yt-dlp` to
// pull the English caption track (json3) + creator chapters, and write the raw
// result to a committed cache file at studio/scripts/ingest/cache/<id>.json. The
// request path never touches YouTube — the cache is the reproducible artifact.
//
// Requires yt-dlp on PATH:  brew install yt-dlp   (or: pipx install yt-dlp)
// The plain caption-URL scrape is dead (YouTube pot-token enforcement); yt-dlp
// handles the player-client negotiation and keeps working.
//
//   node studio/scripts/ingest/fetch-youtube.mjs                 # fetch all, skip cached
//   node studio/scripts/ingest/fetch-youtube.mjs --refresh       # re-fetch everything
//   node studio/scripts/ingest/fetch-youtube.mjs --only <id,id>  # just these video ids
//
// Env:
//   YTDLP_COOKIES_FROM_BROWSER=chrome|safari|firefox   pass --cookies-from-browser
//                                                      (use if yt-dlp hits a bot check)
//
// Idempotent: an existing cache/<id>.json is skipped unless --refresh, except
// entries whose captions came back empty last time — those are always retried.
import {spawnSync} from 'node:child_process'
import {mkdtempSync, readdirSync, readFileSync, rmSync} from 'node:fs'
import {mkdir, readdir, readFile, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {fileURLToPath} from 'node:url'

import {chaptersFromInfoJson, cuesFromJson3, pickEnglish, sleep, watchUrl} from './lib.mjs'

const VIDEOS_JSON = fileURLToPath(new URL('../seed/videos.json', import.meta.url))
const CACHE_DIR = fileURLToPath(new URL('./cache/', import.meta.url))

const args = process.argv.slice(2)
const refresh = args.includes('--refresh')
const onlyArg = args.includes('--only') ? args[args.indexOf('--only') + 1] : null
const only = onlyArg ? new Set(onlyArg.split(',').map((s) => s.trim())) : null
const cookiesFromBrowser = process.env.YTDLP_COOKIES_FROM_BROWSER || null

function assertYtDlp() {
  const probe = spawnSync('yt-dlp', ['--version'], {encoding: 'utf8'})
  if (probe.error || probe.status !== 0) {
    console.error(
      'yt-dlp not found on PATH.\n  Install it:  brew install yt-dlp   (or: pipx install yt-dlp)',
    )
    process.exit(1)
  }
  return probe.stdout.trim()
}

async function main() {
  const version = assertYtDlp()
  console.log(`yt-dlp ${version}\n`)
  await mkdir(CACHE_DIR, {recursive: true})

  const entries = JSON.parse(await readFile(VIDEOS_JSON, 'utf8'))
  const jobs = []
  const seen = new Set()
  for (const v of Object.values(entries)) {
    if (seen.has(v.id)) continue
    seen.add(v.id)
    if (only && !only.has(v.id)) continue
    jobs.push(v.id)
  }

  // Cached videos are skipped unless --refresh — except captionKind:"empty" ones.
  const cached = new Set()
  for (const f of await readdir(CACHE_DIR)) {
    if (!f.endsWith('.json')) continue
    try {
      const rec = JSON.parse(await readFile(join(CACHE_DIR, f), 'utf8'))
      if (rec.captionKind !== 'empty') cached.add(f.slice(0, -5))
    } catch {
      // unreadable — let it re-fetch
    }
  }

  const tally = {ok: 0, noCaptions: 0, skipped: 0, failed: 0}
  for (let i = 0; i < jobs.length; i++) {
    const id = jobs[i]
    const prefix = `[${i + 1}/${jobs.length}] ${id}`
    if (!refresh && cached.has(id)) {
      tally.skipped++
      console.log(`${prefix} — skip (cached)`)
      continue
    }
    try {
      const record = fetchOne(id)
      await writeFile(join(CACHE_DIR, `${id}.json`), JSON.stringify(record, null, 2) + '\n')
      if (record.captionKind === 'none' || record.captionKind === 'empty') {
        tally.noCaptions++
        const why = record.captionKind === 'empty' ? 'captions empty (retry)' : 'no captions'
        console.log(`${prefix} — ${why} · ${record.chapters.length} chapters`)
      } else {
        tally.ok++
        console.log(
          `${prefix} — ${record.cues.length} cues (${record.captionKind}) · ${record.chapters.length} chapters`,
        )
      }
    } catch (err) {
      tally.failed++
      console.error(`${prefix} — FAILED: ${err.message}`)
    }
    if (i < jobs.length - 1) await sleep(500)
  }

  console.log(
    `\nDone. ok=${tally.ok} no-captions=${tally.noCaptions} skipped=${tally.skipped} failed=${tally.failed}`,
  )
  if (tally.failed > 0) process.exitCode = 1
}

function fetchOne(id) {
  const work = mkdtempSync(join(tmpdir(), `ytt-${id}-`))
  try {
    const ytArgs = [
      watchUrl(id),
      '--skip-download',
      '--no-playlist',
      '--no-warnings',
      '--no-progress',
      '--write-info-json',
      '--write-subs',
      '--write-auto-subs',
      '--sub-langs',
      'en.*,en,-live_chat',
      '--sub-format',
      'json3',
      '--retries',
      '3',
      '--extractor-retries',
      '3',
      '-o',
      join(work, '%(id)s.%(ext)s'),
    ]
    if (cookiesFromBrowser) ytArgs.push('--cookies-from-browser', cookiesFromBrowser)

    const res = spawnSync('yt-dlp', ytArgs, {encoding: 'utf8', maxBuffer: 64 * 1024 * 1024})
    if (res.error) throw res.error

    const files = readdirSync(work)
    const infoFile = files.find((f) => f.endsWith('.info.json'))
    if (!infoFile) {
      const tail = (res.stderr || res.stdout || '').trim().split('\n').slice(-2).join(' ')
      throw new Error(`yt-dlp produced no info.json${tail ? ` — ${tail}` : ''}`)
    }
    const info = JSON.parse(readFileSync(join(work, infoFile), 'utf8'))

    const chapters = chaptersFromInfoJson(info)

    const picked = pickEnglish(info.subtitles, info.automatic_captions)
    let cues = []
    let captionKind = 'none'
    if (picked) {
      const exact = files.find((f) => f.endsWith(`.${picked.lang}.json3`))
      const anyJson3 = files.find((f) => f.startsWith(`${id}.`) && f.endsWith('.json3'))
      const subFile = exact || anyJson3
      if (subFile) {
        let payload
        try {
          payload = JSON.parse(readFileSync(join(work, subFile), 'utf8'))
        } catch {
          payload = null
        }
        cues = cuesFromJson3(payload)
        captionKind = cues.length ? picked.kind : 'empty'
      } else {
        // yt-dlp listed an English track but couldn't write a json3 file for it.
        captionKind = 'empty'
      }
    }

    return {
      id,
      url: watchUrl(id),
      fetchedAt: new Date().toISOString(),
      captionKind,
      chapters,
      cues,
    }
  } finally {
    rmSync(work, {recursive: true, force: true})
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
