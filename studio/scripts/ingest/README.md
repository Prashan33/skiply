# Video ingestion pipeline

Offline tooling (AGENTS §9) that fills the `video` documents with **timestamped
transcript chunks** and **creator chapter markers**. Nothing here runs in the
request path — it is run by hand when video content changes.

## Prerequisite

```bash
brew install yt-dlp      # or: pipx install yt-dlp
```

The `fetch` stage shells out to `yt-dlp`. A plain fetch of the caption URL from
the watch page no longer works — YouTube returns an empty response without a
proof-of-origin (`pot`) token, even from a browser / residential IP. `yt-dlp`
handles the player-client negotiation. `build` and `import` need no network.

## What it does

1. **fetch** (`fetch-youtube.mjs`) — for each unique video id in
   `../seed/videos.json`, runs `yt-dlp --skip-download --write-info-json
   --write-subs --write-auto-subs --sub-format json3` and writes the English
   caption cues + `info.json` `chapters` to `cache/<id>.json` (committed — the
   reproducible artifact).
2. **build** (`build-video-ndjson.mjs`) — groups the cached cues into short
   timestamped `chunks` (flush at ~200 chars or ~18 s), passes chapters through,
   and emits NDJSON `video` docs. `_id` follows `../seed/videos-to-ndjson.mjs`
   (`video.<id>`, `yt`-prefixed when the id starts with `-`/`_`).
3. **import** — `sanity dataset import <ndjson> production --replace` updates the
   existing 120 `video` docs in place (count stays 120). Auth = the logged-in
   Sanity CLI session; **no write token in the repo**.

Videos with captions disabled on YouTube land with `chunks: []`. Videos with no
creator chapters get `chapters: []` — search then falls back to transcript
matching (AGENTS §7).

## Run

```bash
# from repo root — 1. fetch (skips cached; retries entries that came back empty)
node studio/scripts/ingest/fetch-youtube.mjs        # --refresh re-fetches all; --only <id,id>
git add studio/scripts/ingest/cache && git commit -m "Ingest video transcripts + chapters"

# 2. build NDJSON + 3. import
node studio/scripts/ingest/build-video-ndjson.mjs > /tmp/video-docs.ndjson
cd studio && npx sanity dataset import /tmp/video-docs.ndjson production --replace

# or all three at once
node studio/scripts/ingest/ingest.mjs --out /tmp/video-docs.ndjson --import
```

`fetch` tally: `ok` = captions retrieved · `no-captions` = disabled on YouTube, or
an `empty` (transient) response — re-run to retry · `failed` = yt-dlp error.
If yt-dlp hits a bot check, set `YTDLP_COOKIES_FROM_BROWSER=chrome` (or `safari`).

## Providers

YouTube only — every entry in `videos.json` is YouTube. Vimeo/Bunny would each
need their own caption + chapter extraction before they count as supported.
