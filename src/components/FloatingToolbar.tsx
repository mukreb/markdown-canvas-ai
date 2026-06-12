interface FloatingToolbarProps {
  rect: DOMRect;
  onAsk: () => void;
  onQuick: (instruction: string, label: string) => void;
  onComment: () => void;
}

const QUICK_ACTIONS: { label: string; instruction: string }[] = [
  { label: "Improve", instruction: "Improve the clarity and flow of this text." },
  { label: "Shorten", instruction: "Make this text more concise without losing meaning." },
  { label: "Expand", instruction: "Expand this text with more detail and examples." },
  { label: "Fix", instruction: "Fix grammar, spelling, and punctuation in this text." },
];

/**
 * The small toolbar that appears above an active text selection — the entry
 * point for every selection-scoped AI action.
 */
export function FloatingToolbar({ rect, onAsk, onQuick, onComment }: FloatingToolbarProps) {
  const top = rect.top + window.scrollY - 46;
  const left = rect.left + window.scrollX + rect.width / 2;

  return (
    <div
      className="mc-toolbar"
      style={{ top, left }}
      // Keep the editor selection while interacting with the toolbar.
      onMouseDown={(e) => e.preventDefault()}
    >
      <button className="mc-toolbar-primary" onClick={onAsk}>
        <span className="mc-spark">✦</span> Ask AI
      </button>
      <span className="mc-divider" />
      {QUICK_ACTIONS.map((a) => (
        <button key={a.label} onClick={() => onQuick(a.instruction, a.label)}>
          {a.label}
        </button>
      ))}
      <span className="mc-divider" />
      <button onClick={onComment} title="Add a comment">
        💬 Comment
      </button>
    </div>
  );
}
