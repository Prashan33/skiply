# PostHog Self-driving Setup Report

Session replay, error tracking, and support are confirmed on. GitHub is connected. Five built-in scouts plus two custom learning-platform scouts are now active, and two Replay Vision scanners are watching session recordings for breakage and frustration. Findings will start appearing in the [Self-driving inbox](https://us.posthog.com/project/574608/inbox) within ~30 minutes.

---

## AI data processing

**Approved.** Organization-level AI data processing consent was confirmed before this run started.

---

## GitHub

**Already connected** — integration `Prashan33` (id: 260200) was present before this run. Self-driving can research findings in your repository and open fix PRs.

---

## Products enabled

| Product | Result | Notes |
|---|---|---|
| Session Replay | already enabled | posthog.init has no `disable_session_recording` override — server flip is in effect |
| Error Tracking | already enabled | posthog.init sets `capture_exceptions: true` — no override needed |
| Support (Conversations) | already enabled | Tickets only arrive once an inbound channel is connected — see Follow-ups |

---

## Signal sources

| source_product | source_type | Action |
|---|---|---|
| `health_checks` | `health_issue` | already enabled |
| `error_tracking` | `issue_created` | already enabled |
| `error_tracking` | `issue_reopened` | already enabled |
| `error_tracking` | `issue_spiking` | already enabled |
| `session_replay` | `session_analysis_cluster` | already enabled |
| `conversations` | `ticket` | already enabled |
| `signals_scout` | `cross_source_issue` | on by default — no row needed |

---

## Connected tools

User declined all issue-tracker and external-tool integrations. No connected-tool sources were created.

---

## Scout troop

**Run budget:** 100 runs/day (early access default). 0 runs used today. Banner: *"Scouts are in early access. Each project gets up to 100 scout runs a day. Contact team-self-driving@posthog.com if you need more."*

**Total active: 7 scouts** (at or under the 10-scout ceiling).

### Enabled

| Scout | Why |
|---|---|
| `signals-scout-general` | Always on — cross-product correlations and surfaces no specialist covers |
| `signals-scout-product-analytics` | posthog-js is initialized with autocapture; course/lesson events will flow through saved funnels |
| `signals-scout-web-analytics` | Next.js app with many page routes (catalog, course, lesson, instructor); web traffic is core |
| `signals-scout-observability-gaps` | New project — catches event volumes with no insight or alert coverage |
| `signals-scout-health-checks` | New setup — monitors PostHog instrumentation health (enabled this run) |
| `signals-scout-learning-funnel` *(custom)* | Watches lesson completion rate vs. lesson views; uncovered by built-in troop (see Custom scouts) |
| `signals-scout-video-engagement` *(custom)* | Watches video play rate and watch depth; uncovered by built-in troop (see Custom scouts) |

### Disabled

| Scout | Reason |
|---|---|
| `signals-scout-error-tracking` | **Intentional** — covered by the native error tracking source (issue_created / issue_reopened / issue_spiking). Not a re-enable candidate. |
| `signals-scout-session-replay` | **Intentional** — covered by the native session replay source (session_analysis_cluster). Not a re-enable candidate. |
| `signals-scout-feature-flags` | Not confirmed in use — enable if Clerk or other feature flags are adopted |
| `signals-scout-experiments` | No A/B experiments running — enable when experiments are launched |
| `signals-scout-surveys` | 0 surveys configured — enable when surveys are set up |
| `signals-scout-web-vitals` | Enable when more web vitals data accumulates (useful for video-heavy lesson pages) |
| `signals-scout-anomaly-detection` | Enable once baseline data is established (new project) |
| `signals-scout-conversations` | Enable when support tickets start flowing (inbound channel needed first) |
| `signals-scout-ai-observability` | No AI/LLM usage detected |
| `signals-scout-revenue-analytics` | No payment SDK detected |
| `signals-scout-logs` | PostHog logs product not in use |
| `signals-scout-csp-violations` | No CSP reporting configured |
| `signals-scout-customer-analytics` | No group/accounts analytics |
| `signals-scout-data-pipelines` | No CDP destinations or batch exports configured |
| `signals-scout-data-warehouse` | No warehouse imports |
| `signals-scout-apm` | No distributed tracing/OpenTelemetry |
| `signals-scout-replay-vision` | Left off by default — reads trends across accumulated observations; arm after scanners have run for a few weeks |
| `signals-scout-inbox-validation` | Fresh setup — no resolved reports to validate yet |
| `signals-scout-insight-alerts` | No alerts configured |
| `signals-scout-mcp-tool-calls` | No MCP tool call telemetry |
| `signals-scout-skills-store` | Not relevant for this product |
| `signals-scout-tasks` | No task/agent runs |

---

## Custom scouts

**2 custom scouts created** (7 total in troop, ceiling is 10).

### signals-scout-learning-funnel

- **What it watches:** lesson completion rate vs. lesson views, computed as a daily series over 30 days
- **Discriminator:** completion rate drops >20% relative to the 30-day baseline while lesson views hold at ≥80% of average — the classic "views hold, completions fall" funnel regression
- **Why no built-in covers it:** `signals-scout-product-analytics` watches *saved* funnel insights; a new project with no saved funnels gets nothing from it. This scout watches the raw event ratio directly.
- **Explore patterns:** per-lesson completion rate breakdown, session abandonment timing, deploy/flag correlation
- **Disqualifiers:** <10 lesson views, <5 users, recovering trend, weekend dip, no `lesson_completed` events yet (notes the gap in memory without repeating it)
- **Noise escape hatch:** set `emit: false` on this scout's config in PostHog to switch it to dry-run

### signals-scout-video-engagement

- **What it watches:** video play rate (plays / lesson page views) and watch depth per lesson, over a 14-day rolling window
- **Discriminator:** 7-day play rate drops >20% relative to the 14-day baseline while lesson views hold — signals learners arrive but stop starting the video
- **Why no built-in covers it:** no built-in scout tracks video-specific engagement; `signals-scout-web-analytics` watches per-channel traffic, not in-page video interaction
- **Explore patterns:** per-lesson play rate ranking, error correlation on lesson pages, provider-level breakdown (YouTube / Vimeo / Bunny)
- **Disqualifiers:** <10 lesson page views, <5 users, recovering trend, new project with no baseline yet (saves the rate as a new baseline, doesn't emit a false regression), no video events yet (saves to memory)
- **Noise escape hatch:** set `emit: false` on this scout's config in PostHog to switch it to dry-run

### Surfaces considered and ruled out

| Surface | Filter that ruled it out |
|---|---|
| AI-powered search | Not yet implemented (no search events will exist) |
| Learner drop-off by course | Overlaps with learning-funnel scout; would duplicate without adding a new discriminator |
| Auth funnel (Clerk sign-up → first lesson) | Clerk handles auth; PostHog captures auth pageviews via autocapture but not structured auth events — surface not ready |

---

## Replay Vision scanners

A **scanner** is an LLM that watches individual session recordings on a schedule, writes an observation per recording, and — with `emits_signals: true` — pushes confirmed defects into the Self-driving inbox. Findings arrive at half weight; they need corroboration from a second independent scanner or source before being promoted into a report. Scanners are the only part of this setup that spends Replay Vision quota.

Both monitor scanners were **already created in an earlier run** with `emits_signals: true` and product-specific prompts — no changes made.

| Scanner | Query scope | Sampling | Status |
|---|---|---|---|
| **Lesson and course page breakage** | Sessions where `$current_url` contains `/courses/` | 50% (`comprehensive`) | Already created, enabled, emits_signals on |
| **Learner frustration and navigation blocks** | Sessions containing a `$rageclick` event | 100% (`comprehensive`) | Already created, enabled, emits_signals on |

**Breakage monitor scope:** watches for blank screens, broken video embeds, failed navigations, unresponsive buttons, and stalled spinners on course and lesson pages — the product's core completion flow.

**Frustration monitor scope:** watches for repeated rage-clicks, stuck lesson cards, unresponsive video players, failed search retries, and abandoned flows anywhere in the product.

**No recordings yet?** The project is in early development. Both scanners are armed and start working the day recordings begin — no second setup needed.

**Credit spend:** 0 credits this month (no recordings matched yet). Each observation costs 5 credits.

---

## Follow-ups

- [ ] **Connect a Support inbound channel** — Conversations product is on, but tickets only flow once you connect an email address, inbox, or Slack channel in PostHog (Settings → Support).
- [ ] **Enable `signals-scout-feature-flags`** — turn on in PostHog if you adopt feature flags (Clerk, PostHog, or another provider).
- [ ] **Enable `signals-scout-experiments`** — turn on when A/B experiments are launched.
- [ ] **Enable `signals-scout-surveys`** — turn on when PostHog surveys are configured.
- [ ] **Enable `signals-scout-web-vitals`** — turn on once lesson pages have sufficient web vitals data (LCP/INP/CLS on video-heavy pages is worth watching).
- [ ] **Enable `signals-scout-anomaly-detection`** — turn on after a few weeks once a baseline of event data is established.
- [ ] **Enable `signals-scout-replay-vision`** — turn on after the Replay Vision scanners have accumulated a few weeks of observations.
- [ ] **Add issue-tracker integration** — if you adopt GitHub Issues, Linear, or Jira, connect it at https://us.posthog.com/project/574608/pipeline/new/source so Self-driving can research and open fixes against those records.
- [ ] **Instrument learning events** — make sure `lesson_completed`, `lesson_viewed`, `video_play`, and progress events are captured so the custom scouts have data to watch (per AGENTS.md instrumentation plan).

---

## What happens next

The scout coordinator picks up fresh configs within ~30 minutes and first scans fire on the next tick. Each scout run draws from the project's 100-run daily budget. Findings cluster into reports in the [Self-driving inbox](https://us.posthog.com/project/574608/inbox); immediately-actionable ones can trigger coding tasks automatically via GitHub.
