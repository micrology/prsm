import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { fitMap } from '../../src/app/zoom.js'

/** Create a graph with a fixed-sized viewport for fit tests. */
function graph(distance) {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    minZoom: 0.02,
    maxZoom: 8,
    elements: [
      { data: { id: 'a' }, position: { x: 200, y: 300 } },
      { data: { id: 'b' }, position: { x: 200 + distance, y: 300 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
    ],
    layout: { name: 'preset', fit: false },
  })
  cy.width = () => 800
  cy.height = () => 600
  return cy
}

test('fitting a small map caps zoom at 1 and keeps the map centred', () => {
  const cy = graph(100)
  const bounds = cy.elements().boundingBox()
  fitMap(cy)
  assert.equal(cy.zoom(), 1)
  assert.ok(Math.abs((bounds.x1 + bounds.x2) / 2 + cy.pan().x - 400) < 0.001)
  assert.ok(Math.abs((bounds.y1 + bounds.y2) / 2 + cy.pan().y - 300) < 0.001)
  cy.zoom(2)
  assert.equal(cy.zoom(), 2)
  cy.destroy()
})

test('fitting a large map still zooms out and an empty map is unchanged', () => {
  const cy = graph(2000)
  fitMap(cy)
  assert.ok(cy.zoom() < 1)
  const bounds = cy.elements().renderedBoundingBox()
  assert.ok(bounds.x1 >= 29 && bounds.x2 <= 771)
  cy.elements().remove()
  const viewport = { zoom: cy.zoom(), pan: cy.pan() }
  fitMap(cy)
  assert.equal(cy.zoom(), viewport.zoom)
  assert.deepEqual(cy.pan(), viewport.pan)
  cy.destroy()
})
