import { useEffect, useRef, useState } from "react";

interface CommentComposerProps {
  anchorRect: DOMRect;
  quote: string;
  onSave: (body: string) => void;
  onCancel: () => void;
}

/** Small popover for writing a comment note on the current selection. */
export function CommentComposer({ anchorRect, quote, onSave, onCancel }: CommentComposerProps) {
  const [body, setBody] = useState("");
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const top = anchorRect.bottom + window.scrollY + 8;
  const left = Math.max(12, anchorRect.left + window.scrollX);

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
            if (body.trim()) onSave(body.trim());
          } else if (e.key === "Escape") {
            onCancel();
          }
        }}
      />
      <div className="mc-popover-actions">
        <button className="mc-btn-primary" disabled={!body.trim()} onClick={() => onSave(body.trim())}>
          Add comment
        </button>
        <button className="mc-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
