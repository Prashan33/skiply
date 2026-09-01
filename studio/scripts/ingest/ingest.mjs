// Offline video ingestion — ORCHESTRATOR (AGENTS §9).
//
// Runs the fetch stage, then the build stage, writing NDJSON `video` documents to
// --out. With --import, runs `sanity dataset import ... --replace` from studio/
// using the logged-in Sanity CLI session (no write token in the repo).
//
//   node studio/scripts/ingest/ingest.mjs --out video-docs.ndjson
//   node studio/scripts/ingest/ingest.mjs --out video-docs.ndjson --import
//   node studio/scripts/ingest/ingest.mjs --out v.ndjson --refresh --dataset production
//
// Flags: --out <path> (required), --import, --refresh, --dataset <name> (default
// production). Fetch-only knobs (--only) — call fetch-youtube.mjs directly.
import {spawn} from 'node:child_process'
import {createWriteStream} from 'node:fs'
import {fileURLToPath} from 'node:url'

const HERE = fileURLToPath(new URL('./', import.meta.url))
const STUDIO_DIR = fileURLToPath(new URL('../../', import.meta.url))

const args = process.argv.slice(2)
const out = flag('--out')
const doImport = args.includes('--import')
const refresh = args.includes('--refresh')
const dataset = flag('--dataset') || 'production'

if (!out) {
  console.error('Missing --out <path>. See the header comment for usage.')
  process.exit(1)
}

function flag(name) {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : null
}

function run(cmd, cmdArgs, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, cmdArgs, {stdio: 'inherit', ...opts})
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    )
  })
}

function runCapture(cmd, cmdArgs, outPath) {
  return new Promise((resolve, reject) => {
    const sink = createWriteStream(outPath)
    const child = spawn(cmd, cmdArgs, {stdio: ['inherit', sink, 'inherit']})
    child.on('error', reject)
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd} exited ${code}`)),
    )
  })
}

async function main() {
  await run('node', [
    `${HERE}fetch-youtube.mjs`,
    ...(refresh ? ['--refresh'] : []),
  ])
  await runCapture('node', [`${HERE}build-video-ndjson.mjs`], out)
  console.log(`\nNDJSON written to ${out}`)

  if (doImport) {
    console.log(`Importing into ${dataset} (--replace) via the Sanity CLI...`)
    await run('npx', ['sanity', 'dataset', 'import', out, dataset, '--replace'], {
      cwd: STUDIO_DIR,
    })
  } else {
    console.log(
      `\nNext:\n  cd studio && npx sanity dataset import ${out} ${dataset} --replace`,
    )
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
