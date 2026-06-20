/**
 * Minimal Server-Sent-Events client over fetch (EventSource only supports GET,
 * and we need to POST a JSON body). Parses the `event:`/`data:` SSE framing the
 * server writes and dispatches text deltas as they arrive.
 */
import { getApiKey } from "./apiKey.ts";

export interface StreamHandlers {
  onDelta: (text: string) => void;
  onDone?: (info: { stop_reason?: string; usage?: unknown }) => void;
  onError?: (message: string) => void;
  signal?: AbortSignal;
}

export interface EditRequest {
  instruction: string;
  selection: string;
  document: string;
}

export interface CommentRequest {
  comment: string;
  selection: string;
  document: string;
}

export interface ChatRequest {
  message: string;
  document: string;
  selection?: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

async function streamPost(
  url: string,
  body: unknown,
  handlers: StreamHandlers,
): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // BYOK: include the user's key (kept in their browser) when they set one.
  const apiKey = getApiKey();
  if (apiKey) headers["x-anthropic-key"] = apiKey;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: handlers.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") return;
    handlers.onError?.("Could not reach the server. Is it running?");
    return;
  }

  if (!res.ok || !res.body) {
    if (res.status === 401) {
      handlers.onError?.(
        "No API key set. Click the 🔑 button in the header to add your Anthropic API key.",
      );
      return;
    }
    handlers.onError?.(`Request failed (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() ?? "";
      for (const chunk of chunks) dispatchEvent(chunk, handlers);
    }
  } catch (err) {
    if ((err as Error)?.name !== "AbortError") {
      handlers.onError?.((err as Error)?.message ?? "Stream interrupted");
    }
  }
}

function dispatchEvent(raw: string, handlers: StreamHandlers): void {
  let event = "message";
  let data = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) data += line.slice(5).trim();
  }
  if (!data) return;

  let parsed: { text?: string; message?: string; stop_reason?: string; usage?: unknown };
  try {
    parsed = JSON.parse(data);
  } catch {
    return;
  }

  if (event === "delta" && typeof parsed.text === "string") handlers.onDelta(parsed.text);
  else if (event === "done") handlers.onDone?.(parsed);
  else if (event === "error") handlers.onError?.(parsed.message ?? "AI error");
}

export const aiEdit = (req: EditRequest, handlers: StreamHandlers) =>
  streamPost("/api/ai/edit", req, handlers);

export const aiResolveComment = (req: CommentRequest, handlers: StreamHandlers) =>
  streamPost("/api/ai/resolve-comment", req, handlers);

export const aiChat = (req: ChatRequest, handlers: StreamHandlers) =>
  streamPost("/api/ai/chat", req, handlers);
