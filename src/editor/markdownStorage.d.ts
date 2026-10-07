import type { MarkdownStorage } from "tiptap-markdown";

// tiptap-markdown doesn't register its storage with Tiptap 3's typed
// `editor.storage`, so declare it here. `parser` is set by tiptap-markdown at
// runtime but missing from its published types.
declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage & {
      parser: { parse(content: string, options?: { inline?: boolean }): string };
    };
  }
}
