import { useEffect, useRef, useState } from "react";
import { aiEdit } from "../api.ts";

interface EditPopoverProps {
  anchorRect: DOMRect;
  selectionText: string;
  documentText: string;
  /** When provided, the popover runs this instruction immediately on open. */
  autoInstruction?: string;
  onApply: (text: string) => void;
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
  const ranAuto = useRef(false);

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

  // Auto-run quick actions once; otherwise focus the input.
  useEffect(() => {
    if (autoInstruction && !ranAuto.current) {
      ranAuto.current = true;
      run(autoInstruction);
    } else if (!autoInstruction) {
      inputRef.current?.focus();
    }
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const top = anchorRect.bottom + window.scrollY + 8;
  const left = Math.max(12, anchorRect.left + window.scrollX);

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
          <button className="mc-btn" onClick={() => abortRef.current?.abort()}>
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
          <button className="mc-btn-primary" onClick={() => onApply(output)}>
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
