#!/bin/bash
#
# One-off helper: retry the video ids that YouTube rate-limited (HTTP 429)
# during the main ingestion run, then rebuild + re-import when they land.
#
# Installed as a cron job (every 30 min) by Claude on 2026-08-31. The script
# removes its own cron entry once all ids succeed OR after MAX_ATTEMPTS tries,
# so it is self-cleaning. Safe to run by hand too.
#
#   bash studio/scripts/ingest/retry-stragglers.sh

set -u
export PATH="/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

REPO="/Users/prashanadhikari/Desktop/coding/skiply"
INGEST="$REPO/studio/scripts/ingest"
CACHE="$INGEST/cache"
LOG="$INGEST/retry-stragglers.log"
STATE="$INGEST/.retry-stragglers.attempts"
NDJSON="/tmp/video-docs-stragglers.ndjson"
MAX_ATTEMPTS=16   # ~8 hours at every 30 min

IDS="2o5m1ovfl3c EXIgjIBu4EU Y21OR1OPC9A wh98s0XhMmQ UC5xf8FbdJc G8wDjV0N9tk TlHvYWVUZyc YLtlz88zrLg"

say() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*" >>"$LOG"; }

uninstall_cron() {
  crontab -l 2>/dev/null | grep -v 'retry-stragglers.sh' | crontab - 2>/dev/null
  say "cron entry removed"
}

cd "$REPO" || { say "cannot cd to repo"; exit 1; }

attempts=$(cat "$STATE" 2>/dev/null || echo 0)
attempts=$((attempts + 1))
echo "$attempts" >"$STATE"
say "attempt $attempts/$MAX_ATTEMPTS"

# How many of the 8 already have real captions cached?
have_captions() {
  local n=0 id f
  for id in $IDS; do
    f="$CACHE/$id.json"
    [ -f "$f" ] || continue
    grep -q '"captionKind": "empty"' "$f" && continue
    grep -q '"captionKind": "none"' "$f" && continue
    grep -q '"cues": \[\]' "$f" && continue
    n=$((n + 1))
  done
  echo "$n"
}

before=$(have_captions)
say "cached with captions before: $before/8"

if [ "$before" -lt 8 ]; then
  node "$INGEST/fetch-youtube.mjs" --only "$(echo "$IDS" | tr ' ' ',')" >>"$LOG" 2>&1
fi

after=$(have_captions)
say "cached with captions after: $after/8"

# Import whatever we have now (idempotent, --replace updates in place).
if [ "$after" -gt "$before" ] || [ "$after" -eq 8 ]; then
  node "$INGEST/build-video-ndjson.mjs" >"$NDJSON" 2>>"$LOG"
  ( cd "$REPO/studio" && npx --yes sanity dataset import "$NDJSON" production --replace ) >>"$LOG" 2>&1 \
    && say "import ok ($after/8 stragglers now have captions)" \
    || say "import FAILED — run manually: cd studio && npx sanity dataset import $NDJSON production --replace"
fi

if [ "$after" -eq 8 ]; then
  say "ALL 8 stragglers ingested — done"
  uninstall_cron
  rm -f "$STATE"
elif [ "$attempts" -ge "$MAX_ATTEMPTS" ]; then
  say "gave up after $MAX_ATTEMPTS attempts ($after/8 done). Remaining are still 429-blocked or unavailable."
  uninstall_cron
  rm -f "$STATE"
fi
