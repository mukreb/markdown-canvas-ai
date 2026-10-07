import { useEffect, useRef, useState } from "react";
import { aiEdit } from "../api.ts";

interface EditPopoverProps {
  anchorRect: DOMRect;
  selectionText: string;
  documentText: string;
  /** When provided, the popover runs this instruction immediately on open. */
  autoInstruction?: string;
  /** Applies the suggestion; returns an error message if it couldn't. */
  onApply: (text: string) => string | void;
  onClose: () => void;
}

type Status = "idle" | "streaming" | "done" | "error";

/**
 * The "Ask AI" panel anchored to a selection. Streams the rewrite live and lets
 * the user accept, discard, or refine — the Canvas-style inline edit loop.
 */
export function EditPopover({
  anchorRect,
  selectionText,
  documentText,
  autoInstruction,
  onApply,
  onClose,
}: EditPopoverProps) {
  const [instruction, setInstruction] = useState(autoInstruction ?? "");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const run = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setOutput("");
    setError("");
    setStatus("streaming");

    aiEdit(
      { instruction: trimmed, selection: selectionText, document: documentText },
      {
        signal: controller.signal,
        onDelta: (t) => setOutput((prev) => prev + t),
        onDone: () => setStatus("done"),
        onError: (m) => {
          setError(m);
          setStatus("error");
        },
      },
    );
  };

  // An aborted stream reports neither done nor error, so leave the streaming
  // state here. Back to idle (not done) so a cut-off rewrite can't be accepted.
  const stop = () => {
    abortRef.current?.abort();
    setStatus("idle");
  };

  const accept = () => {
    const applyError = onApply(output);
    if (applyError) {
      setError(applyError);
      setStatus("error");
    }
  };

  // Auto-run quick actions on open; otherwise focus the input. Under
  // StrictMode's dev-only effect replay, the cleanup aborts the first run and
  // the replayed effect starts it again.
  useEffect(() => {
    if (autoInstruction) run(autoInstruction);
    else inputRef.current?.focus();
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Position once, in document coordinates. Re-deriving it from the current
  // scroll on every render made the popover jump when the page had scrolled,
  // so a click could start on Accept and land on another button.
  const [{ top, left }] = useState(() => ({
    top: anchorRect.bottom + window.scrollY + 8,
    left: Math.max(12, anchorRect.left + window.scrollX),
  }));

  return (
    <div className="mc-popover" style={{ top, left }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="mc-popover-head">
        <span className="mc-spark">✦</span> Ask AI to edit the selection
        <button className="mc-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
      </div>

      <textarea
        ref={inputRef}
        className="mc-instruction"
        placeholder="e.g. make this more persuasive, rewrite for a 5th grader…"
        value={instruction}
        rows={2}
        onChange={(e) => setInstruction(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            run(instruction);
          }
        }}
      />

      <div className="mc-popover-actions">
        <button
          className="mc-btn-primary"
          disabled={status === "streaming" || !instruction.trim()}
          onClick={() => run(instruction)}
        >
          {status === "streaming" ? "Generating…" : "Generate"}
        </button>
        {status === "streaming" && (
          <button className="mc-btn" onClick={stop}>
            Stop
          </button>
        )}
      </div>

      {(output || status === "streaming") && (
        <div className="mc-preview">
          <div className="mc-preview-label">Suggestion</div>
          <div className="mc-preview-body">
            {output}
            {status === "streaming" && <span className="mc-caret" />}
          </div>
        </div>
      )}

      {error && <div className="mc-error">{error}</div>}

      {status === "done" && output && (
        <div className="mc-popover-actions">
          <button className="mc-btn-primary" onClick={accept}>
            ✓ Accept
          </button>
          <button className="mc-btn" onClick={() => run(instruction)}>
            ↻ Retry
          </button>
          <button className="mc-btn" onClick={onClose}>
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
