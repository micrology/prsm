# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

This is a PRSM-patched fork of [vis-network](https://github.com/visjs/vis-network), a browser-based network graph visualization library. The key custom feature is **interactive edge dragging** to adjust edge curvature at runtime.

This directory is a submodule within the larger PRSM project (https://github.com/micrology/prsm.git).

## Build Commands

```bash
npm run build              # Full build: declarations + code bundles
npm run build:declarations # Generate TypeScript declarations only
npm run build:code         # Generate JS bundles only (Parcel)
npm run build:watch        # Watch mode for development
npm run clean              # Remove generated files (declarations, peer, .parcel-cache)
```

## Build Output

- `peer/esm/vis-network.mjs` - ES module bundle
- `peer/esm/vis-network.css` - Extracted CSS
- `declarations/` - TypeScript declaration files

The build uses Parcel with `isLibrary: true` to externalize peer dependencies. Targets modern ES6+ browsers (no polyfills).

## Architecture

### Entry Points
- `lib/entry-peer.ts` → Main entry for peer builds (re-exports entry-esnext)
- `lib/entry-esnext.ts` → Exports Network class, parsers, and options

### Core Class: Network (`lib/network/Network.js`)
The Network class orchestrates these modules via `this.body` shared state:

| Module | Purpose |
|--------|---------|
| `Canvas` | DOM/canvas management |
| `CanvasRenderer` | Render loop |
| `View` | Camera, zoom, pan |
| `InteractionHandler` | Touch/mouse events, **edge dragging** |
| `SelectionHandler` | Node/edge selection |
| `NodesHandler` / `EdgesHandler` | Data management |
| `PhysicsEngine` | Force simulation |
| `LayoutEngine` | Hierarchical/initial layout |
| `ClusterEngine` | Node clustering |
| `ManipulationSystem` | Add/edit/delete UI |

### Custom Edge Dragging Feature
Located in `InteractionHandler.js` - enables dragging edges to modify their curvature:
- `options.dragEdges` enables the feature
- `onDragStart()` detects edge selection
- `onDrag()` calls `_updateEdgeCurvature()` to adjust `smooth.roundness`

Edge types: `BezierEdgeDynamic`, `BezierEdgeStatic`, `CubicBezierEdge`, `StraightEdge` in `lib/network/modules/components/edges/`

### Configuration
All options defined in `lib/network/options.ts` with validation schemas.

## Peer Dependencies

This build externalizes these packages (must be provided by the consuming app):
- `@egjs/hammerjs` - Touch gestures
- `component-emitter` - Event emitter
- `keycharm` - Keyboard shortcuts
- `uuid` - ID generation
- `vis-data` - DataSet/DataView
- `vis-util` - Utilities, Configurator, Validator

## File Conventions

- `.ts` files for new code, `.js` for legacy code (both supported)
- CSS modules in `lib/network/modules/*.css`
- TypeScript config: `tsconfig.code.json` (build), `tsconfig.declarations.json` (types)
