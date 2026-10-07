import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "../types.ts";

interface ChatPanelProps {
  messages: ChatMessage[];
  busy: boolean;
  hasSelection: boolean;
  onSend: (text: string) => void;
}

export function ChatPanel({ messages, busy, hasSelection, onSend }: ChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text || busy) return;
    onSend(text);
    setInput("");
  };

  return (
    <div className="mc-chat">
      <div className="mc-chat-scroll" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="mc-empty">
            <p>Ask anything about your document.</p>
            <p className="mc-hint">
              “Summarize this”, “What’s missing?”, “Suggest a stronger opening”.
            </p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`mc-msg mc-msg-${m.role}`}>
            <div className="mc-msg-role">{m.role === "user" ? "You" : "AI"}</div>
            <div className="mc-msg-body">
              {m.content}
              {m.pending && <span className="mc-caret" />}
            </div>
          </div>
        ))}
      </div>

      <div className="mc-chat-input">
        {hasSelection && (
          <div className="mc-scope">Scoped to your current selection</div>
        )}
        <textarea
          rows={2}
          value={input}
          placeholder="Message the AI about your document…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        <button className="mc-btn-primary" onClick={submit} disabled={busy || !input.trim()}>
          {busy ? "…" : "Send"}
        </button>
      </div>
    </div>
  );
}
