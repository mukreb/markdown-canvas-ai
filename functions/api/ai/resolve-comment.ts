import { COMMENT_SYSTEM, buildCommentContent } from "../../../shared/ai";
import { jsonError, readJson, sseStream, type Env } from "../../_lib/stream";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) return jsonError("Server is missing ANTHROPIC_API_KEY", 500);
  const body = await readJson(request);
  if (typeof body.comment !== "string" || typeof body.selection !== "string") {
    return jsonError("comment and selection are required");
  }
  return sseStream(env, {
    system: COMMENT_SYSTEM,
    userContent: buildCommentContent(body as Parameters<typeof buildCommentContent>[0]),
  });
};
