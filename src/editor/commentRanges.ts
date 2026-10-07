import type { Editor } from "@tiptap/react";

export interface CommentRange {
  from: number;
  to: number;
  text: string;
}

/**
 * Walk the document and find the current position + text of a comment mark.
 * Marks move with edits, so this always reflects where the highlight is *now*.
 */
export function findCommentRange(
  editor: Editor,
  commentId: string,
): CommentRange | null {
  const markType = editor.state.schema.marks.comment;
  if (!markType) return null;

  let from = -1;
  let to = -1;

  editor.state.doc.descendants((node, pos) => {
    if (!node.isText) return;
    const hasMark = node.marks.some(
      (m) => m.type === markType && m.attrs.commentId === commentId,
    );
    if (hasMark) {
      if (from === -1) from = pos;
      to = pos + node.nodeSize;
    }
  });

  if (from === -1) return null;
  return { from, to, text: editor.state.doc.textBetween(from, to, "\n") };
}
