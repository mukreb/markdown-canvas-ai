import { Mark, mergeAttributes } from "@tiptap/core";

/**
 * A mark that visually highlights a span and ties it to a comment by id.
 * Comments themselves live in React state; this mark is just the anchor in the
 * document so the highlighted range moves correctly as the user edits around it.
 */
export interface CommentMarkOptions {
  HTMLAttributes: Record<string, unknown>;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    comment: {
      setComment: (commentId: string) => ReturnType;
      unsetComment: (commentId: string) => ReturnType;
    };
  }
}

export const CommentMark = Mark.create<CommentMarkOptions>({
  name: "comment",
  // Comments should not be inclusive: typing at the edge of a highlight should
  // not extend the highlight.
  inclusive: false,
  excludes: "",

  addOptions() {
    return { HTMLAttributes: {} };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-comment-id"),
        renderHTML: (attrs) =>
          attrs.commentId ? { "data-comment-id": attrs.commentId } : {},
      },
      resolved: {
        default: false,
        parseHTML: (el) => (el as HTMLElement).getAttribute("data-resolved") === "true",
        renderHTML: (attrs) =>
          attrs.resolved ? { "data-resolved": "true" } : {},
      },
    };
  },

  parseHTML() {
    return [{ tag: "span[data-comment-id]" }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: "mc-comment",
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setComment:
        (commentId: string) =>
        ({ commands }) =>
          commands.setMark(this.name, { commentId, resolved: false }),
      unsetComment:
        (commentId: string) =>
        ({ tr, dispatch, state }) => {
          // Remove only the marks matching this id, anywhere in the doc.
          const markType = state.schema.marks.comment;
          state.doc.descendants((node, pos) => {
            node.marks.forEach((mark) => {
              if (mark.type === markType && mark.attrs.commentId === commentId) {
                tr.removeMark(pos, pos + node.nodeSize, mark);
              }
            });
          });
          if (dispatch) dispatch(tr);
          return true;
        },
    };
  },
});
