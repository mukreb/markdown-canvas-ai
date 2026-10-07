import type { MarkdownStorage } from "tiptap-markdown";

// tiptap-markdown doesn't register its storage with Tiptap 3's typed
// `editor.storage`, so declare it here.
declare module "@tiptap/core" {
  interface Storage {
    markdown: MarkdownStorage;
  }
}
