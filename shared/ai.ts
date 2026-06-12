/**
 * Shared AI logic used by BOTH runtimes:
 *  - the local Express dev server (server/index.ts), and
 *  - the Cloudflare Pages Functions (functions/api/ai/*).
 *
 * Only the streaming "plumbing" differs between the two (Node response vs. a Web
 * ReadableStream); the prompts and request shaping live here so they stay in sync.
 */

const MARKDOWN_RULES = `
You are working inside a markdown document editor. Output GitHub-Flavored
Markdown. Match the formatting, tone, heading levels, and voice of the
surrounding document. Do not wrap your answer in a code fence unless the
original text was itself a code block.`.trim();

const OUTPUT_ONLY = `
CRITICAL OUTPUT CONTRACT: Respond with ONLY the rewritten text that should
replace the user's selection. Do not add explanations, apologies, quotes,
labels like "Here is", or surrounding code fences. Do not include any reasoning
in your visible answer — output the final replacement text and nothing else.`.trim();

export const EDIT_SYSTEM = `${MARKDOWN_RULES}

The user has selected a span of text and given you an instruction for how to
change it. Rewrite the selected span according to the instruction, using the
full document only as context for tone and consistency.

${OUTPUT_ONLY}`;

export const COMMENT_SYSTEM = `${MARKDOWN_RULES}

The user attached a review comment to a span of text, the way an editor leaves a
margin note. Revise the commented span so that the comment is fully addressed.
If the comment is a question, answer it by improving the text rather than by
writing a reply. Preserve everything that the comment does not ask to change.

${OUTPUT_ONLY}`;

export const CHAT_SYSTEM = `${MARKDOWN_RULES}

You are a writing assistant embedded next to a markdown document. The user can
see and directly edit the document; you are their collaborator. Answer questions
about the document, suggest improvements, and help them think. When you propose
concrete replacement text, present it as a fenced markdown block so it is easy
to copy. Be concise and lead with the substance.`;

export const DEFAULT_MODEL = "claude-opus-4-8";
export const MAX_TOKENS = 8000;

const MAX_DOC_CHARS = 200_000;

export function clampDoc(doc: unknown): string {
  if (typeof doc !== "string") return "";
  return doc.length > MAX_DOC_CHARS ? doc.slice(0, MAX_DOC_CHARS) : doc;
}

export function buildEditContent(body: {
  instruction: string;
  selection: string;
  document?: unknown;
}): string {
  return [
    "<document>",
    clampDoc(body.document),
    "</document>",
    "",
    "<selection>",
    body.selection,
    "</selection>",
    "",
    "<instruction>",
    body.instruction,
    "</instruction>",
  ].join("\n");
}

export function buildCommentContent(body: {
  comment: string;
  selection: string;
  document?: unknown;
}): string {
  return [
    "<document>",
    clampDoc(body.document),
    "</document>",
    "",
    "<commented_text>",
    body.selection,
    "</commented_text>",
    "",
    "<comment>",
    body.comment,
    "</comment>",
  ].join("\n");
}

export function buildChatContent(body: {
  message: string;
  document?: unknown;
  selection?: string;
  history?: unknown;
}): string {
  const transcript = Array.isArray(body.history)
    ? body.history
        .filter(
          (m): m is { role: string; content: string } =>
            !!m && typeof (m as { content?: unknown }).content === "string",
        )
        .slice(-8)
        .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
        .join("\n\n")
    : "";

  return [
    "<document>",
    clampDoc(body.document),
    "</document>",
    body.selection
      ? `\n<current_selection>\n${body.selection}\n</current_selection>`
      : "",
    transcript ? `\n<conversation_so_far>\n${transcript}\n</conversation_so_far>` : "",
    "",
    "<user_message>",
    body.message,
    "</user_message>",
  ].join("\n");
}
