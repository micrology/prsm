# PRSM API server

Express service that sits beside the PRSM frontend and websocket server. It provides:

1. **Map HTTP API** — read and modify live Yjs rooms (factors, links, styles, map metadata)
2. **AI chat proxy** — forwards factor/link/map LLM requests to **AWS Bedrock**
3. **Help Assistant** — RAG answers grounded in the PRSM user manual (Bedrock Knowledge Base + optional local cache)

Parent project overview: [../README.md](../README.md). Collaboration backend: [../ws-server/](../ws-server/).

## Layout

```text
api-server/
├── src/
│   ├── api-server.mjs    # Main Express app (production entry)
│   ├── secrets.mjs       # Load config from AWS Secrets Manager
│   ├── mergeWithAI.mjs   # CLI: merge several rooms with an LLM
│   ├── app.mjs           # Small browser test client for /api/chat
│   └── index.html        # Page that loads app.mjs (Parcel)
├── testAPI.sh            # Smoke-test script for map + AI endpoints
├── prsm-api-server.service
├── utils/                # Ops helpers (e.g. help-cache dump)
└── package.json
```

## Prerequisites

- Node.js (same generation as the rest of PRSM; 20+ recommended)
- A running **websocket server** the API can reach (`wss://…` in production, `ws://localhost:1234` in dev)
- For AI features: AWS account access to Bedrock (and optionally Secrets Manager + a Knowledge Base)

Install from this directory, or via the monorepo:

```bash
cd api-server && npm install
# or from repo root:
npm run install:all
```

## Running locally

The API always calls `loadSecrets()` on startup (see [Secrets](#secrets-and-configuration)). Ensure AWS credentials can read secret `prsm/api-server/config`, **or** pre-set the required environment variables and adapt `secrets.mjs` if you need a secrets-free local path.

```bash
# Dev mode: uses ws://localhost:1234 and PORT 3001
npm run local

# Same binary without NODE_ENV=dev (production websocket URL)
npm run serve
```

From the monorepo root, `npm run start:all-locally` starts `ws-server`, this API in dev mode, and the Parcel frontend together.

Optional tiny UI for chat experiments:

```bash
npm run dev          # Parcel serves src/index.html on port 4000
npm run build:app    # Build that page into dist/
```

Smoke test (adjust base URL and room id as needed; the room must already exist via the web UI):

```bash
./testAPI.sh http://localhost:3001 YOUR-ROOM-CODE-HERE
```

## Production (systemd)

Sample unit: [`prsm-api-server.service`](prsm-api-server.service). Install under `/etc/systemd/system/`, adjust paths/user, then:

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now prsm-api-server
journalctl -f -u prsm-api-server
```

Typical reverse-proxy setup exposes this service under `https://your-host/api/…` on the same origin as the static app (CORS defaults allow `https://prsm.uk` and localhost).

## Secrets and configuration

### AWS Secrets Manager

On start, [`src/secrets.mjs`](src/secrets.mjs) loads secret id **`prsm/api-server/config`** in `AWS_REGION` (default `eu-west-2`) and copies keys into `process.env` **only if** that env var is not already set. Existing environment variables win.

### Environment variables

| Variable | Default / notes | Purpose |
| --- | --- | --- |
| `PORT` | `3001` | HTTP listen port |
| `NODE_ENV` | — | Set to `dev` to use `ws://localhost:1234` instead of production WSS |
| `AWS_REGION` | `eu-west-2` | Bedrock + Secrets Manager region |
| `BEDROCK_API_KEY` | required for AI | Bearer token for Bedrock Runtime Converse |
| `MODEL_ID` | `eu.anthropic.claude-haiku-4-5-20251001-v1:0` | Primary (quality) chat / help model |
| `KNOWLEDGE_BASE_ID` | `48IIKVEPJC` | Bedrock KB for Help Assistant retrieval |
| `HELP_CACHE_LOCATION` | `./helpCache` | Classic-Level cache directory for help answers |
| `DONT_CACHE_HELP` | — | Set `true` to disable writing/using the help cache |
| `MAX_TOKENS` | `512` (chat) | Max output tokens for chat Converse calls |
| `MAX_PROMPT_LENGTH` | `30000` | Max combined user + system prompt length (chat) |
| `CHAT_SERVICE_TIER` | `standard` | Bedrock service tier for map chat |
| `HELP_SERVICE_TIER` | `standard` | Bedrock service tier for help answers |
| `REPHRASE_SERVICE_TIER` | `flex` | Tier for follow-up query rephrasing |
| `HELP_STRUCTURED_OUTPUT` | enabled unless `false` | Structured output path for help responses |

A cheaper model id is hard-coded for rephrase/merge-style work (`qwen.qwen3-235b-a22b-2507-v1:0` in current code).

### Rate limits

- Global: 20 requests / second / IP
- Chat + help: 5 requests / minute / IP
- Max concurrent chat handlers: 10 (then HTTP 503)

CORS origins: `https://prsm.uk`, `http://localhost`, `http://127.0.0.1`.

## HTTP API

Room ids must match `AAA-BBB-CCC-DDD` (four groups of three uppercase letters). Maps must already exist in the websocket store (created in the browser); the API checks `network.lastLoaded`.

Document names on the wire are `prsm` + room code (same convention as the frontend).

### AI

| Method | Path | Body | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/chat/:room` | `{ "message", "systemPrompt"? }` | Bedrock Converse; returns `{ response }` |
| `POST` | `/api/helpAssistant` | `{ "messages": [ … Bedrock-style turns … ] }` | RAG help; returns `{ response, sources }` |

### Map metadata

| Method | Path | Notes |
| --- | --- | --- |
| `GET` | `/api/map/:room` | Title, background, viewOnly, version, attribute titles, id/label lists |
| `PATCH` | `/api/map/:room` | Body `{ "update": { "title"?, "background"? } }` |
| `GET` | `/api/map/:room/allFactorsAndLinks` | Full factor + link objects (private UI fields stripped) |

### Factors

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/map/:room/factor/:factor` | — |
| `POST` | `/api/map/:room/factor/:factor` | `{ "spec": { "label": "…", … } }` |
| `PATCH` | `/api/map/:room/factor/:factor` | `{ "update": { … } }` |
| `DELETE` | `/api/map/:room/factor/:factor` | Also deletes incident links |

### Links

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/map/:room/link/:link` | — |
| `POST` | `/api/map/:room/link/:link` | `{ "spec": { "from", "to", … } }` |
| `PATCH` | `/api/map/:room/link/:link` | `{ "update": { … } }` |
| `DELETE` | `/api/map/:room/link/:link` | — |

### Styles

| Method | Path | Body |
| --- | --- | --- |
| `GET` | `/api/map/:room/styles` | All `group*` / `edge*` samples |
| `GET` | `/api/map/:room/styles/:style` | One style |
| `PATCH` | `/api/map/:room/styles/:style` | `{ "update": { … } }` |

Map mutations open a short-lived Yjs client, sync (10s timeout → HTTP 504), apply changes, then disconnect. Concurrent browser editors see updates through the same websocket room.

## CLI: merge maps with AI

[`src/mergeWithAI.mjs`](src/mergeWithAI.mjs) loads several rooms, asks Bedrock to merge them semantically, and writes a PRSM map file plus a Markdown synthesis report.

```bash
NODE_ENV=dev MODEL_ID='…' node src/mergeWithAI.mjs 'AAA-BBB-CCC-DDD' 'EEE-FFF-GGG-HHH'
```

See the file header for `CONTEXT`, `MAX_TOKENS`, `DEBUG`, and related env vars. Requires the same Bedrock secrets as the server.

## How the frontend reaches this service

- Production chat: same origin `/api/chat/…` (see `js/ai.js`)
- Local chat: `http://localhost:3001` when the page uses `debug=local`
- Help Assistant: `https://prsm.uk` or `http://localhost:3001` when the host is localhost (see `js/aiasst.js`)

## Licence

Part of PRSM. See [../License.md](../License.md).
