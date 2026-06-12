import { CHAT_SYSTEM, buildChatContent } from "../../../shared/ai";
import { jsonError, readJson, sseStream, type Env } from "../../_lib/stream";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) return jsonError("Server is missing ANTHROPIC_API_KEY", 500);
  const body = await readJson(request);
  if (typeof body.message !== "string") {
    return jsonError("message is required");
  }
  return sseStream(env, {
    system: CHAT_SYSTEM,
    userContent: buildChatContent(body as Parameters<typeof buildChatContent>[0]),
    thinking: true,
  });
};
