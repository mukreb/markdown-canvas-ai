import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import Anthropic from "@anthropic-ai/sdk";

import {
  CHAT_SYSTEM,
  COMMENT_SYSTEM,
  EDIT_SYSTEM,
  DEFAULT_MODEL,
  MAX_TOKENS,
  buildChatContent,
  buildCommentContent,
  buildEditContent,
} from "../shared/ai.js";

const PORT = Number(process.env.PORT ?? 8787);
const MODEL = process.env.ANTHROPIC_MODEL ?? DEFAULT_MODEL;

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  console.warn(
    "[markdown-canvas-ai] ANTHROPIC_API_KEY is not set — AI endpoints will return errors. " +
      "Copy .env.example to .env and add your key.",
  );
}

const client = new Anthropic({ apiKey });

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

/**
 * Stream a Claude completion to the client as Server-Sent Events.
 * Each text delta is a `delta` event; a final `done` event closes it; errors
 * are surfaced as an `error` event so the UI can react.
 */
async function streamCompletion(
  res: Response,
  opts: { system: string; userContent: string; thinking?: boolean },
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
      max_tokens: MAX_TOKENS,
      ...(opts.thinking
        ? { thinking: { type: "adaptive" as const, display: "summarized" as const } }
        : {}),
      system: opts.system,
      messages: [{ role: "user", content: opts.userContent }],
    });

    stream.on("text", (textDelta: string) => send("delta", { text: textDelta }));

    const final = await stream.finalMessage();
    send("done", { stop_reason: final.stop_reason, usage: final.usage });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[markdown-canvas-ai] stream error:", message);
    send("error", { message });
  } finally {
    res.end();
  }
}

app.post("/api/ai/edit", async (req: Request, res: Response) => {
  const { instruction, selection } = req.body ?? {};
  if (typeof instruction !== "string" || typeof selection !== "string") {
    res.status(400).json({ error: "instruction and selection are required" });
    return;
  }
  await streamCompletion(res, {
    system: EDIT_SYSTEM,
    userContent: buildEditContent(req.body),
  });
});

app.post("/api/ai/resolve-comment", async (req: Request, res: Response) => {
  const { comment, selection } = req.body ?? {};
  if (typeof comment !== "string" || typeof selection !== "string") {
    res.status(400).json({ error: "comment and selection are required" });
    return;
  }
  await streamCompletion(res, {
    system: COMMENT_SYSTEM,
    userContent: buildCommentContent(req.body),
  });
});

app.post("/api/ai/chat", async (req: Request, res: Response) => {
  if (typeof req.body?.message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }
  await streamCompletion(res, {
    system: CHAT_SYSTEM,
    userContent: buildChatContent(req.body),
    thinking: true,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, model: MODEL, hasKey: Boolean(apiKey) });
});

app.listen(PORT, () => {
  console.log(`[markdown-canvas-ai] server on http://localhost:${PORT} (model: ${MODEL})`);
});
