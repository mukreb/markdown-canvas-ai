import { EDIT_SYSTEM, buildEditContent } from "../../../shared/ai";
import { jsonError, readJson, sseStream, type Env } from "../../_lib/stream";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.ANTHROPIC_API_KEY) return jsonError("Server is missing ANTHROPIC_API_KEY", 500);
  const body = await readJson(request);
  if (typeof body.instruction !== "string" || typeof body.selection !== "string") {
    return jsonError("instruction and selection are required");
  }
  return sseStream(env, {
    system: EDIT_SYSTEM,
    userContent: buildEditContent(body as Parameters<typeof buildEditContent>[0]),
  });
};
