export interface Comment {
  id: string;
  /** The note the user wrote. */
  body: string;
  /** Snapshot of the text the comment was attached to, for display. */
  quote: string;
  status: "open" | "resolving" | "suggested" | "resolved";
  /** Streaming AI suggestion, shown before the user accepts it. */
  suggestion?: string;
  error?: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  pending?: boolean;
}

/** A captured editor selection: positions + the plain text it covered. */
export interface SelectionSnapshot {
  from: number;
  to: number;
  text: string;
}
