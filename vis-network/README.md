# vis-network (PRSM fork)

PRSM-patched fork of [vis-network](https://github.com/visjs/vis-network): a browser library for dynamic network graphs.

This directory is **not** a drop-in unmodified upstream package. It is maintained inside the PRSM monorepo and consumed by the frontend as a local dependency (`import { Network } from '../vis-network/peer'`).

Parent overview: [../README.md](../README.md). Agent-oriented notes also live in [`AGENTS.md`](AGENTS.md).

## Why a fork?

PRSM needs behaviour that stock vis-network does not provide (or that was simplified away):

- **Interactive edge dragging** to bend links at runtime (`options.dragEdges`, implemented in `InteractionHandler`)
- A **peer-only** modern ES module build with unused upstream surface area removed
- Touch/mouse handling via **Pointer Events** (`lib/GestureHandler.js`) rather than Hammer as a library dependency of this package

## Layout

```text
vis-network/
├── lib/                 # Source (JS + TS)
│   ├── entry-peer.ts    # Parcel library entry
│   ├── entry-esnext.ts  # Public exports (Network, parsers, options)
│   └── network/         # Core engine modules
├── types/               # Hand-maintained / source types (copied into declarations)
├── declarations/        # Generated .d.ts (build output)
├── peer/esm/            # Generated ESM bundle + CSS (build output)
├── package.json
├── AGENTS.md
├── LICENSE-APACHE-2.0
└── LICENSE-MIT
```

## Build

Requires Node.js matching the rest of PRSM (20+ recommended).

```bash
cd vis-network
npm install
npm run build
```

From the monorepo root:

```bash
npm run build-vis-network
# included in: npm run deploy
```

| Script | Purpose |
| --- | --- |
| `npm run build` | Declarations + Parcel code bundle |
| `npm run build:declarations` | TypeScript declarations only |
| `npm run build:code` | Parcel library build only |
| `npm run build:watch` | Watch mode while iterating on the fork |
| `npm run clean` | Remove `declarations/`, `peer/`, `.parcel-cache` |

### Outputs

- `peer/esm/vis-network.mjs` — ES module
- `peer/esm/vis-network.css` — extracted styles
- `declarations/` — TypeScript types

Parcel is configured with `isLibrary: true` so peer dependencies stay external.

## Peer dependencies

The consuming app (root PRSM `package.json`) must provide:

- `component-emitter`
- `keycharm`
- `vis-data` (≥ 8)
- `vis-util` (≥ 6)

`uuid` is bundled in this package. Gestures no longer require Hammer inside this fork.

## Architecture (short)

The `Network` class (`lib/network/Network.js`) coordinates modules through shared `this.body` state:

| Module | Role |
| --- | --- |
| `Canvas` / `CanvasRenderer` | DOM and render loop |
| `View` | Pan / zoom |
| `InteractionHandler` | Pointer events, **edge drag curvature** |
| `SelectionHandler` | Selection |
| `NodesHandler` / `EdgesHandler` | Data |
| `PhysicsEngine` | Force layout |
| `LayoutEngine` | Hierarchical / initial layout |
| `ClusterEngine` | Clustering |
| `ManipulationSystem` | Edit UI |

Edge implementations live under `lib/network/modules/components/edges/` (`BezierEdgeDynamic`, `BezierEdgeStatic`, `CubicBezierEdge`, `StraightEdge`, …).

Options and validation schemas: `lib/network/options.ts`.

### Edge dragging

- Enable with `options.dragEdges`
- `onDragStart` detects an edge; `onDrag` updates smooth curvature via `_updateEdgeCurvature` (`smooth.roundness`)

## How PRSM uses it

Root frontend imports the peer build, for example from `js/prsm.js`. After changing this fork, rebuild **before** (or as part of) the root Parcel build so `peer/esm` stays in sync.

Browserslist matches PRSM root (last two Chrome / Firefox / Safari / Edge).

## Upstream

- Upstream project: https://github.com/visjs/vis-network  
- Docs: https://visjs.github.io/vis-network/  
- Do not assume npm `vis-network` releases include PRSM patches

## Licence

Dual-licensed **Apache-2.0 OR MIT** (see `LICENSE-APACHE-2.0` and `LICENSE-MIT`), consistent with upstream vis.js network licensing. PRSM’s application licence is separate: [../License.md](../License.md).
