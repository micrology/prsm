#!/usr/bin/env node
/**
 * Regression tests for minimap overview bounds and "refresh only if outside" logic.
 *
 * Run:  node ./utils/test-minimap-bounds.mjs
 *   or: npm run test:minimap
 *
 * These tests cover the pure helpers in js/minimap-bounds.js used after factor drag
 * to decide whether the minimap snapshot must be rebuilt. No browser required.
 */

import {
  computeOverviewCanvasBounds,
  isBoxOutsideBounds,
  nodeToCanvasBox,
  shouldRefreshMinimapForMovedNodes,
} from '../js/minimap-bounds.js'

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${message}`)
  } else {
    failed += 1
    console.error(`  ✗ ${message}`)
  }
}

function assertClose(actual, expected, message, eps = 1e-9) {
  assert(Math.abs(actual - expected) <= eps, `${message} (got ${actual}, expected ${expected})`)
}

function section(title) {
  console.log(`\n${title}`)
}

// --- computeOverviewCanvasBounds -------------------------------------------------

section('computeOverviewCanvasBounds')

{
  const b = computeOverviewCanvasBounds({
    scale: 1,
    position: { x: 0, y: 0 },
    width: 1000,
    height: 800,
  })
  assert(b !== null, 'returns bounds for valid inputs')
  assertClose(b.left, -500, 'left at scale 1')
  assertClose(b.right, 500, 'right at scale 1')
  assertClose(b.top, -400, 'top at scale 1')
  assertClose(b.bottom, 400, 'bottom at scale 1')
}

{
  // scale 0.5 → canvas shows twice the CSS extent
  const b = computeOverviewCanvasBounds({
    scale: 0.5,
    position: { x: 100, y: -50 },
    width: 1000,
    height: 800,
  })
  assertClose(b.left, 100 - 1000, 'left at scale 0.5 with offset')
  assertClose(b.right, 100 + 1000, 'right at scale 0.5 with offset')
  assertClose(b.top, -50 - 800, 'top at scale 0.5 with offset')
  assertClose(b.bottom, -50 + 800, 'bottom at scale 0.5 with offset')
}

{
  assert(
    computeOverviewCanvasBounds({ scale: 0, position: { x: 0, y: 0 }, width: 100, height: 100 }) ===
      null,
    'rejects scale 0'
  )
  assert(
    computeOverviewCanvasBounds({
      scale: -1,
      position: { x: 0, y: 0 },
      width: 100,
      height: 100,
    }) === null,
    'rejects negative scale'
  )
  assert(
    computeOverviewCanvasBounds({
      scale: 1,
      position: { x: NaN, y: 0 },
      width: 100,
      height: 100,
    }) === null,
    'rejects non-finite position'
  )
  assert(
    computeOverviewCanvasBounds({ scale: 1, position: { x: 0, y: 0 }, width: 0, height: 100 }) ===
      null,
    'rejects zero width'
  )
  assert(
    computeOverviewCanvasBounds({ scale: 1, position: null, width: 100, height: 100 }) === null,
    'rejects null position'
  )
}

// --- isBoxOutsideBounds ----------------------------------------------------------

section('isBoxOutsideBounds')

{
  const bounds = { left: -100, right: 100, top: -100, bottom: 100 }
  assert(!isBoxOutsideBounds({ left: 0, right: 0, top: 0, bottom: 0 }, bounds), 'point at centre is inside')
  assert(
    !isBoxOutsideBounds({ left: -100, right: 100, top: -100, bottom: 100 }, bounds),
    'box flush with bounds is inside (not strictly outside)'
  )
  assert(
    isBoxOutsideBounds({ left: -101, right: -90, top: 0, bottom: 0 }, bounds),
    'box past left edge is outside'
  )
  assert(
    isBoxOutsideBounds({ left: 90, right: 101, top: 0, bottom: 0 }, bounds),
    'box past right edge is outside'
  )
  assert(
    isBoxOutsideBounds({ left: 0, right: 0, top: -101, bottom: -90 }, bounds),
    'box past top edge is outside'
  )
  assert(
    isBoxOutsideBounds({ left: 0, right: 0, top: 90, bottom: 101 }, bounds),
    'box past bottom edge is outside'
  )
  assert(!isBoxOutsideBounds(null, bounds), 'null box is not outside')
  assert(!isBoxOutsideBounds({ left: 0, right: 0, top: 0, bottom: 0 }, null), 'null bounds → false')
}

// --- nodeToCanvasBox -------------------------------------------------------------

section('nodeToCanvasBox')

{
  const fromBox = nodeToCanvasBox({ id: 'a', x: 1, y: 2 }, { left: 10, right: 20, top: 30, bottom: 40 })
  assert(fromBox.left === 10 && fromBox.right === 20, 'prefers bounding box when valid')

  const fromPoint = nodeToCanvasBox({ id: 'a', x: 5, y: -3 }, null)
  assert(
    fromPoint.left === 5 && fromPoint.right === 5 && fromPoint.top === -3 && fromPoint.bottom === -3,
    'falls back to x/y point box'
  )

  assert(nodeToCanvasBox({ id: 'a', x: null, y: 0 }, undefined) === null, 'rejects null coords')
  assert(nodeToCanvasBox(null, null) === null, 'rejects null node')
  assert(
    nodeToCanvasBox({ id: 'a', x: 1, y: 2 }, { left: 1, right: NaN, top: 0, bottom: 0 }) !== null &&
      nodeToCanvasBox({ id: 'a', x: 1, y: 2 }, { left: 1, right: NaN, top: 0, bottom: 0 }).left === 1,
    'invalid bounding box falls back to x/y'
  )
}

// --- shouldRefreshMinimapForMovedNodes -------------------------------------------

section('shouldRefreshMinimapForMovedNodes')

{
  const bounds = computeOverviewCanvasBounds({
    scale: 1,
    position: { x: 0, y: 0 },
    width: 1000,
    height: 800,
  })

  assert(
    !shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [{ id: 'n1', x: 0, y: 0 }],
    }),
    'node at centre → no refresh'
  )

  assert(
    !shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [
        { id: 'n1', x: 100, y: 50 },
        { id: 'n2', x: -200, y: 100 },
      ],
    }),
    'several in-bounds nodes → no refresh'
  )

  assert(
    shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [{ id: 'n1', x: 600, y: 0 }],
    }),
    'node past right edge of overview → refresh'
  )

  assert(
    shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [
        { id: 'n1', x: 0, y: 0 },
        { id: 'n2', x: 0, y: 500 },
      ],
    }),
    'one of several outside → refresh'
  )

  assert(
    !shouldRefreshMinimapForMovedNodes({ bounds: null, nodes: [{ id: 'n1', x: 9999, y: 9999 }] }),
    'missing bounds → no refresh'
  )

  assert(
    !shouldRefreshMinimapForMovedNodes({ bounds, nodes: [] }),
    'empty node list → no refresh'
  )

  // Bounding box extends outside even if centre is inside
  assert(
    shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [{ id: 'wide', x: 0, y: 0 }],
      getBoundingBox: (id) =>
        id === 'wide' ? { left: -600, right: 600, top: -10, bottom: 10 } : undefined,
    }),
    'large bounding box outside overview → refresh'
  )

  assert(
    !shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [{ id: 'ok', x: 0, y: 0 }],
      getBoundingBox: () => ({ left: -50, right: 50, top: -50, bottom: 50 }),
    }),
    'bounding box fully inside → no refresh'
  )

  // getBoundingBox throws → fall back to x/y
  assert(
    shouldRefreshMinimapForMovedNodes({
      bounds,
      nodes: [{ id: 'far', x: 9999, y: 0 }],
      getBoundingBox: () => {
        throw new Error('no box')
      },
    }),
    'getBoundingBox throw still uses x/y for outside check'
  )

  // Simulate the user scenario: drag repeatedly toward the edge then outside
  const path = [
    { id: 'dragged', x: 0, y: 0 },
    { id: 'dragged', x: 200, y: 0 },
    { id: 'dragged', x: 400, y: 0 },
    { id: 'dragged', x: 499, y: 0 }, // still inside (right edge 500)
    { id: 'dragged', x: 501, y: 0 }, // outside
  ]
  const refreshFlags = path.map((node) =>
    shouldRefreshMinimapForMovedNodes({ bounds, nodes: [node] })
  )
  assert(
    refreshFlags.join(',') === 'false,false,false,false,true',
    'drag path only triggers refresh once past overview edge'
  )
}

// --- Summary ---------------------------------------------------------------------

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) {
  process.exitCode = 1
} else {
  console.log('All minimap-bounds tests passed.')
}
