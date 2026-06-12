import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, MAX_TOKENS } from "../../shared/ai";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL?: string;
}

/**
 * Build an SSE Response that streams a Claude completion. This is the Cloudflare
 * Workers counterpart to the Express `streamCompletion` — same event framing
 * (`delta` / `done` / `error`), but written to a Web ReadableStream.
 */
export function sseStream(
  env: Env,
  opts: { system: string; userContent: string; thinking?: boolean },
): Response {
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
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
