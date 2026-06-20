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

Plus: a formatting toolbar, live word count, one-click markdown export — and
applied AI output renders as **real markdown** (bold, lists, headings, links),
with raw HTML escaped so text like `Use <T>` stays literal.

## API keys: BYOK or server key

The app works in two modes (they can be combined):

- **BYOK (bring your own key)** — users click the 🔑 button and paste their own
  Anthropic API key. It is stored **only in their browser** (localStorage) and
  sent as a header with each AI request; the server uses it for that single
  call and never stores it. This means you can host the app **without any
  server-side key**.
- **Server key** — set the `ANTHROPIC_API_KEY` secret and the deployment pays
  for all usage. Users can still override with a personal key.

A user-provided key always takes precedence over the server key.

## Architecture

| Layer    | Tech                                                            |
| -------- | --------------------------------------------------------------- |
| Editor   | [TipTap](https://tiptap.dev) (ProseMirror) + `tiptap-markdown`  |
| Frontend | React + Vite + TypeScript                                       |
| Backend  | Express (local dev) **or** a Cloudflare Worker (production)     |
| AI       | Claude (`claude-opus-4-8`) via the official `@anthropic-ai/sdk` |

The React app calls `/api/ai/*`, which streams Claude's output back over
Server-Sent Events. The same AI logic (`shared/ai.ts`) backs both the local
Express server and the Cloudflare Worker, so behavior stays identical.

```
React (TipTap)  ──POST /api/ai/edit | resolve-comment | chat──▶  /api/*  ──▶  Claude
       ▲                                                            │
       └──────────────── streamed text deltas (SSE) ───────────────┘
```

## Local development

```bash
npm install
cp .env.example .env      # optionally add a server-side ANTHROPIC_API_KEY
npm run dev               # runs the Vite client + Express server together
```

Open http://localhost:5173. The client proxies `/api` to the Express server on
`http://localhost:8787`. Without a server key, add your personal key via the 🔑
button in the app.

## Deploy to Cloudflare

The repo is set up for **Cloudflare Workers with static assets**: one Worker
(`worker/index.ts`) serves the API at `/api/*` and the built Vite client as
static assets — no separate backend.

### Git-connected (recommended — what the Workers Builds flow runs)

In the Cloudflare dashboard → **Workers & Pages → Create → Workers → Connect to
Git**, pick this repo. The defaults match this repo's setup:

| Setting        | Value                |
| -------------- | -------------------- |
| Build command  | `npm run build`      |
| Deploy command | `npx wrangler deploy` |

Every push then builds and deploys automatically.

**Optional:** add an `ANTHROPIC_API_KEY` secret (Worker → Settings → Variables
and Secrets → Add → Secret) if you want the deployment to work without users
bringing their own key.

### CLI

```bash
npm run deploy                                # build + wrangler deploy
npx wrangler secret put ANTHROPIC_API_KEY     # optional server key
```

To test the Cloudflare runtime locally: `npm run cf:dev`.

## Scripts

| Script              | What it does                                      |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Client + Express server with hot reload           |
| `npm run build`     | Type-check and build the client to `dist/`        |
| `npm run cf:dev`    | Build, then serve via Cloudflare's local runtime  |
| `npm run deploy`    | Build and deploy to Cloudflare Workers            |
| `npm run typecheck` | Type-check client, server, and worker             |

## Configuration

| Env var / secret    | Default           | Notes                                        |
| ------------------- | ----------------- | -------------------------------------------- |
| `ANTHROPIC_API_KEY` | —                 | Optional server key; users can BYOK instead  |
| `ANTHROPIC_MODEL`   | `claude-opus-4-8` | Model used for all operations                |
| `PORT`              | `8787`            | Express dev server port                      |

## Known limitations / roadmap

- Comments and document state live in memory only — no persistence yet.
- No multi-document or collaboration support yet.
- BYOK keys live in localStorage; as with any BYOK web app, use a key with a
  spending limit.

## License

MIT
