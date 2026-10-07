import { useEffect, useRef, useState } from "react";

interface CommentComposerProps {
  anchorRect: DOMRect;
  quote: string;
  /** Saves the comment; returns an error message if it couldn't. */
  onSave: (body: string) => string | void;
  onCancel: () => void;
}

/** Small popover for writing a comment note on the current selection. */
export function CommentComposer({ anchorRect, quote, onSave, onCancel }: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  const save = () => {
    const note = body.trim();
    if (!note) return;
    setError(onSave(note) || "");
  };

  useEffect(() => {
    ref.current?.focus();
  }, []);

  // Position once, in document coordinates, so a re-render after the page has
  // scrolled doesn't move the popover out from under the pointer.
  const [{ top, left }] = useState(() => ({
    top: anchorRect.bottom + window.scrollY + 8,
    left: Math.max(12, anchorRect.left + window.scrollX),
  }));

  return (
    <div className="mc-popover" style={{ top, left }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="mc-popover-head">
        💬 Add comment
        <button className="mc-x" onClick={onCancel} aria-label="Close">
          ✕
        </button>
      </div>
      <blockquote className="mc-quote mc-quote-static">{quote}</blockquote>
      <textarea
        ref={ref}
        className="mc-instruction"
        rows={2}
        placeholder="Leave a note — the AI can resolve it later…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            save();
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
      {error && <div className="mc-error">{error}</div>}
      <div className="mc-popover-actions">
        <button className="mc-btn-primary" disabled={!body.trim()} onClick={save}>
          Add comment
        </button>
        <button className="mc-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
