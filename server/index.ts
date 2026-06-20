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

const serverKey = process.env.ANTHROPIC_API_KEY;
if (!serverKey) {
  console.warn(
    "[markdown-canvas-ai] ANTHROPIC_API_KEY is not set — users must bring their own key via the app UI.",
  );
}

const app = express();
app.use(cors());
app.use(express.json({ limit: "4mb" }));

/**
 * Resolve the API key for a request: the user-provided BYOK key (header set by
 * the app UI) wins; otherwise the server-configured key. Returns null if
 * neither is available.
 */
function resolveKey(req: Request): string | null {
  const userKey = req.headers["x-anthropic-key"];
  if (typeof userKey === "string" && userKey) return userKey;
  return serverKey ?? null;
}

/**
 * Stream a Claude completion to the client as Server-Sent Events.
 * Each text delta is a `delta` event; a final `done` event closes it; errors
 * are surfaced as an `error` event so the UI can react.
 */
async function streamCompletion(
  req: Request,
  res: Response,
  opts: { system: string; userContent: string; thinking?: boolean },
): Promise<void> {
  const apiKey = resolveKey(req);
  if (!apiKey) {
    res.status(401).json({
      error: "No API key. Add your Anthropic API key via the key button in the app.",
    });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const client = new Anthropic({ apiKey });
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
  await streamCompletion(req, res, {
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
  await streamCompletion(req, res, {
    system: COMMENT_SYSTEM,
    userContent: buildCommentContent(req.body),
  });
});

app.post("/api/ai/chat", async (req: Request, res: Response) => {
  if (typeof req.body?.message !== "string") {
    res.status(400).json({ error: "message is required" });
    return;
  }
  await streamCompletion(req, res, {
    system: CHAT_SYSTEM,
    userContent: buildChatContent(req.body),
    thinking: true,
  });
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    model: MODEL,
    hasServerKey: Boolean(serverKey),
    runtime: "express-dev",
  });
});

app.listen(PORT, () => {
  console.log(`[markdown-canvas-ai] server on http://localhost:${PORT} (model: ${MODEL})`);
});
