import type { Editor } from "@tiptap/react";
import type { Content } from "@tiptap/core";

/**
 * Turn AI text output into TipTap content for insertion.
 *
 * v1 applies AI output as plain text (prose-correct: rewrites, shortenings, and
 * expansions land cleanly). Multi-paragraph output is split into paragraph nodes
 * so block structure survives; single-block output is inserted inline so it
 * doesn't break the surrounding paragraph.
 *
 * NOTE: Markdown syntax in the output (e.g. **bold**) is currently inserted
 * literally. Markdown-aware insertion is the next planned enhancement.
 */
export function buildInsertContent(text: string): Content {
  const trimmed = text.replace(/\s+$/, "");
  if (!trimmed.includes("\n\n")) return trimmed;

  return trimmed.split(/\n{2,}/).map((para) => ({
    type: "paragraph",
    content: para ? [{ type: "text", text: para }] : [],
  }));
}

/** Replace a document range with AI output, then place the cursor after it. */
export function replaceRange(
  editor: Editor,
  range: { from: number; to: number },
  text: string,
): void {
  editor
    .chain()
    .focus()
    .insertContentAt(
      { from: range.from, to: range.to },
      buildInsertContent(text),
    )
    .run();
}
