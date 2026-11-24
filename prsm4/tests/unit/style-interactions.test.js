import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { MapStore } from '../../src/graph/store.js'
import { bindGraph } from '../../src/graph/binding.js'
import { nodeStyleToCss } from '../../src/graph/legacy.js'
import { colorPatch, shapePatch, SHAPES } from '../../src/graph/styleeditor.js'
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
    curve: { side: 1, roundness: 0.3 },
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
  assert.equal(store.edges.get(link).curve, undefined)
  assert.equal(cy.getElementById(link).style('width'), '3px')
  store.undo()
  assert.equal(store.edges.get(link).overrides.width, 10)
  assert.equal(store.edges.get(link).curve.roundness, 0.3)
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
    store: {
      transact: (fn) => fn(),
      update: (...args) => updates.push(args),
      setOverrides: (...args) => updates.push(args),
    },
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
  assert.equal(updates[1][2]['curve-style'], 'unbundled-bezier')
  cy.destroy()
})

test('link types inherit from the map and style, with per-link overrides taking precedence', () => {
  const store = new MapStore()
  store.setStyle('edge0', { kind: 'edge', css: {} })
  const a = store.addNode({ x: 0, y: 0 })
  const b = store.addNode({ x: 250, y: 100 })
  const c = store.addNode({ x: 500, y: 0 })
  const first = store.addEdge({ source: a, target: b, style: 'edge0' })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  const type = (id) => cy.getElementById(id).style('curve-style')
  store.setSetting('curve', 'round-taxi')
  assert.equal(type(first), 'round-taxi')
  const second = store.addEdge({ source: b, target: c, style: 'edge0' })
  assert.equal(type(second), 'round-taxi')
  store.setStyle('edge0', { kind: 'edge', css: { 'curve-style': 'round-segments' } })
  assert.equal(type(first), 'round-segments')
  assert.equal(type(second), 'round-segments')
  assert.equal(cy.getElementById(first).style('edge-distances'), 'intersection')
  store.setOverrides('edges', [first], { 'curve-style': 'straight' })
  store.setSetting('curve', 'Straight')
  assert.equal(type(first), 'straight')
  assert.equal(type(second), 'round-segments')
  store.undoManager.stopCapturing()
  store.setOverrides('edges', [first], { 'curve-style': 'round-taxi' })
  assert.equal(type(first), 'round-taxi')
  store.undo()
  assert.equal(type(first), 'straight')
  store.setOverrides('edges', [first], { 'curve-style': undefined })
  assert.equal(type(first), 'round-segments')
  store.setStyle('edge0', { kind: 'edge', css: {} })
  assert.equal(type(first), 'straight')
  unbind()
  cy.destroy()
  store.doc.destroy()
})

test('existing bends survive network changes and explicit link and style choices take precedence', () => {
  const store = new MapStore()
  store.setStyle('edge0', { kind: 'edge', css: {} })
  const a = store.addNode({ x: 0, y: 0 })
  const b = store.addNode({ x: 250, y: 100 })
  const id = store.addEdge({
    source: a,
    target: b,
    style: 'edge0',
    curve: { side: 1, roundness: 0.3 },
  })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  const edge = cy.getElementById(id)
  store.setSetting('curve', 'round-taxi')
  assert.equal(edge.style('curve-style'), 'unbundled-bezier')
  store.setStyle('edge0', { kind: 'edge', css: { 'curve-style': 'round-segments' } })
  assert.equal(edge.style('curve-style'), 'round-segments')
  store.setOverrides('edges', [id], { 'curve-style': 'unbundled-bezier' })
  assert.equal(edge.style('curve-style'), 'unbundled-bezier')
  const saved = readMapFile(JSON.stringify(store.toFile())).file
  assert.equal(saved.meta.settings.curve, 'round-taxi')
  assert.equal(saved.styles.edge0.css['curve-style'], 'round-segments')
  assert.equal(saved.edges[0].overrides['curve-style'], 'unbundled-bezier')
  const restored = new MapStore()
  restored.loadFile(saved)
  const restoredCy = cytoscape({ headless: true, styleEnabled: true })
  const stop = bindGraph(restoredCy, restored)
  assert.equal(restoredCy.getElementById(id).style('curve-style'), 'unbundled-bezier')
  stop()
  restoredCy.destroy()
  restored.doc.destroy()
  unbind()
  cy.destroy()
  store.doc.destroy()
})

test('dragging a link creates an undoable per-link curve over its style', () => {
  const store = new MapStore()
  store.setStyle('edge0', { kind: 'edge', css: { 'curve-style': 'round-taxi' } })
  const a = store.addNode({ x: 0, y: 0 })
  const b = store.addNode({ x: 250, y: 100 })
  const id = store.addEdge({ source: a, target: b, style: 'edge0' })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  const edge = cy.getElementById(id)
  const editor = { cy, mode: 'select', options: {}, store }
  store.undoManager.stopCapturing()
  Editor.prototype.startBend.call(editor, { target: edge })
  cy.emit({ type: 'tapdrag', position: { x: 100, y: 80 } })
  assert.equal(edge.style('curve-style'), 'unbundled-bezier')
  cy.emit('tapend')
  assert.equal(store.edges.get(id).overrides['curve-style'], 'unbundled-bezier')
  store.undo()
  assert.equal(edge.style('curve-style'), 'round-taxi')
  unbind()
  cy.destroy()
  store.doc.destroy()
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

test('colour patches store transparency separately for factors and links', () => {
  assert.deepEqual(colorPatch('node', 'background-color', 'rgba(255, 0, 20, 0.25)'), {
    'background-color': 'rgb(255, 0, 20)',
    'background-opacity': 0.25,
  })
  assert.deepEqual(colorPatch('node', 'border-color', '#12345600'), {
    'border-color': '#123456',
    'border-opacity': 0,
  })
  assert.deepEqual(colorPatch('edge', 'line-color', '#123456ff'), {
    'line-color': '#123456',
    'line-opacity': 1,
    'source-arrow-color': '#123456',
    'target-arrow-color': '#123456',
    'mid-target-arrow-color': '#123456',
  })
  assert.equal(colorPatch('edge', 'color', 'rgba(1, 2, 3, 0.6)')['text-opacity'], 0.6)
})

test('locked factors remain pinned after loading and can be unpinned', () => {
  const store = new MapStore()
  const id = store.addNode({ label: 'Pinned', x: 0, y: 0, locked: true })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  assert.equal(cy.getElementById(id).grabbable(), false)
  store.update('nodes', id, { locked: undefined })
  assert.equal(cy.getElementById(id).grabbable(), true)
  unbind()
  cy.destroy()
  store.doc.destroy()
})
