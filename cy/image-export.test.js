import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { imageViewport, IMAGE_SIZE } from '../js/app/image-export.js'

test('image viewport frames the full map or centres the selected factors', () => {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 1000, y: 0 } },
      { data: { id: 'ab', source: 'a', target: 'b' } },
    ],
    layout: { name: 'preset', fit: false },
  })
  const whole = imageViewport(cy)
  cy.getElementById('a').select()
  const selected = imageViewport(cy)
  assert.equal(IMAGE_SIZE, 8192)
  assert.ok(selected.zoom > whole.zoom)
  assert.equal(selected.pan.x, 256)
  assert.equal(selected.pan.y, 256)
  assert.equal(cy.getElementById('a').selected(), true)
  cy.destroy()
})

test('an empty or entirely hidden map cannot be exported', () => {
  const cy = cytoscape({ headless: true, styleEnabled: true })
  assert.throws(() => imageViewport(cy), /no visible/)
  cy.add({ data: { id: 'a' } }).style('display', 'none')
  assert.throws(() => imageViewport(cy), /no visible/)
  cy.destroy()
})
