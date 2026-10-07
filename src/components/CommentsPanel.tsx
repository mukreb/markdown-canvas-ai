import type { Comment } from "../types.ts";

interface CommentsPanelProps {
  comments: Comment[];
  onResolve: (id: string) => void;
  onAccept: (id: string) => void;
  onDelete: (id: string) => void;
  onFocus: (id: string) => void;
}

export function CommentsPanel({
  comments,
  onResolve,
  onAccept,
  onDelete,
  onFocus,
}: CommentsPanelProps) {
  if (comments.length === 0) {
    return (
      <div className="mc-empty">
        <p>No comments yet.</p>
        <p className="mc-hint">
          Select text and choose <strong>💬 Comment</strong> to leave a note the
          AI can resolve.
        </p>
      </div>
    );
  }

  return (
    <div className="mc-comments">
      {comments.map((c) => (
        <div key={c.id} className={`mc-comment-card mc-comment-${c.status}`}>
          <blockquote
            className="mc-quote"
            onClick={() => onFocus(c.id)}
            title="Jump to text"
          >
            {c.quote}
          </blockquote>
          <div className="mc-comment-body">{c.body}</div>

          {c.suggestion !== undefined && (
            <div className="mc-preview mc-preview-compact">
              <div className="mc-preview-label">AI suggestion</div>
              <div className="mc-preview-body">
                {c.suggestion}
                {c.status === "resolving" && <span className="mc-caret" />}
              </div>
            </div>
          )}

          {c.error && <div className="mc-error">{c.error}</div>}

          <div className="mc-comment-actions">
            {c.status === "open" && (
              <button className="mc-btn-primary" onClick={() => onResolve(c.id)}>
                ✦ Resolve with AI
              </button>
            )}
            {c.status === "resolving" && (
              <button className="mc-btn" disabled>
                Resolving…
              </button>
            )}
            {c.status === "suggested" && (
              <>
                <button className="mc-btn-primary" onClick={() => onAccept(c.id)}>
                  ✓ Apply
                </button>
                <button className="mc-btn" onClick={() => onResolve(c.id)}>
                  ↻ Retry
                </button>
              </>
            )}
            {c.status === "resolved" && (
              <span className="mc-resolved-tag">✓ Resolved</span>
            )}
            <button className="mc-btn-ghost" onClick={() => onDelete(c.id)}>
              Delete
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
