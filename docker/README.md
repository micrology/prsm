# PRSM Docker / Podman packaging

Container definitions for self-hosting PRSM without a full bare-metal install. For product context and the recommended self-host path, see the root [README](../README.md#2-running-prsm-on-your-own-network) and the user manual page *Running PRSM locally or on an intranet*.

## Contents

```text
docker/
├── compose.yaml                 # Pull & run published images
├── docker-httpd/Dockerfile      # Static UI + help (prsm-httpd)
├── docker-y-websocket/Dockerfile # Yjs server (prsm-y-websocket)
└── ws-server/db                 # Default host bind for map persistence
```

## Images

| Image | Role | Port |
| --- | --- | --- |
| `docker.io/micrology/prsm-httpd` | Serves built frontend (`dist/`) and help (`doc/help/doc_build/`) via `http-server` | **8080** |
| `docker.io/micrology/prsm-y-websocket` | Collaboration server from [`ws-server/`](../ws-server/) with `YPERSISTENCE=/db/dbDir` | **1234** |

Base image for both: `node:24-slim`.

**Not included:** the API / AI server (`api-server/`). Chat, Help Assistant, and the HTTP map API need a separate deployment.

## Run (recommended)

From this directory, with [Podman](https://podman.io/) + `podman-compose` (or Docker Compose):

```bash
cd docker
podman machine init && podman machine start   # first time / if needed
podman-compose up -d
```

Then open [http://localhost:8080](http://localhost:8080).

```bash
podman-compose down                 # stop
podman-compose pull && podman-compose up -d   # refresh images
```

Docker Compose equivalents (`docker compose …`) work the same way.

### Ports and firewall

- **8080** — web UI  
- **1234** — WebSocket sync (required for multi-user rooms)

Remap in `compose.yaml` if needed (`host:container`).

### Map persistence

`compose.yaml` bind-mounts `./ws-server/db` → `/db` on the websocket container so rooms survive restarts. Change `source:` to another host path if you prefer. Without a volume, data is lost when the container is removed.

### Debugging

```bash
podman exec -it docker_htppd_1 bash    # shell in the httpd container (name may vary)
```

## Build images yourself

Build from the **repository root** after a production frontend + help build (`npm run deploy` or equivalent), so `dist/` and `doc/help/doc_build/` exist for the httpd image.

```bash
# httpd
docker build -f docker/docker-httpd/Dockerfile -t micrology/prsm-httpd .
docker run -d -p 8080:8080 --name prsm-httpd micrology/prsm-httpd

# websocket
docker build -f docker/docker-y-websocket/Dockerfile -t micrology/prsm-y-websocket .
docker run -d -p 1234:1234 --name prsm-y-websocket micrology/prsm-y-websocket
```

Multi-arch publish (maintainers), also available as root `npm run rebuild-docker`:

```bash
docker buildx build --platform linux/amd64,linux/arm64 \
  -t micrology/prsm-httpd --push -f docker/docker-httpd/Dockerfile .

docker buildx build --platform linux/amd64,linux/arm64 \
  -t micrology/prsm-y-websocket --push -f docker/docker-y-websocket/Dockerfile .
```

## See also

- [`ws-server/README.md`](../ws-server/README.md) — env variables, LevelDB, backups  
- [`doc/README.md`](../doc/README.md) — building the help tree copied into `prsm-httpd`
