# sample-video-moments.ndjson — TEST FIXTURE (not part of the content model)

Three real `video` documents patched with hand-authored `chapters` / `chunks` so the
two-stage timestamp resolver (`resolveVideoMoments` in `app/api/search/route.ts`) can be
demonstrated before the real `yt-dlp` ingestion pipeline has run. Every `video` doc in
`production` is otherwise empty (`chapters: []`, `chunks: []`).

| `_id`               | lesson                                   | exercises                        |
| ------------------- | ---------------------------------------- | -------------------------------- |
| `video.WKfPctdIDek` | Fetching data in server components       | chapter hit (stage 1)            |
| `video.VBlSe8tvg4U` | Caching and revalidation                 | no chapters → transcript hit (stage 2) |
| `video.rGPpQdbDbwo` | What server components actually do       | chapters present but none match  |

## Apply

```bash
cd studio
npx sanity dataset import scripts/seed/sample-video-moments.ndjson production --replace
```

## Revert / supersede

Running the real ingestion pipeline (`studio/scripts/ingest/`) and importing its output
with `--replace` overwrites these three docs with real data. To blank them again, import
the skeleton docs from `videos-to-ndjson.mjs`.
