/**
 * Cloudflare Worker entry point: serves the AI API at /api/* and falls back to
 * the static assets (the built Vite client) for everything else.
 *
 * Key resolution is BYOK-first: a user-provided key (x-anthropic-key header,
 * entered in the UI and kept in the user's browser) wins; otherwise the
 * server-configured ANTHROPIC_API_KEY secret is used. With neither, AI
 * endpoints return 401 so the UI can prompt for a key.
 *
 * Deployed via `wrangler deploy` — see wrangler.toml ([assets] + main).
 */
import {
  CHAT_SYSTEM,
  COMMENT_SYSTEM,
  EDIT_SYSTEM,
  DEFAULT_MODEL,
  buildChatContent,
  buildCommentContent,
  buildEditContent,
} from "../shared/ai";
import { jsonError, readJson, sseStream, type Env } from "./stream";

export default {
  async fetch(request, env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (!pathname.startsWith("/api/")) {
      // With run_worker_first = ["/api/*"] static requests normally bypass the
      // Worker entirely; this fallback covers any path that still lands here.
      return env.ASSETS.fetch(request);
    }

    if (request.method === "GET" && pathname === "/api/health") {
      return new Response(
        JSON.stringify({
          ok: true,
          model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
          hasServerKey: Boolean(env.ANTHROPIC_API_KEY),
          runtime: "cloudflare-worker",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    if (request.method !== "POST") {
      return jsonError("Method not allowed", 405);
    }

    // BYOK first, server secret as fallback.
    const apiKey = request.headers.get("x-anthropic-key") || env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return jsonError(
        "No API key. Add your Anthropic API key via the key button in the app.",
        401,
      );
    }

    const body = await readJson(request);

    switch (pathname) {
      case "/api/ai/edit": {
        if (typeof body.instruction !== "string" || typeof body.selection !== "string") {
          return jsonError("instruction and selection are required");
        }
        return sseStream(env, apiKey, {
          system: EDIT_SYSTEM,
          userContent: buildEditContent(body as Parameters<typeof buildEditContent>[0]),
        });
      }
      case "/api/ai/resolve-comment": {
        if (typeof body.comment !== "string" || typeof body.selection !== "string") {
          return jsonError("comment and selection are required");
        }
        return sseStream(env, apiKey, {
          system: COMMENT_SYSTEM,
          userContent: buildCommentContent(
            body as Parameters<typeof buildCommentContent>[0],
          ),
        });
      }
      case "/api/ai/chat": {
        if (typeof body.message !== "string") {
          return jsonError("message is required");
        }
        return sseStream(env, apiKey, {
          system: CHAT_SYSTEM,
          userContent: buildChatContent(body as Parameters<typeof buildChatContent>[0]),
          thinking: true,
        });
      }
      default:
        return jsonError("Not found", 404);
    }
  },
} satisfies ExportedHandler<Env>;
