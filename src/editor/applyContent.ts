import type { Editor } from "@tiptap/react";

/**
 * Replace a document range with AI output, rendered as real markdown.
 *
 * `tiptap-markdown` overrides `insertContentAt` to parse string content as
 * markdown, so the AI's `**bold**`, lists, headings, and links render visually
 * (the "visual markdown" promise) instead of landing as literal syntax. The
 * first paragraph is unwrapped so the replacement flows inline where the
 * selection started, while any following blocks become proper block nodes.
 *
 * Because the editor is configured with `html: false`, raw angle-bracket text
 * like `Use <T> for generics` or a literal `<div>` is escaped and inserted as
 * literal text rather than being interpreted as HTML.
 */
export function replaceRange(
  editor: Editor,
  range: { from: number; to: number },
  text: string,
): void {
  const markdown = text.replace(/\s+$/, "");
  editor
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to: range.to }, markdown)
    .run();
}
