# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Overview

vis-network is a browser-based network visualization library that renders interactive node-edge graphs using HTML canvas. It supports custom shapes, clustering, physics simulations, and hierarchical layouts.

## Development Commands

```bash
# Install dependencies
npm install

# Build all bundles (declarations, code, legacy code/types/images)
npm run build

# Run all tests (unit + e2e functional + e2e visual)
npm run test

# Run only unit tests (Mocha)
npm run test:unit

# Run specific unit test file
npx mocha --exit test/Network.test.js

# Run e2e functional tests (Cypress headless)
npm run test:e2e:functional

# Run e2e tests with GUI (for debugging)
npm run test:e2e:gui

# Lint (ESLint)
npm run lint
npm run lint-fix

# Format check (Prettier)
npm run style
npm run style-fix

# Watch mode for development
npm run build:watch
```

## Architecture

### Entry Points

- `lib/entry-peer.ts` - Peer dependency build (expects vis-data, vis-util externally)
- `lib/entry-standalone.ts` - Standalone build (bundles all dependencies)
- `lib/entry-esnext.ts` - ESNext build with CSS imports

### Core Network Class (`lib/network/Network.js`)

The `Network` constructor creates a `body` object that is shared across all modules:

- `body.nodes` / `body.edges` - Full definitions of network elements
- `body.nodeIndices` / `body.edgeIndices` - IDs of **active/visible** elements (important for clustering)
- `body.emitter` - Event system for inter-module communication

### Module System (`lib/network/modules/`)

Each module handles a specific concern and receives the shared `body` object:

- **Canvas.js** - DOM management and HTML canvas setup
- **CanvasRenderer.js** - Render loop and drawing coordination
- **NodesHandler.js** / **EdgesHandler.js** - CRUD operations and global options for elements
- **PhysicsEngine.js** - Force-directed simulation (Barnes-Hut, repulsion, springs)
- **LayoutEngine.js** - Initial positioning and hierarchical layouts
- **Clustering.js** - Node clustering API
- **InteractionHandler.js** - Hammer.js bindings for touch/mouse events
- **SelectionHandler.js** - Node/edge selection state
- **ManipulationSystem.js** - UI for adding/editing nodes and edges
- **View.js** - Camera control, zoom, and pan animations
- **KamadaKawai.js** - Alternative layout algorithm

### Node Shapes (`lib/network/modules/components/nodes/shapes/`)

Each shape is a separate class (Box, Circle, Diamond, Icon, Image, Star, etc.) extending a base shape. Custom shapes use `CustomShape.js` with a `ctxRenderer` callback.

### Edge Rendering (`lib/network/modules/components/edges/`)

Edges support multiple routing types (bezier, straight, etc.) and arrow endpoints defined in `lib/network/options.ts`.

### Physics Components (`lib/network/modules/components/physics/`)

Implements Barnes-Hut optimization, central gravity, spring forces, and repulsion calculations.

### Configuration

- `lib/network/options.ts` - Defines all valid options with type validation
- Options are validated at runtime via `vis-util` Validator

## Testing

- **Unit tests**: `test/*.test.{js,ts}` using Mocha + Sinon
- **E2E functional tests**: `cypress/e2e/functional/`
- **E2E visual regression tests**: `cypress/e2e/visual/` using cypress-visual-regression
- Canvas mocking available via `test/canvas-mock.js` for unit tests

## Build Outputs

- `dist/` - Legacy UMD/ESM bundles
- `peer/` - Builds expecting peer dependencies
- `standalone/` - Self-contained builds
- `esnext/` - ESNext builds
- `declarations/` - TypeScript declaration files
