import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { MapStore } from '../../src/graph/store.js'
import { bindGraph } from '../../src/graph/binding.js'
import { nodeStyleToCss } from '../../src/graph/legacy.js'
import { shapePatch, SHAPES } from '../../src/graph/styleeditor.js'
import { shapeName } from '../../src/graph/shapes.js'
import { readMapFile } from '../../src/app/map-file.js'
import { suspendBoxSelection } from '../../src/graph/box-selection.js'

globalThis.window = {}
const { Palette } = await import('../../src/app/palette.js')
const { Editor } = await import('../../src/graph/editing.js')

test('palette applies factor and link styles, clears overrides and can be undone', () => {
  const store = new MapStore()
  store.setStyle('group0', { kind: 'node', css: { shape: 'hexagon' } })
  store.setStyle('edge0', { kind: 'edge', css: { 'line-color': 'red', width: 3 } })
  const a = store.addNode({
    x: 0,
    y: 0,
    style: 'group0',
    value: 50,
    overrides: { shape: 'rectangle' },
  })
  const b = store.addNode({ x: 100, y: 0, style: 'group0' })
  const link = store.addEdge({
    source: a,
    target: b,
    style: 'edge0',
    overrides: { 'line-color': 'blue', width: 10 },
  })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  cy.getElementById(a).select()
  cy.getElementById(link).select()
  const palette = { last: {}, cy, store, markUsed() {} }
  store.undoManager.stopCapturing()
  Palette.prototype.apply.call(palette, 'node', 'group0')
  assert.equal(store.nodes.get(a).overrides, undefined)
  assert.equal(store.nodes.get(a).value, undefined)
  assert.equal(cy.getElementById(a).style('shape'), 'hexagon')
  store.undo()
  assert.equal(store.nodes.get(a).overrides.shape, 'rectangle')
  assert.equal(store.nodes.get(a).value, 50)
  assert.equal(cy.getElementById(a).style('shape'), 'rectangle')
  store.undoManager.stopCapturing()
  Palette.prototype.apply.call(palette, 'edge', 'edge0')
  assert.equal(store.edges.get(link).overrides, undefined)
  assert.equal(cy.getElementById(link).style('width'), '3px')
  store.undo()
  assert.equal(store.edges.get(link).overrides.width, 10)
  unbind()
  cy.destroy()
  store.doc.destroy()
})

test('disc is circular and legacy and native database shapes are converted', () => {
  assert.ok(SHAPES.includes('disc'))
  assert.ok(!SHAPES.includes('database'))
  for (const shape of ['database', 'disc']) {
    const css = nodeStyleToCss({ shape, font: { size: 14 } })
    assert.equal(css.shape, 'ellipse')
    assert.equal(css.width, css.height)
    assert.equal(shapeName(css), 'disc')
  }
  assert.equal(shapeName(shapePatch('disc', {})), 'disc')
  assert.equal(shapeName(shapePatch('ellipse', {})), 'ellipse')
  const native = {
    format: 'prsm',
    schemaVersion: 2,
    meta: {},
    styles: { group0: { kind: 'node', css: { shape: 'barrel', 'background-color': 'red' } } },
    nodes: [{ id: 'a', overrides: { shape: 'barrel', color: 'blue' } }],
    edges: [],
  }
  const { file } = readMapFile(JSON.stringify(native))
  for (const css of [file.styles.group0.css, file.nodes[0].overrides]) {
    assert.equal(shapeName(css), 'disc')
    assert.equal(css.width, css.height)
  }
  assert.equal(file.styles.group0.css['background-color'], 'red')
  assert.equal(file.nodes[0].overrides.color, 'blue')
  assert.equal(native.styles.group0.css.shape, 'barrel')
  const store = new MapStore()
  store.loadFile(file)
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  assert.equal(cy.getElementById('a').style('shape'), 'ellipse')
  assert.equal(store.toFile().styles.group0.css.shape, 'ellipse')
  unbind()
  cy.destroy()
  store.doc.destroy()
  const legacy = { nodes: [{ id: 'a', label: 'A', shape: 'database' }], edges: [] }
  const converted = readMapFile(JSON.stringify(legacy)).file
  assert.equal(
    shapeName({
      ...converted.styles[converted.nodes[0].style].css,
      ...converted.nodes[0].overrides,
    }),
    'disc'
  )
})

test('bending disables box selection and restores existing interaction settings', () => {
  const cy = cytoscape({
    headless: true,
    styleEnabled: true,
    layout: { name: 'preset' },
    elements: [
      { data: { id: 'a' }, position: { x: 0, y: 0 } },
      { data: { id: 'b' }, position: { x: 100, y: 0 } },
      { data: { id: 'e', source: 'a', target: 'b' } },
    ],
  })
  const edge = cy.getElementById('e')
  const updates = []
  const editor = {
    cy,
    mode: 'select',
    options: {},
    store: { update: (...args) => updates.push(args) },
  }
  cy.userPanningEnabled(false)
  Editor.prototype.startBend.call(editor, { target: edge })
  assert.equal(cy.boxSelectionEnabled(), false)
  cy.emit({ type: 'tapdrag', position: { x: 50, y: 30 } })
  cy.emit('tapend')
  assert.equal(cy.boxSelectionEnabled(), true)
  assert.equal(cy.userPanningEnabled(), false)
  assert.equal(updates[0][1], 'e')
  assert.ok(updates[0][2].curve.roundness > 0)
  cy.destroy()
})

test('overlapping box-selection suspensions restore the original state only at the end', () => {
  const cy = cytoscape({ headless: true })
  const first = suspendBoxSelection(cy)
  const second = suspendBoxSelection(cy)
  first()
  first()
  assert.equal(cy.boxSelectionEnabled(), false)
  second()
  assert.equal(cy.boxSelectionEnabled(), true)
  cy.boxSelectionEnabled(false)
  const release = suspendBoxSelection(cy)
  release()
  assert.equal(cy.boxSelectionEnabled(), false)
  cy.destroy()
})
