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
| Backend  | Express (local dev) **or** Cloudflare Pages Functions (prod)   |
| AI       | Claude (`claude-opus-4-8`) via the official `@anthropic-ai/sdk` |

The browser never sees your API key. The React app calls `/api/ai/*`, which
streams Claude's output back over Server-Sent Events. The same AI logic
(`shared/ai.ts`) backs both the local Express server and the Cloudflare
Functions, so behavior stays identical across environments.

```
React (TipTap)  ──POST /api/ai/edit | resolve-comment | chat──▶  /api/*  ──▶  Claude
       ▲                                                            │
       └──────────────── streamed text deltas (SSE) ───────────────┘
```

## Local development

```bash
npm install
cp .env.example .env      # then add your ANTHROPIC_API_KEY
npm run dev               # runs the Vite client + Express server together
```

Open http://localhost:5173. The client proxies `/api` to the Express server on
`http://localhost:8787`.

## Deploy to Cloudflare Pages

The repo is set up for **Cloudflare Pages** with **Pages Functions** (in
`functions/`) serving the API at the edge — no separate backend to run.

1. **Set your API key as a secret** (do this once):

   ```bash
   npx wrangler pages secret put ANTHROPIC_API_KEY
   ```

   Or add it in the Cloudflare dashboard under your Pages project →
   **Settings → Variables and Secrets**.

2. **Deploy** (builds the client to `dist/` and uploads it + the functions):

   ```bash
   npm run deploy
   ```

### Or connect the Git repo (CI builds)

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to
Git**, pick this repo and use:

| Setting               | Value           |
| --------------------- | --------------- |
| Build command         | `npm run build` |
| Build output directory | `dist`          |

Then add the `ANTHROPIC_API_KEY` secret in the project settings. Every push
deploys automatically. `compatibility_flags = ["nodejs_compat"]` is already set
in `wrangler.toml` (the Anthropic SDK needs it on the Workers runtime).

To test the Cloudflare runtime locally:

```bash
npm run pages:dev        # builds, then serves via `wrangler pages dev`
```

## Scripts

| Script              | What it does                                       |
| ------------------- | -------------------------------------------------- |
| `npm run dev`       | Client + Express server with hot reload            |
| `npm run build`     | Type-check and build the client to `dist/`         |
| `npm run pages:dev` | Build, then serve via Cloudflare's local runtime   |
| `npm run deploy`    | Build and deploy to Cloudflare Pages               |
| `npm run typecheck` | Type-check client, server, and functions           |

## Configuration

| Env var / secret    | Default           | Notes                          |
| ------------------- | ----------------- | ------------------------------ |
| `ANTHROPIC_API_KEY` | —                 | Required for the AI endpoints  |
| `ANTHROPIC_MODEL`   | `claude-opus-4-8` | Model used for all operations  |
| `PORT`              | `8787`            | Express dev server port        |

## Known limitations / roadmap

- Comments and document state live in memory only — no persistence yet.
- No multi-document or collaboration support yet.

Applied AI output is rendered as real markdown — `**bold**`, lists, headings,
and links come through as formatting, not literal syntax (with raw HTML escaped
so text like `Use <T>` stays literal).

## License

MIT
