import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { MapStore } from './store.js'
import { bindGraph } from './binding.js'
import { readMapFile, writeMapFile } from '../js/app/map-file.js'

const sample = () => ({
  format: 'prsm',
  schemaVersion: 2,
  meta: { title: 'Example', settings: { curve: 'Straight' }, legacyBackground: { objects: [1] } },
  styles: { group0: { kind: 'node', name: 'Factor', css: {} } },
  nodes: [
    { id: 'a', label: 'First', x: 10, y: 20, style: 'group0', note: { ops: [{ insert: 'Hi' }] } },
    { id: 'b', label: 'Second', x: 30, y: 40, style: 'group0' },
  ],
  edges: [{ id: 'ab', source: 'a', target: 'b', label: 'Link' }],
  history: [{ time: 123, user: 'Tester', action: 'made a map' }],
})

test('native map, history, and retained legacy background survive a compressed round trip', () => {
  const source = new MapStore()
  source.loadFile(sample(), { replaceHistory: true })
  const { file, warnings } = readMapFile(writeMapFile(source))
  assert.match(warnings.join(' '), /preserved but is not yet displayed/)
  assert.deepEqual(file.nodes, sample().nodes)
  assert.deepEqual(file.edges, sample().edges)
  assert.deepEqual(file.history, sample().history)
  assert.deepEqual(file.meta.legacyBackground, sample().meta.legacyBackground)
  const restored = new MapStore()
  restored.loadFile(file, { replaceHistory: true })
  assert.deepEqual(restored.history.toArray(), sample().history)
  source.doc.destroy()
  restored.doc.destroy()
})

test('legacy files are converted and retain undisplayed backgrounds and history', () => {
  const legacy = {
    mapTitle: 'Old map',
    nodes: [{ id: 1, label: 'A', x: 10, y: 20 }],
    edges: [],
    background: { objects: [{ type: 'rect' }] },
    underlay: [{ x: 1, y: 2 }],
    history: [{ time: 12, user: 'Tester', action: 'created a map' }],
  }
  const { file, warnings } = readMapFile(` \n${JSON.stringify(legacy)}`)
  assert.equal(file.meta.title, 'Old map')
  assert.deepEqual(file.meta.legacyBackground, legacy.background)
  assert.deepEqual(file.meta.legacyUnderlay, legacy.underlay)
  assert.deepEqual(file.history, legacy.history)
  assert.match(warnings.join(' '), /preserved but is not yet displayed/)
})

test('replacing a link with a factor of the same ID keeps the new factor visible', () => {
  const store = new MapStore()
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  store.loadFile(sample())
  const next = sample()
  next.edges = []
  next.nodes.push({ id: 'ab', label: 'New factor', style: 'group0' })
  store.loadFile(next)
  assert.equal(cy.getElementById('ab').isNode(), true)
  unbind()
  cy.destroy()
  store.doc.destroy()
})

test('invalid files and unsupported schemas are rejected before replacing a map', () => {
  for (const input of [
    '{}',
    'not a map',
    JSON.stringify({ ...sample(), schemaVersion: 3 }),
    JSON.stringify({ ...sample(), edges: [{ id: 'bad', source: 'a', target: 'missing' }] }),
    JSON.stringify({ ...sample(), edges: [{ id: 'a', source: 'a', target: 'b' }] }),
    JSON.stringify({ ...sample(), styles: { broken: null } }),
    JSON.stringify({ ...sample(), history: [null] }),
  ]) {
    assert.throws(() => readMapFile(input))
  }
})

test('replacing a map clears old metadata and updates an existing edge endpoint', () => {
  const store = new MapStore()
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  store.loadFile(sample(), { replaceHistory: true })
  const next = sample()
  next.meta = { title: 'New map' }
  next.nodes.push({ id: 'c', label: 'Third', style: 'group0' })
  next.edges[0].target = 'c'
  next.history = []
  store.loadFile(next, { replaceHistory: true })
  assert.equal(store.meta.has('legacyBackground'), false)
  assert.equal(cy.getElementById('ab').target().id(), 'c')
  assert.equal(store.history.length, 0)
  unbind()
  cy.destroy()
  store.doc.destroy()
})
