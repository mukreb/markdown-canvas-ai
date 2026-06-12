import type { Editor } from "@tiptap/react";

interface EditorMenuBarProps {
  editor: Editor;
}

/** Top formatting bar for the visual editor. */
export function EditorMenuBar({ editor }: EditorMenuBarProps) {
  const btn = (active: boolean) => `mc-mb-btn${active ? " is-active" : ""}`;

  return (
    <div className="mc-menubar">
      <button
        className={btn(editor.isActive("bold"))}
        onClick={() => editor.chain().focus().toggleBold().run()}
        title="Bold (⌘B)"
      >
        <strong>B</strong>
      </button>
      <button
        className={btn(editor.isActive("italic"))}
        onClick={() => editor.chain().focus().toggleItalic().run()}
        title="Italic (⌘I)"
      >
        <em>I</em>
      </button>
      <button
        className={btn(editor.isActive("strike"))}
        onClick={() => editor.chain().focus().toggleStrike().run()}
        title="Strikethrough"
      >
        <s>S</s>
      </button>
      <button
        className={btn(editor.isActive("code"))}
        onClick={() => editor.chain().focus().toggleCode().run()}
        title="Inline code"
      >
        {"</>"}
      </button>

      <span className="mc-mb-sep" />

      {([1, 2, 3] as const).map((level) => (
        <button
          key={level}
          className={btn(editor.isActive("heading", { level }))}
          onClick={() => editor.chain().focus().toggleHeading({ level }).run()}
          title={`Heading ${level}`}
        >
          H{level}
        </button>
      ))}

      <span className="mc-mb-sep" />

      <button
        className={btn(editor.isActive("bulletList"))}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
        title="Bullet list"
      >
        • List
      </button>
      <button
        className={btn(editor.isActive("orderedList"))}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
        title="Numbered list"
      >
        1. List
      </button>
      <button
        className={btn(editor.isActive("taskList"))}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
        title="Task list"
      >
        ☑ Tasks
      </button>
      <button
        className={btn(editor.isActive("blockquote"))}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
        title="Quote"
      >
        " Quote
      </button>
      <button
        className={btn(editor.isActive("codeBlock"))}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        title="Code block"
      >
        {"{ }"}
      </button>
    </div>
  );
}
