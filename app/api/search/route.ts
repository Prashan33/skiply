import { openai } from "@ai-sdk/openai";
import { createMCPClient } from "@ai-sdk/mcp";
import { Output, stepCountIs, streamText } from "ai";
import { z } from "zod";

import { searchResponseSchema, SEARCH_QUERY_MAX_LENGTH } from "@/lib/search";

/**
 * Server-side search API (AGENTS.md §5, §7, §11).
 *
 * Connects to the Sanity Context MCP over server-side HTTP with the private read
 * token as Bearer, injects the cached `/initial-context` schema blob plus an
 * inline system prompt, gives the model the MCP GROQ tools, and returns a
 * grounded structured payload (`searchResponseSchema`) streamed as JSON text —
 * the client reads it with `useObject`.
 *
 * Nothing here ever reaches the browser: the token, the OpenAI key, and the MCP
 * URL are read only in this Node route.
 */

export const runtime = "nodejs";
export const maxDuration = 30;

const MCP_URL = process.env.SANITY_CONTEXT_MCP_URL;
const SANITY_TOKEN = process.env.SANITY_API_READ_TOKEN;

/** Scope the agent to the two content types we surface (AGENTS §11 / dial-your-context). */
const GROQ_FILTER = '_type in ["course", "lesson"]';

const bodySchema = z.object({
  query: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
});

const SYSTEM_PROMPT = [
  "You search a learning catalog and return ranked, grounded result cards. You are not a chatbot: your only output is the structured object.",
  "",
  "## Grounding",
  "- Never invent a course, lesson, slug, count, or timestamp. Only emit lessonSlug values that appeared in your own GROQ query results.",
  "- If nothing matches, return { \"results\": [] }.",
  "- Scope: courses and lessons only. Never surface video, instructor, or category documents as results.",
  "",
  "## Query rules",
  "- Text match is token-based. Wildcard every keyword (term becomes *term*) and OR the terms together. Never match a whole phrase as one pattern.",
  "- lesson.notes is Portable Text; match its plain-text projection pt::text(notes), never the raw field.",
  "- A lesson does not store its course; resolve it with *[_type == \"course\" && references(^._id)][0].",
  "- Return every relevant lesson, ranked best first. Do not cap the list.",
  "- Rank by specificity: the concept in the lesson title beats the concept in notes, which beats a broad keyword hit. Put the score in `relevance` (0-1).",
  "",
  "## Result kinds",
  "- Default kind is \"lesson\". Use \"video\" when the lesson's main value is watching the video walkthrough or demo (judge from the title and notes).",
  "- Both kinds link to the lesson page; the app builds the link from lessonSlug.",
  "",
  "## Video moments",
  "- Transcript and chapter data is not available yet: every video document has empty chapters and chunks. Do not attempt timestamp matching. Always return startSeconds: 0.",
  "",
  "## description",
  "- One or two plain sentences, grounded only in that lesson's own title, notes, or keyPoints. No markdown. 240 characters max.",
].join("\n");

/** Cached once per server process. Changing it or the system prompt needs a restart (AGENTS §12). */
let cachedInitialContext: string | null = null;

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

async function getInitialContext(): Promise<string> {
  if (cachedInitialContext !== null) return cachedInitialContext;
  try {
    // /initial-context sits on the path, before any query string.
    const [path, query] = mcpRequestUrl().split("?");
    const url = `${path.replace(/\/+$/, "")}/initial-context${query ? `?${query}` : ""}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${SANITY_TOKEN}` },
    });
    cachedInitialContext = res.ok ? await res.text() : "";
  } catch {
    cachedInitialContext = "";
  }
  return cachedInitialContext;
}

export async function POST(request: Request) {
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(await request.json());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  if (!MCP_URL || !SANITY_TOKEN || !process.env.OPENAI_API_KEY) {
    return Response.json({ error: "search_unavailable" }, { status: 503 });
  }

  let mcpClient: Awaited<ReturnType<typeof createMCPClient>> | undefined;
  try {
    const [client, initialContext] = await Promise.all([
      createMCPClient({
        transport: {
          type: "http",
          url: mcpRequestUrl(),
          headers: { Authorization: `Bearer ${SANITY_TOKEN}` },
        },
      }),
      getInitialContext(),
    ]);
    mcpClient = client;

    const allTools = await mcpClient.tools();
    // The schema blob is already in the system prompt; drop the redundant tool.
    const tools = Object.fromEntries(
      Object.entries(allTools).filter(([name]) => name !== "initial_context"),
    );

    const system = initialContext
      ? `${SYSTEM_PROMPT}\n\n## Schema context\n${initialContext}`
      : SYSTEM_PROMPT;

    const result = streamText({
      model: openai("gpt-4.1"),
      system,
      prompt: parsed.query,
      tools: tools as Parameters<typeof streamText>[0]["tools"],
      stopWhen: stepCountIs(8),
      output: Output.object({ schema: searchResponseSchema }),
      onFinish: () => {
        void mcpClient?.close();
      },
      onError: () => {
        void mcpClient?.close();
      },
    });

    return result.toTextStreamResponse();
  } catch {
    await mcpClient?.close().catch(() => {});
    return Response.json({ error: "search_unavailable" }, { status: 503 });
  }
}
