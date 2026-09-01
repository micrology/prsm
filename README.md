<!-- markdownlint-disable-file MD026 MD033-->
# Participatory System Mapper

[![Join the chat at https://gitter.im/PRSM-community/community](https://badges.gitter.im/PRSM-community/community.svg)](https://gitter.im/PRSM-community/community?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)
![PolyForm Noncommercial License](https://img.shields.io/badge/license-PolyForm%20Noncommercial-blue)
![Last commit](https://img.shields.io/github/last-commit/micrology/prsm)
![GitHub package.json version](https://img.shields.io/github/package-json/v/micrology/prsm)

## What is it?

The Participatory System Mapper (PRSM) is a browser app that makes it easy for a group of people to draw networks (or “maps”) of systems together.

A map can be anything that has items (*factors* / *nodes*) connected by links (*edges*). Examples include:

- People connected by knowing each other
- Factors or variables linked by causal relationships
- Theories expressed as variables and relationships
- Company boards and shared directors
- Scientists co-authoring papers
- and similar network structures

### Participatory system mapping

PRSM is designed so groups can collaborate on the same map, each on their own computer or tablet. People may work face to face, remotely over video, or with the built-in chat. Every edit is shared live with other participants in the same room (similar to Google Docs for text).

When you start the app, a private *room* is created for your map. Only people with the room link can see and edit it.

### More information

- Home page: [https://prsm.uk](https://prsm.uk)
- User guide: [https://prsm.uk/help.html](https://prsm.uk/help.html)
- Source code: [https://github.com/micrology/prsm](https://github.com/micrology/prsm)

---

## Contents

1. [For end users](#1-for-end-users)
2. [Running PRSM on your own network](#2-running-prsm-on-your-own-network)
3. [For developers: adapting and enhancing PRSM](#3-for-developers-adapting-and-enhancing-prsm)
4. [Licence](#licence)
5. [Acknowledgements](#acknowledgements)
6. [Contact](#contact)

---

## 1. For end users

No installation is required. Open a modern browser and go to:

**[https://prsm.uk/prsm.html](https://prsm.uk/prsm.html)**

Supported browsers (current two major versions of each):

- Chrome
- Firefox
- Safari
- Edge

Internet Explorer is not supported.

The public service is free to use under a [PolyForm Noncommercial License](https://polyformproject.org/licenses/noncommercial/1.0.0). See [Licence](#licence) for details.

If something goes wrong, or you have a suggestion, email [nigel@prsm.uk](mailto:nigel@prsm.uk).

---

## 2. Running PRSM on your own network

Use this section if you want PRSM on an intranet, a private server, or a single machine that can work offline.

### Strongly recommended: containers (Docker / Podman)

The easiest and most reliable way to self-host is the pre-built container images. Full end-user steps (including Windows / Mac / Linux notes) live in the user manual:

**[Running PRSM locally or on an intranet](https://prsm.uk/help.html#/manual/Advanced/RunningLocally)**  
(source: `doc/help/docs/manual/Advanced/RunningLocally.mdx`)

In short:

1. Install Python 3, [Podman](https://podman.io/getting-started/installation) (or Docker), and `podman-compose` / Docker Compose.
2. Use the compose file in this repo: [`docker/compose.yaml`](docker/compose.yaml).
3. From the `docker/` directory:

   ```bash
   podman machine init    # first time only, if required
   podman machine start   # if required
   podman-compose up -d
   ```

4. Open [http://localhost:8080](http://localhost:8080).

| Service | Image | Host port | Purpose |
| --- | --- | --- | --- |
| Static app + help | `docker.io/micrology/prsm-httpd` | **8080** | Web UI |
| Collaboration server | `docker.io/micrology/prsm-y-websocket` | **1234** | Live multi-user sync (Yjs) |

- Firewalls must allow **8080** and **1234** (or the ports you map in `compose.yaml`).
- Maps in the container are independent of maps on [prsm.uk](https://prsm.uk). You can still exchange maps via PRSM save/load files.
- By default, map data lasts only while the websocket container keeps its volume. For persistence across restarts, bind a host directory into the websocket service (see comments in `docker/compose.yaml` and the manual page above).
- **AI assistance and the HTTP map API are not available** in this simple container setup; they need the separate API service and external configuration (see [`api-server/`](api-server/)).

To stop:

```bash
podman-compose down
```

To refresh images after a new release:

```bash
podman-compose down
podman-compose pull
podman-compose up -d
```

Equivalent Docker Compose commands work the same way if you prefer Docker Engine instead of Podman.

### Alternative: bare-metal / VM install (advanced)

Only choose this if containers are not an option. You will need to run and wire several pieces yourself:

| Piece | Directory | Role |
| --- | --- | --- |
| Frontend build (`dist/`) | repo root | Static HTML/JS/CSS served by Apache, nginx, or similar |
| Websocket server | [`ws-server/`](ws-server/) | Collaboration + LevelDB persistence |
| API / AI proxy (optional) | [`api-server/`](api-server/) | Programmatic map API and AWS Bedrock bridge |
| User manual build (optional) | [`doc/help/`](doc/help/) | Help site assets |

High-level production outline:

1. Install a current **Node.js** (20 LTS or newer is a practical minimum; help tooling expects `>=20.9.0`. Container images currently build with Node 24).
2. Clone the repo and install dependencies (see [Developer setup](#developer-setup)).
3. Build the frontend (and help, if you serve it):

   ```bash
   npm run deploy
   # or step-by-step: install:all → build-vis-network → build → build-help
   ```

4. Serve the built files. Parcel output is in `dist/`. The repo root [`.htaccess`](.htaccess) rewrites pretty URLs into `dist/` for Apache; enable at least `mod_headers` (and typically `mod_rewrite` / `mod_deflate` as used in that file).

   ```bash
   sudo a2enmod headers   # Debian/Ubuntu
   sudo systemctl restart apache2
   ```

5. Run the websocket server with a persistent LevelDB directory (`YPERSISTENCE`). See [`ws-server/`](ws-server/) (including the sample `websocket-server.service`).
6. Optionally run the API server and configure secrets / env. See [`api-server/`](api-server/) (including `prsm-api-server.service`).
7. Put HTTPS and WebSocket upgrade (`wss`) in front of the services with your reverse proxy. The public deployment uses paths such as `wss://…/wss` for sync and `/api` for the API.

Backup and restore of the LevelDB store are documented under [`ws-server/`](ws-server/) (`BACKUP-README.md` and related scripts).

---

## 3. For developers: adapting and enhancing PRSM

This section is for people changing the code, adding features, or packaging their own deployment.

### Architecture (overview)

```text
Browser (html/ + js/ + css/)
    │  Yjs over WebSocket
    ▼
ws-server          ← live rooms, awareness, LevelDB persistence
    ▲
    │  (optional) same Yjs rooms
api-server         ← /api/map/…, /api/chat/…, help assistant, Bedrock
    │
Static host        ← Parcel build → dist/  (+ optional doc/help build)
```

Important libraries:

- [**yjs**](https://github.com/yjs/yjs) + [**y-websocket**](https://github.com/yjs/y-websocket) — multi-user CRDT sync
- [**vis-network**](https://visjs.org/) — network rendering (vendored, modified fork in [`vis-network/`](vis-network/))
- [**Parcel**](https://parceljs.org/) — frontend bundling into `dist/`
- Supporting UI libs include Hammer, Quill, Fabric, Tabulator, Bootstrap, and others listed in root `package.json`

AI features can be disabled at build/config time via `"features": { "ai": … }` in root `package.json`.

### Repository layout

```text
.
├── html/           # Browser entry pages (main map: prsm.html)
├── js/             # Frontend ES modules
├── css/            # Stylesheets
├── dist/           # Parcel build output (generated)
├── api-server/     # Map API + AWS Bedrock bridge  → see api-server/README
├── ws-server/      # Yjs websocket server           → see ws-server/README
├── vis-network/    # Modified vis-network fork      → see vis-network/README
├── doc/            # Examples, JSDoc, user manual   → see doc/README
│   ├── examples/
│   ├── help/       # Rspress user guide sources
│   └── jsdoc/
├── docker/         # Container images + compose.yaml
├── data/           # Sample / legacy maps
└── package.json    # Root scripts and frontend dependencies
```

Frontend modules under `js/` (high level):

| Module | Role |
| --- | --- |
| `prsm.js` | Main network pane and room lifecycle |
| `background.js` | Background drawing layer |
| `styles.js` / `samples.js` | Style editing and defaults |
| `files.js` | Import / export |
| `cluster.js` | Clustering |
| `table.js` | Data (table) view |
| `trophic.js` | Trophic layout |
| `betweenness.js` | Network statistics worker |
| `tutorial.js` | First-run tour |
| `projects.js` | Recent maps / projects menu |
| `utils.js` | Shared helpers |
| `merge.js` | Map merge / diff helpers |
| `ai.js` | LLM calls via the API server |
| `aiasst.js` | AI Help Assistant UI |
| `3d.js` | 3D view |
| `new-index.js` | Landing / index helpers |

Details for each backend or subproject belong in that directory’s own README once published:

- [`api-server/`](api-server/)
- [`ws-server/`](ws-server/)
- [`vis-network/`](vis-network/)
- [`doc/`](doc/)

### Prerequisites

- **git**
- **Node.js** 20.9+ (Node 22+ or 24 recommended; match what you use in production if possible)
- **npm** (comes with Node)
- For full local AI: AWS credentials / Bedrock access as described in `api-server/`
- For Apache-style deploys: `mod_headers` (and related modules used by `.htaccess`)

### Developer setup

```bash
git clone https://github.com/micrology/prsm.git
cd prsm

# Install root + subpackage dependencies
npm run install:all

# Optional: rebuild the vendored vis-network bundle after changing that fork
npm run build-vis-network

# Production-style frontend build
npm run build
```

One-shot production build chain (deps + vis-network + app + help):

```bash
npm run deploy
```

### Local development (full stack)

The root package can start the websocket server, API server (dev mode), and Parcel watch together:

```bash
npm run start:all-locally
```

This runs approximately:

- `ws-server` with `YPERSISTENCE=./dbDir` on port **1234**
- `api-server` with `NODE_ENV=dev` on port **3001** (talks to `ws://localhost:1234`)
- `parcel watch` on `html/*.html` (no HMR)

Stop everything started that way:

```bash
npm run stop:all-locally
```

#### Pointing the browser at local services

Production frontend defaults:

- WebSocket: `wss://www.prsm.uk/wss`
- AI / help API: same origin (or `https://prsm.uk` for the help assistant)

For local servers, open the app with the **`debug=local`** flag, for example:

```text
http://localhost:<parcel-or-http-port>/prsm.html?debug=local
```

With `debug=local` (or when the page is served from a non-standard HTTP port), the client uses:

- WebSocket `ws://<hostname>:1234`
- AI chat API `http://localhost:3001/api/chat/…`

The help assistant treats `localhost` / `127.0.0.1` as local and calls `http://localhost:3001`.

Other useful `debug=` tokens (comma-separated) are listed in the header comment in `js/prsm.js` (`yjs`, `gui`, `prompt`, `plain`, and others).

Root `.htaccess` CSP already allows `ws://localhost:1234` and `http://localhost:3001` for local connect targets when you serve via Apache with that file.

### Useful npm scripts (root)

| Script | Purpose |
| --- | --- |
| `npm run install:all` | `npm i` in root, `doc/help`, `api-server`, `vis-network`, `ws-server` |
| `npm run upgrade:all` | Upgrade dependencies in those packages |
| `npm run dev` | Clean `dist/` and Parcel-watch `html/*.html` |
| `npm run build` | Production Parcel build into `dist/` |
| `npm run clean` | Remove `dist/*` |
| `npm run build-vis-network` | Build the vendored network library |
| `npm run build-help` | Production user-manual build |
| `npm run build-help-locally` | Local help build |
| `npm run deploy` | `install:all` + vis-network + app + help builds |
| `npm run start:all-locally` | ws-server + api-server (dev) + Parcel watch |
| `npm run stop:all-locally` | Stop the local stack processes |
| `npm run lint` | ESLint with `--fix` on `js/*.js` |
| `npm run pretty` | Prettier on HTML/JS/CSS and related paths |
| `npm run spellcheck` | cspell on main sources and help MDX |
| `npm run check` | lint + spellcheck + help build + prettier |
| `npm run jsdoc` | Generate JSDoc under `doc/jsdoc` |
| `npm run analyse` | Parcel detailed bundle report |
| `npm run rebuild-docker` | Multi-arch build/push of published images |

Subpackages define additional scripts; see their READMEs and `package.json` files.

### Coding conventions

- Vanilla JS (ES2021+), HTML5, modern CSS — no SPA framework
- `camelCase` for variables/functions, `PascalCase` for classes, `UPPER_SNAKE_CASE` for constants
- Prefer CSS classes over inline styles
- Document public functions with JSDoc
- Format / lint with the root scripts above (`pretty`, `lint`)
- Keep changes aligned with existing file patterns; prefer simple, single-purpose functions

Browser targets are the `browserslist` in root `package.json` (last two versions of Chrome, Firefox, Safari, Edge).

There is no automated test suite at present.

### Configuration knobs developers often need

| Concern | Where |
| --- | --- |
| Enable / disable AI UI | `package.json` → `features.ai` |
| Default production WebSocket URL | `js/prsm.js` (`websocket` default) |
| Local WebSocket / API selection | URL `debug=local`; see `js/prsm.js`, `js/ai.js`, `js/aiasst.js` |
| API port, Bedrock, CORS, secrets | `api-server/` (env + Secrets Manager) |
| Websocket host/port/persistence | `ws-server/` (`HOST`, `PORT`, `YPERSISTENCE`, `VERBOSE`) |
| URL rewriting / CSP | `.htaccess` |
| Container packaging | `docker/` |

### Docker image rebuilds (maintainers)

Dockerfiles and comments live under `docker/`. Root script:

```bash
npm run rebuild-docker
```

builds and pushes multi-arch `micrology/prsm-y-websocket` and `micrology/prsm-httpd` images. Prefer the published images for ordinary self-hosting ([section 2](#2-running-prsm-on-your-own-network)).

---

## Licence

PRSM is Copyright (c) 2022– Nigel Gilbert ([prsm@prsm.uk](mailto:prsm@prsm.uk)).

It is available under the **[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0)**. Full text and notes are in [`License.md`](License.md).

For other uses (for example commercial or internal proprietary deployment under a different licence), contact the licensor at [prsm@prsm.uk](mailto:prsm@prsm.uk).

---

## Acknowledgements

Thanks to everyone who inspired, suggested, reviewed, and tested PRSM, including members of [CECAN](https://www.cecan.ac.uk/), [CRESS](https://cress.soc.surrey.ac.uk/), [Risk Solutions](https://www.risksol.co.uk/), and Robin Gilbert.

---

## Contact

Bug reports, feature requests, and other feedback: [nigel@prsm.uk](mailto:nigel@prsm.uk).
