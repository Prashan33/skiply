import { openai } from "@ai-sdk/openai";
import { createMCPClient } from "@ai-sdk/mcp";
import { auth } from "@clerk/nextjs/server";
import { Output, generateText, stepCountIs, streamText } from "ai";
import { z } from "zod";

import { getPostHogClient } from "@/lib/posthog-server";
import { searchResponseSchema, SEARCH_QUERY_MAX_LENGTH } from "@/lib/search";

/**
 * Server-side search API (AGENTS.md §5, §7, §11).
 *
 * Two phases, because OpenAI's structured-output mode (`response_format`)
 * suppresses tool calls — a single `streamText` with both `output` and the MCP
 * tools never queries Sanity and just hallucinates slugs.
 *
 *  1. GATHER — `generateText` with the Sanity Context MCP GROQ tools and no
 *     forced output. `prepareStep` forces a tool call on the first step so the
 *     model always runs a real query. Its tool results are the only allowed
 *     source of lesson slugs.
 *  2. FORMAT — `streamText` with `output: Output.object(searchResponseSchema)`
 *     and no tools, fed only phase 1's findings. Streamed as JSON text; the
 *     client reads it with `useObject` and joins every slug against the
 *     Sanity-derived index, dropping anything not found.
 *
 * We deliberately do NOT inject the MCP `/initial-context` schema blob: it is
 * ~20k tokens for this dataset and blew the org's 30k TPM budget. A short inline
 * schema hint plus the `schema_explorer` tool is enough.
 *
 * Nothing here reaches the browser: the token, the OpenAI key, and the MCP URL
 * are read only in this Node route.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const MCP_URL = process.env.SANITY_CONTEXT_MCP_URL;
const SANITY_TOKEN = process.env.SANITY_API_READ_TOKEN;
const MODEL = process.env.OPENAI_SEARCH_MODEL || "gpt-4.1-mini";

/** Scope the agent to the two content types we surface, used only when the MCP URL has no Context doc. */
const GROQ_FILTER = '_type in ["course", "lesson"]';

/** Cap on the tool-result blob handed to phase 2 (AGENTS §12: never dump large arrays at the model). */
const MAX_FINDINGS_CHARS = 12_000;

const bodySchema = z.object({
  query: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
  /** Where the search was launched from — "initial_load" (arrived with ?q=) or "new_search". */
  source: z.enum(["initial_load", "new_search"]).optional(),
});

const SCHEMA_HINT = [
  "## Schema (only what you need)",
  "- course: title, slug.current, modules[] { title, lessons[]-> }",
  "- lesson: title, slug.current, keyPoints (string[]), videoUrl, duration, notes (Portable Text — match pt::text(notes), never the raw field)",
  "- A lesson has no course field. Resolve it: *[_type == \"course\" && references(^._id)][0].title",
  "",
  "## Example groq_query call",
  '*[_type == "lesson" && (title match "*server*" || title match "*action*" || pt::text(notes) match "*server*" || pt::text(notes) match "*action*")]{',
  '  "lessonSlug": slug.current, "lessonTitle": title, keyPoints,',
  '  "notesExcerpt": pt::text(notes)[0..300],',
  '  "courseTitle": *[_type == "course" && references(^._id)][0].title',
  "}",
].join("\n");

const GATHER_PROMPT = [
  "You query a learning catalog through the Sanity Context MCP GROQ tools and report grounded matches. You are a retrieval step, not a chatbot.",
  "",
  "## What to do",
  "- Use the `groq_query` tool to find every lesson relevant to the user's query. Use `schema_explorer` only if you are unsure of a field.",
  "- Text match is token-based. Wildcard every keyword (`term` -> `*term*`) and OR the terms together. Never match a whole phrase as one pattern.",
  "- Match on the lesson `title` AND on `pt::text(notes)`.",
  "",
  "## What to report",
  "For every lesson your queries actually returned, output one JSON object per line (JSONL) with exactly:",
  '  {"lessonSlug": <slug.current>, "lessonTitle": <title>, "courseTitle": <resolved course title>, "keyPoints": <keyPoints or []>, "notesExcerpt": <~300 chars of pt::text(notes)>, "why": <short phrase>}',
  "- Use the exact `slug.current` string from the query result. Never invent, guess, or reformat a slug.",
  "- If nothing matches, output the single line: NO_MATCHES",
  "- Output only the JSONL (or NO_MATCHES). No prose, no markdown, no code fences.",
  "",
  SCHEMA_HINT,
].join("\n");

const FORMAT_PROMPT = [
  "You turn grounded catalog findings into ranked search-result cards. Your only output is the structured object.",
  "",
  "## Grounding",
  "- The findings block is the ONLY source of truth. Only emit a `lessonSlug` that appears verbatim in the findings.",
  "- Never invent a course, lesson, slug, count, or timestamp. If the findings are empty or say NO_MATCHES, return { \"results\": [] }.",
  "",
  "## Ranking",
  "- Return every lesson in the findings, ranked best first. Do not cap the list.",
  "- Rank by specificity: the concept in the lesson title beats the concept in the notes excerpt, which beats a broad keyword hit. Put the score in `relevance` (0-1).",
  "",
  "## Fields",
  '- `kind`: default "lesson". Use "video" when the lesson\'s main value is watching a walkthrough or demo (judge from the title and notes excerpt).',
  "- `description`: one or two plain sentences, grounded only in that lesson's own title, keyPoints, or notes excerpt. No markdown. 240 characters max.",
  "- `startSeconds`: always 0 (transcript/chapter data is not ingested yet).",
].join("\n");

function mcpBaseUrl(): string {
  if (!MCP_URL) throw new Error("SANITY_CONTEXT_MCP_URL is not set");
  return MCP_URL;
}

/** True when the URL already points at a Context document (…/mcp/:project/:dataset/:slug). */
function hasContextSlug(url: string): boolean {
  const path = url.split("?")[0].replace(/\/+$/, "");
  const afterMcp = path.split("/mcp/")[1];
  return Boolean(afterMcp) && afterMcp.split("/").length >= 3;
}

/** The MCP endpoint, with a groqFilter query param when no Context document is applying one. */
function mcpRequestUrl(): string {
  const url = mcpBaseUrl();
  if (hasContextSlug(url)) return url;
  const u = new URL(url);
  if (!u.searchParams.has("groqFilter")) u.searchParams.set("groqFilter", GROQ_FILTER);
  return u.toString();
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const { userId } = await auth();
  const distinctId = userId ?? "anonymous";

  // The search action executes here — capture it server-side, once per POST.
  const posthog = getPostHogClient();
  if (posthog) {
    posthog.capture({
      distinctId,
      event: "search_performed",
      properties: {
        query: parsed.query,
        query_length: parsed.query.length,
        source: parsed.source ?? "new_search",
      },
    });
    await posthog.flush();
  }

  if (!MCP_URL || !SANITY_TOKEN || !process.env.OPENAI_API_KEY) {
    console.error("[search] missing env:", {
      SANITY_CONTEXT_MCP_URL: Boolean(MCP_URL),
      SANITY_API_READ_TOKEN: Boolean(SANITY_TOKEN),
      OPENAI_API_KEY: Boolean(process.env.OPENAI_API_KEY),
    });
    return Response.json({ error: "search_unavailable" }, { status: 503 });
  }

  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | undefined;
  try {
    mcpClient = await createMCPClient({
      transport: {
        type: "http",
        url: mcpRequestUrl(),
        headers: { Authorization: `Bearer ${SANITY_TOKEN}` },
      },
    });

    const allTools = await mcpClient.tools();
    // The schema blob would be the `initial_context` tool; we don't want it.
    const tools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) => name !== "initial_context"),
    ) as Parameters<typeof generateText>[0]["tools"];

    // ---- Phase 1: GATHER grounded matches via GROQ ----------------------------
    const gather = await generateText({
      model: openai(MODEL),
      system: GATHER_PROMPT,
      prompt: parsed.query,
      tools,
      stopWhen: stepCountIs(4),
      // Force a real query on the first step; let the model stop on its own after.
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0 ? { toolChoice: "required" } : {},
    });

    void mcpClient.close();
    mcpClient = undefined;

    const toolFindings = gather.steps
      .flatMap((s) => s.toolResults ?? [])
      .map((r) => {
        const out = (r as { output?: unknown }).output;
        return typeof out === "string" ? out : JSON.stringify(out);
      })
      .join("\n");

    const findings = `${toolFindings}\n${gather.text}`.trim().slice(0, MAX_FINDINGS_CHARS);
    console.log(
      "[search] q=%j model=%s steps=%d toolResults=%d findingsChars=%d",
      parsed.query,
      MODEL,
      gather.steps.length,
      gather.steps.reduce((n, s) => n + (s.toolResults?.length ?? 0), 0),
      findings.length,
    );

    // ---- Phase 2: FORMAT into ranked cards, streamed for useObject ----------
    const result = streamText({
      model: openai(MODEL),
      system: FORMAT_PROMPT,
      prompt: `User query: ${parsed.query}\n\nGrounded findings (the ONLY allowed source of lessonSlug values):\n${findings || "NO_MATCHES"}`,
      output: Output.object({ schema: searchResponseSchema }),
      onError: (event) => {
        console.error("[search] format stream error:", event.error);
      },
    });

    return result.toTextStreamResponse();
  } catch (err) {
    console.error("[search] route failed:", err);
    await mcpClient?.close().catch(() => {});
    if (posthog) {
      posthog.captureException(err, distinctId, { route: "/api/search" });
      await posthog.flush();
    }
    return Response.json({ error: "search_unavailable" }, { status: 503 });
  }
}
