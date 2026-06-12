import { useCallback, useEffect, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";
import Highlight from "@tiptap/extension-highlight";
import Typography from "@tiptap/extension-typography";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import CharacterCount from "@tiptap/extension-character-count";

import { CommentMark } from "./editor/CommentMark.ts";
import { findCommentRange } from "./editor/commentRanges.ts";
import { replaceRange } from "./editor/applyContent.ts";
import { SAMPLE_DOC } from "./editor/sampleDoc.ts";
import { aiChat, aiResolveComment } from "./api.ts";
import type { ChatMessage, Comment, SelectionSnapshot } from "./types.ts";

import { getApiKey } from "./apiKey.ts";
import { ApiKeyDialog } from "./components/ApiKeyDialog.tsx";
import { EditorMenuBar } from "./components/EditorMenuBar.tsx";
import { FloatingToolbar } from "./components/FloatingToolbar.tsx";
import { EditPopover } from "./components/EditPopover.tsx";
import { CommentComposer } from "./components/CommentComposer.tsx";
import { CommentsPanel } from "./components/CommentsPanel.tsx";
import { ChatPanel } from "./components/ChatPanel.tsx";

interface SelInfo {
  rect: DOMRect;
  text: string;
}

type Action =
  | { kind: "edit"; snapshot: SelectionSnapshot; rect: DOMRect; autoInstruction?: string }
  | { kind: "comment"; snapshot: SelectionSnapshot; rect: DOMRect };

const uid = () =>
  globalThis.crypto?.randomUUID?.() ?? `id-${Date.now()}-${Math.random()}`;

export default function App() {
  const [selInfo, setSelInfo] = useState<SelInfo | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatBusy, setChatBusy] = useState(false);
  const [tab, setTab] = useState<"comments" | "chat">("comments");

  // BYOK state: does the user have a personal key, and does the deployment
  // have a server-side fallback key?
  const [hasUserKey, setHasUserKey] = useState(() => Boolean(getApiKey()));
  const [hasServerKey, setHasServerKey] = useState(true); // optimistic until /health answers
  const [showKeyDialog, setShowKeyDialog] = useState(false);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: { hasServerKey?: boolean; hasKey?: boolean }) =>
        setHasServerKey(Boolean(h.hasServerKey ?? h.hasKey)),
      )
      .catch(() => {
        /* server unreachable — errors will surface on first AI call */
      });
  }, []);

  const keyMissing = !hasUserKey && !hasServerKey;

  const updateSelection = useCallback((editor: ReturnType<typeof useEditor>) => {
    if (!editor) return;
    const { from, to, empty } = editor.state.selection;
    const text = empty ? "" : editor.state.doc.textBetween(from, to, "\n");
    if (!text.trim()) {
      setSelInfo(null);
      return;
    }
    let rect: DOMRect | null = null;
    const domSel = window.getSelection();
    if (domSel && domSel.rangeCount > 0) {
      const r = domSel.getRangeAt(0).getBoundingClientRect();
      if (r.width || r.height) rect = r;
    }
    if (!rect) {
      const start = editor.view.coordsAtPos(from);
      const end = editor.view.coordsAtPos(to);
      rect = new DOMRect(
        Math.min(start.left, end.left),
        Math.min(start.top, end.top),
        Math.abs(end.right - start.left) || 1,
        Math.max(end.bottom - start.top, 16),
      );
    }
    setSelInfo({ rect, text });
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Markdown.configure({ html: false, transformPastedText: true }),
      Highlight,
      Typography,
      Link.configure({ openOnClick: false, autolink: true }),
      Placeholder.configure({ placeholder: "Start writing, or paste some markdown…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      CommentMark,
    ],
    content: SAMPLE_DOC,
    autofocus: "end",
    onSelectionUpdate: ({ editor }) => updateSelection(editor),
  });

  const docText = () =>
    (editor?.storage.markdown?.getMarkdown?.() as string | undefined) ?? "";

  const snapshotSelection = (): SelectionSnapshot | null => {
    if (!editor) return null;
    const { from, to } = editor.state.selection;
    if (from === to) return null;
    return { from, to, text: editor.state.doc.textBetween(from, to, "\n") };
  };

  // --- Selection-scoped AI editing ---------------------------------------

  const openEdit = (autoInstruction?: string) => {
    const snapshot = snapshotSelection();
    if (!snapshot || !selInfo) return;
    setAction({ kind: "edit", snapshot, rect: selInfo.rect, autoInstruction });
  };

  const applyEdit = (text: string) => {
    if (!editor || action?.kind !== "edit") return;
    replaceRange(editor, action.snapshot, text);
    setAction(null);
    setSelInfo(null);
  };

  // --- Comments -----------------------------------------------------------

  const openComment = () => {
    const snapshot = snapshotSelection();
    if (!snapshot || !selInfo) return;
    setAction({ kind: "comment", snapshot, rect: selInfo.rect });
  };

  const saveComment = (body: string) => {
    if (!editor || action?.kind !== "comment") return;
    const id = uid();
    editor
      .chain()
      .focus()
      .setTextSelection({ from: action.snapshot.from, to: action.snapshot.to })
      .setComment(id)
      .run();
    setComments((prev) => [
      { id, body, quote: action.snapshot.text, status: "open" },
      ...prev,
    ]);
    setAction(null);
    setSelInfo(null);
    setTab("comments");
  };

  const resolveComment = (id: string) => {
    if (!editor) return;
    const comment = comments.find((c) => c.id === id);
    const range = findCommentRange(editor, id);
    if (!comment) return;
    if (!range) {
      setComments((prev) =>
        prev.map((c) =>
          c.id === id ? { ...c, status: "open", error: "Commented text no longer exists." } : c,
        ),
      );
      return;
    }

    setComments((prev) =>
      prev.map((c) =>
        c.id === id ? { ...c, status: "resolving", suggestion: "", error: undefined } : c,
      ),
    );

    aiResolveComment(
      { comment: comment.body, selection: range.text, document: docText() },
      {
        onDelta: (t) =>
          setComments((prev) =>
            prev.map((c) =>
              c.id === id ? { ...c, suggestion: (c.suggestion ?? "") + t } : c,
            ),
          ),
        onDone: () =>
          setComments((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: "suggested" } : c)),
          ),
        onError: (m) =>
          setComments((prev) =>
            prev.map((c) => (c.id === id ? { ...c, status: "open", error: m } : c)),
          ),
      },
    );
  };

  const acceptComment = (id: string) => {
    if (!editor) return;
    const comment = comments.find((c) => c.id === id);
    const range = findCommentRange(editor, id);
    if (!comment?.suggestion || !range) return;
    replaceRange(editor, range, comment.suggestion);
    editor.commands.unsetComment(id);
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: "resolved" } : c)),
    );
  };

  const deleteComment = (id: string) => {
    editor?.commands.unsetComment(id);
    setComments((prev) => prev.filter((c) => c.id !== id));
  };

  const focusComment = (id: string) => {
    if (!editor) return;
    const range = findCommentRange(editor, id);
    if (!range) return;
    editor
      .chain()
      .focus()
      .setTextSelection({ from: range.from, to: range.to })
      .scrollIntoView()
      .run();
  };

  // --- Chat ---------------------------------------------------------------

  const sendChat = (text: string) => {
    const history = chat
      .filter((m) => !m.pending)
      .map((m) => ({ role: m.role, content: m.content }));
    setChat((prev) => [
      ...prev,
      { role: "user", content: text },
      { role: "assistant", content: "", pending: true },
    ]);
    setChatBusy(true);

    const appendToLast = (t: string) =>
      setChat((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last?.role === "assistant") next[next.length - 1] = { ...last, content: last.content + t };
        return next;
      });

    aiChat(
      { message: text, document: docText(), selection: selInfo?.text, history },
      {
        onDelta: appendToLast,
        onDone: () => {
          setChatBusy(false);
          setChat((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant") next[next.length - 1] = { ...last, pending: false };
            return next;
          });
        },
        onError: (m) => {
          setChatBusy(false);
          setChat((prev) => {
            const next = [...prev];
            const last = next[next.length - 1];
            if (last?.role === "assistant")
              next[next.length - 1] = {
                ...last,
                pending: false,
                content: last.content || `⚠️ ${m}`,
              };
            return next;
          });
        },
      },
    );
  };

  // --- Export -------------------------------------------------------------

  const exportMarkdown = () => {
    const blob = new Blob([docText()], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "document.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const words = editor?.storage.characterCount?.words?.() ?? 0;
  const openComments = comments.filter((c) => c.status !== "resolved").length;

  return (
    <div className="mc-app">
      <header className="mc-header">
        <div className="mc-brand">
          <span className="mc-spark">✦</span> Markdown Canvas AI
        </div>
        <div className="mc-header-meta">
          <span className="mc-wordcount">{words} words</span>
          <button
            className={`mc-btn${keyMissing ? " mc-btn-attention" : ""}`}
            onClick={() => setShowKeyDialog(true)}
            title={
              hasUserKey
                ? "Using your personal API key"
                : hasServerKey
                  ? "Using the server's API key — optionally add your own"
                  : "No API key — add yours to enable AI"
            }
          >
            🔑 {hasUserKey ? "Your key" : hasServerKey ? "API key" : "Add API key"}
          </button>
          <button className="mc-btn" onClick={exportMarkdown}>
            ⬇ Export .md
          </button>
        </div>
      </header>

      {keyMissing && (
        <div className="mc-keybanner">
          AI features need an Anthropic API key.{" "}
          <button onClick={() => setShowKeyDialog(true)}>Add your key</button> — it
          stays in your browser.
        </div>
      )}

      <div className="mc-body">
        <main className="mc-main">
          {editor && <EditorMenuBar editor={editor} />}
          <div className="mc-editor-wrap">
            <EditorContent editor={editor} className="mc-editor" />
          </div>
        </main>

        <aside className="mc-sidebar">
          <div className="mc-tabs">
            <button
              className={tab === "comments" ? "is-active" : ""}
              onClick={() => setTab("comments")}
            >
              Comments {openComments > 0 && <span className="mc-badge">{openComments}</span>}
            </button>
            <button
              className={tab === "chat" ? "is-active" : ""}
              onClick={() => setTab("chat")}
            >
              Chat
            </button>
          </div>
          <div className="mc-tab-content">
            {tab === "comments" ? (
              <CommentsPanel
                comments={comments}
                onResolve={resolveComment}
                onAccept={acceptComment}
                onDelete={deleteComment}
                onFocus={focusComment}
              />
            ) : (
              <ChatPanel
                messages={chat}
                busy={chatBusy}
                hasSelection={Boolean(selInfo)}
                onSend={sendChat}
              />
            )}
          </div>
        </aside>
      </div>

      {selInfo && !action && (
        <FloatingToolbar
          rect={selInfo.rect}
          onAsk={() => openEdit()}
          onQuick={(instruction) => openEdit(instruction)}
          onComment={openComment}
        />
      )}

      {action?.kind === "edit" && (
        <EditPopover
          anchorRect={action.rect}
          selectionText={action.snapshot.text}
          documentText={docText()}
          autoInstruction={action.autoInstruction}
          onApply={applyEdit}
          onClose={() => setAction(null)}
        />
      )}

      {action?.kind === "comment" && (
        <CommentComposer
          anchorRect={action.rect}
          quote={action.snapshot.text}
          onSave={saveComment}
          onCancel={() => setAction(null)}
        />
      )}

      {showKeyDialog && (
        <ApiKeyDialog
          hasServerKey={hasServerKey}
          onClose={() => setShowKeyDialog(false)}
          onSaved={setHasUserKey}
        />
      )}
    </div>
  );
}
