# PRSM websocket server (`ws-server`)

Yjs collaboration server used by PRSM rooms. Clients (browsers and the API server) connect over WebSocket, sync CRDT documents named `prsm` + room code, and optionally persist updates in **LevelDB**.

This is a memory-conscious fork/adaptation of the y-websocket server pattern, with custom LevelDB binding in `src/y-leveldb.js`.

Parent overview: [../README.md](../README.md). Map/AI HTTP API: [../api-server/](../api-server/).

## Layout

```text
ws-server/
├── src/
│   ├── server.js       # HTTP + WebSocket entry
│   ├── utils.js        # Doc lifecycle, awareness, persistence wiring
│   ├── y-leveldb.js    # LevelDB persistence for Yjs updates
│   └── callback.js     # Optional HTTP callback on doc changes
├── utilities/          # Offline DB maintenance (stop the server first)
│   ├── pruneDB.js
│   ├── compact-db.mjs
│   ├── clear-doc.mjs
│   ├── extractRoom.mjs
│   └── levelDBStats.mjs
├── backup-prsmdb.sh / restore-prsmdb.sh
├── BACKUP-README.md    # Production backup/restore runbook
├── websocket-server.service
└── package.json
```

## Prerequisites

- Node.js 20+ recommended
- Disk space for the LevelDB directory if persistence is enabled
- Only **one process** may open a given LevelDB path at a time

```bash
cd ws-server && npm install
# or from repo root:
npm run install:all
```

## Run locally

```bash
npm start
# equivalent to:
# YPERSISTENCE=./dbDir VERBOSE=1 node ./src/server.js
```

Default listen: `HOST=localhost`, `PORT=1234`.

Health check (plain HTTP on the same port):

```bash
npm test
# curl -v http://localhost:1234  → body "okay"
```

From the monorepo root, `npm run start:all-locally` starts this server with `YPERSISTENCE=./dbDir` (repo-root `dbDir`) together with the API and frontend.

### Frontend wiring

- Production clients use `wss://www.prsm.uk/wss` (reverse-proxied to this service).
- Local / non-standard HTTP ports, or `?debug=local`, use `ws://<hostname>:1234` (see root `js/prsm.js`).

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `HOST` | `localhost` | Bind address (`0.0.0.0` in Docker) |
| `PORT` | `1234` | Listen port |
| `YPERSISTENCE` | unset | LevelDB directory; if unset, docs are **in-memory only** |
| `VERBOSE` | — | `1` / `true` enables detailed logging |
| `GC` | enabled | Set `false` / `0` to disable Yjs GC (e.g. when relying on snapshots) |
| `CALLBACK_URL` | unset | If set, POST doc snapshots on change (see `callback.js`) |
| `CALLBACK_TIMEOUT` | `5000` | Callback HTTP timeout (ms) |
| `CALLBACK_DEBOUNCE_WAIT` | `2000` | Debounce before callback |
| `CALLBACK_DEBOUNCE_MAXWAIT` | `10000` | Max debounce wait |
| `CALLBACK_OBJECTS` | `{}` | JSON map of shared object name → type (`Map`, `Array`, …) |

WebSocket max payload is 256 MB (see `server.js`).

## Production (systemd)

Sample unit: [`websocket-server.service`](websocket-server.service).

```bash
# After copying/editing the unit:
sudo systemctl daemon-reload
sudo systemctl enable --now websocket-server
systemctl status websocket-server
journalctl -f -u websocket-server
```

The sample sets:

- `YPERSISTENCE=/data/prsm/dbDir`
- `VERBOSE=1`
- `node --max-old-space-size=4096`
- `MemoryMax=5G`

Adjust user, paths, and memory for your host.

## Docker

Image `docker.io/micrology/prsm-y-websocket` is built from [`../docker/docker-y-websocket/Dockerfile`](../docker/docker-y-websocket/Dockerfile) and composed in [`../docker/compose.yaml`](../docker/compose.yaml) (port **1234**, persistence under `/db`). See root README section *Running PRSM on your own network*.

## Persistence behaviour

When `YPERSISTENCE` is set:

- Updates are stored per document in LevelDB
- On load, updates are merged into the live doc
- After more than `PREFERRED_TRIM_SIZE` (500) stored updates, the doc is flushed/compacted to a single state

Without `YPERSISTENCE`, rooms vanish when the process exits (or when the last client leaves, depending on in-memory lifecycle).

## Backup and restore

LevelDB allows a single writer. Production backup uses a two-phase rsync with a brief service stop.

- Runbook: **[BACKUP-README.md](BACKUP-README.md)**
- Scripts in this directory: `backup-prsmdb.sh`, `restore-prsmdb.sh` (install to e.g. `/usr/local/bin` on the server)

**Important:** a full restore replaces **all** rooms.

## Offline utilities

**Stop the websocket server** before running tools that open the same LevelDB path.

| Script | Purpose |
| --- | --- |
| `utilities/pruneDB.js` | Delete non–read-only rooms with no `lastLoaded` or last loaded &gt; 6 months; then compact. Supports `--dry-run`, `--verbose`. |
| `utilities/compact-db.mjs` | Compact documents (skips rooms with too many updates; default max 10000). |
| `utilities/clear-doc.mjs` | Clear one document by name. |
| `utilities/extractRoom.mjs` | Export one room to a file (`-s` db, `-r` room, `-o` output). |
| `utilities/levelDBStats.mjs` | Room / DB statistics. |

Examples:

```bash
node utilities/pruneDB.js -s /path/to/dbDir -n          # dry-run
node utilities/pruneDB.js -s /path/to/dbDir -v
node utilities/compact-db.mjs /path/to/dbDir
node utilities/extractRoom.mjs -s /path/to/dbDir -r AAA-BBB-CCC-DDD -o room.prsm
node utilities/clear-doc.mjs /path/to/dbDir prsmAAA-BBB-CCC-DDD
```

Note: stored doc names are typically `prsm` + room code; room-facing tools may accept the bare room code—check each script’s usage banner.

## Licence

This package declares MIT in `package.json`. The wider PRSM product licence is PolyForm Noncommercial — see [../License.md](../License.md).
