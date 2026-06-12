import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, MAX_TOKENS } from "../shared/ai";

export interface Env {
  /** Static assets binding (the built Vite client in ./dist). */
  ASSETS: Fetcher;
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

/**
 * Build an SSE Response that streams a Claude completion on the Workers
 * runtime. Same event framing as the Express dev server (`delta` / `done` /
 * `error`), written to a Web ReadableStream.
 *
 * `apiKey` is the resolved key for this request: the user-provided BYOK key
 * when present, otherwise the server-configured secret.
 */
export function sseStream(
  env: Env,
  apiKey: string,
  opts: { system: string; userContent: string; thinking?: boolean },
): Response {
  const client = new Anthropic({ apiKey });
  const model = env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      try {
        const stream = client.messages.stream({
          model,
          max_tokens: MAX_TOKENS,
          ...(opts.thinking
            ? { thinking: { type: "adaptive" as const, display: "summarized" as const } }
            : {}),
          system: opts.system,
          messages: [{ role: "user", content: opts.userContent }],
        });
        stream.on("text", (t: string) => send("delta", { text: t }));
        const final = await stream.finalMessage();
        send("done", { stop_reason: final.stop_reason, usage: final.usage });
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    return (await request.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function jsonError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
