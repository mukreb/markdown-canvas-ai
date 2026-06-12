import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

import { CHAT_SYSTEM, COMMENT_SYSTEM, EDIT_SYSTEM } from "./prompts.js";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn(
    "[markdown-canvas-ai] ANTHROPIC_API_KEY is not set — AI endpoints will return 500. " +
      "Copy .env.example to .env and add your key.",
  );
}

const client = new Anthropic({ apiKey });

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

/** Clamp very large documents so a single request can't blow past the budget. */
const MAX_DOC_CHARS = 200_000;
function clampDoc(doc: unknown): string {
  if (typeof doc !== "string") return "";
  return doc.length > MAX_DOC_CHARS ? doc.slice(0, MAX_DOC_CHARS) : doc;
}

/**
 * Stream a Claude completion to the client as Server-Sent Events.
 * Each text delta is emitted as a `delta` event; a final `done` event closes it.
 * Errors are surfaced as an `error` event so the UI can react.
 */
async function streamCompletion(
  res: Response,
  opts: {
    system: string;
    userContent: string;
    thinking?: boolean;
  },
): Promise<void> {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const stream = client.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      // Adaptive thinking improves quality on the conversational endpoint;
      // inline transforms omit it for snappier, lower-latency edits.
      ...(opts.thinking
        ? { thinking: { type: "adaptive" as const, display: "summarized" as const } }
        : {}),
      system: opts.system,
      messages: [{ role: "user", content: opts.userContent }],
    });

    stream.on("text", (textDelta: string) => send("delta", { text: textDelta }));

    const final = await stream.finalMessage();
    send("done", {
      stop_reason: final.stop_reason,
      usage: final.usage,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[markdown-canvas-ai] stream error:", message);
    send("error", { message });
  } finally {
    res.end();
  }
}

/**
 * Rewrite a selected span according to a free-form instruction.
 * Body: { instruction, selection, document }
 */
app.post("/api/ai/edit", async (req: Request, res: Response) => {
  const { instruction, selection, document } = req.body ?? {};
  if (typeof instruction !== "string" || typeof selection !== "string") {
    res.status(400).json({ error: "instruction and selection are required" });
    return;
  }

  const userContent = [
    "<document>",
    clampDoc(document),
    "</document>",
    "",
    "<selection>",
    selection,
    "</selection>",
    "",
    "<instruction>",
    instruction,
    "</instruction>",
  ].join("\n");

  await streamCompletion(res, { system: EDIT_SYSTEM, userContent });
});

/**
 * Resolve a review comment attached to a span of text.
 * Body: { comment, selection, document }
 */
app.post("/api/ai/resolve-comment", async (req: Request, res: Response) => {
  const { comment, selection, document } = req.body ?? {};
  if (typeof comment !== "string" || typeof selection !== "string") {
    res.status(400).json({ error: "comment and selection are required" });
    return;
  }

  const userContent = [
    "<document>",
    clampDoc(document),
    "</document>",
    "",
    "<commented_text>",
    selection,
    "</commented_text>",
    "",
    "<comment>",
    comment,
    "</comment>",
  ].join("\n");

  await streamCompletion(res, { system: COMMENT_SYSTEM, userContent });
});

/**
 * Free-form chat about the document, optionally scoped to a selection.
 * Body: { message, document, selection?, history? }
 */
app.post("/api/ai/chat", async (req: Request, res: Response) => {
  const { message, document, selection, history } = req.body ?? {};
  if (typeof message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const transcript = Array.isArray(history)
    ? history
        .filter(
          (m): m is { role: string; content: string } =>
            m && typeof m.content === "string",
        )
        .slice(-8)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n")
    : "";

  const userContent = [
    "<document>",
    clampDoc(document),
    "</document>",
    selection ? `\n<current_selection>\n${selection}\n</current_selection>` : "",
    transcript ? `\n<conversation_so_far>\n${transcript}\n</conversation_so_far>` : "",
    "",
    "<user_message>",
    message,
    "</user_message>",
  ].join("\n");

  await streamCompletion(res, {
    system: CHAT_SYSTEM,
    userContent,
    thinking: true,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey) });
});

app.listen(PORT, () => {
  console.log(`[markdown-canvas-ai] server on http://localhost:${PORT} (model: ${MODEL})`);
});
