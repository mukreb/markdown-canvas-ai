import { DEFAULT_MODEL } from "../../shared/ai";
import { type Env } from "../_lib/stream";

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  return new Response(
    JSON.stringify({
      ok: true,
      model: env.ANTHROPIC_MODEL || DEFAULT_MODEL,
      hasKey: Boolean(env.ANTHROPIC_API_KEY),
      runtime: "cloudflare-pages-functions",
    }),
    { headers: { "Content-Type": "application/json" } },
  );
};
