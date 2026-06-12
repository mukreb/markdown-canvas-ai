# Markdown Canvas AI

A web-based, **visual** markdown editor (WYSIWYG — you edit rendered markdown,
not raw syntax) with a built-in AI collaborator, inspired by ChatGPT's Canvas.

Three ways to work with the AI, all scoped the way you'd expect:

- **Select & prompt** — highlight any text, a floating toolbar appears, and you
  can ask the AI to rewrite *just that selection* (or use one-click Improve /
  Shorten / Expand / Fix). The result streams into a preview you accept or
  discard.
- **Comment & resolve** — leave a margin comment on a passage, then let the AI
  resolve it. The suggestion streams into the comment card; apply it with one
  click.
- **Chat** — ask questions about the whole document (optionally scoped to your
  current selection) in a side panel.

Plus: a formatting toolbar, live word count, and one-click markdown export.

## Architecture

| Layer    | Tech                                                            |
| -------- | -------------------------------------------------------------- |
| Editor   | [TipTap](https://tiptap.dev) (ProseMirror) + `tiptap-markdown` |
| Frontend | React + Vite + TypeScript                                      |
| Backend  | Express, streaming Server-Sent Events                          |
| AI       | Claude (`claude-opus-4-8`) via the official `@anthropic-ai/sdk` |

The browser never sees your API key — the React app calls the local Express
server (`/api/ai/*`), which streams Claude's output back over SSE.

```
React (TipTap)  ──POST /api/ai/edit | resolve-comment | chat──▶  Express  ──▶  Claude
       ▲                                                            │
       └──────────────── streamed text deltas (SSE) ───────────────┘
```

## Getting started

```bash
npm install
cp .env.example .env      # then add your ANTHROPIC_API_KEY
npm run dev               # runs the Vite client + Express server together
```

Open http://localhost:5173. The client proxies `/api` to the server on
`http://localhost:8787`.

### Scripts

| Script              | What it does                                  |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Client + server with hot reload               |
| `npm run build`     | Type-check and build the client to `dist/`    |
| `npm run start`     | Run the compiled server (`npm run build:server` first) |
| `npm run typecheck` | Type-check client and server                  |

## Configuration

| Env var             | Default           | Notes                          |
| ------------------- | ----------------- | ------------------------------ |
| `ANTHROPIC_API_KEY` | —                 | Required for the AI endpoints  |
| `ANTHROPIC_MODEL`   | `claude-opus-4-8` | Model used for all operations  |
| `PORT`              | `8787`            | Express server port            |

## Known limitations / roadmap

- **Markdown-aware apply.** AI output is currently inserted as plain text
  (prose-correct, but inline markdown like `**bold**` lands literally).
  Markdown-structured insertion is the next planned enhancement.
- Comments and document state live in memory only — no persistence yet.
- No multi-document or collaboration support yet.

## License

MIT
