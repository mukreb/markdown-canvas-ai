import type { Editor } from "@tiptap/react";
import { createNodeFromContent } from "@tiptap/core";

/**
 * Replace a document range with AI output, rendered as real markdown.
 *
 * The markdown is parsed by tiptap-markdown (so `**bold**`, lists, headings,
 * and links render visually), with its first paragraph unwrapped so the
 * replacement flows inline where the selection started. Because the editor
 * runs with `html: false`, angle-bracket text like `Use <T>` stays literal
 * instead of being interpreted as HTML.
 *
 * The parsed HTML is turned into nodes here rather than handed to
 * `insertContentAt` as a string: for output without any formatting,
 * `insertContentAt` inserts the raw string verbatim, which would leave
 * markdown-it's escapes (`&amp;`, `&lt;`) in the document as literal text.
 */
export function replaceRange(
  editor: Editor,
  range: { from: number; to: number },
  text: string,
): void {
  const markdown = text.replace(/\s+$/, "");
  const html = editor.storage.markdown.parser.parse(markdown, { inline: true });
  const content = createNodeFromContent(html, editor.schema, {
    parseOptions: { preserveWhitespace: "full" },
  });
  editor
    .chain()
    .focus()
    .insertContentAt({ from: range.from, to: range.to }, content)
    .run();
}
