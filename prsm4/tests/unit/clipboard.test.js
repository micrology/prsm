import test from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { MapStore } from '../../src/graph/store.js'
import { copySelection, pasteSelection } from '../../src/graph/clipboard.js'

test('copy and paste preserve links, notes and conflicting styles with undo', () => {
  const source = new MapStore()
  source.setStyle('group0', { kind: 'node', name: 'Source', css: { shape: 'ellipse' } })
  source.setStyle('edge0', { kind: 'edge', name: 'Link', css: { width: 2 } })
  const a = source.addNode({
    label: 'A',
    x: 5,
    y: 10,
    style: 'group0',
    note: { ops: [{ insert: 'note\n' }] },
  })
  const b = source.addNode({ label: 'B', x: 25, y: 30, style: 'group0' })
  const edge = source.addEdge({ source: a, target: b, label: 'AB', style: 'edge0' })
  const cy = cytoscape({
    headless: true,
    elements: [
      { data: { id: a } },
      { data: { id: b } },
      { data: { id: edge, source: a, target: b } },
    ],
  })
  const clip = copySelection(source, cy.getElementById(edge))
  assert.equal(clip.nodes.length, 2)
  assert.equal(clip.edges.length, 1)
  const dest = new MapStore()
  dest.setStyle('group0', { kind: 'node', name: 'Different', css: { shape: 'rectangle' } })
  const pasted = pasteSelection(dest, JSON.parse(JSON.stringify(clip)))
  const first = dest.nodes.get(pasted.nodes[0])
  assert.equal(first.x, 45)
  assert.deepEqual(first.note, { ops: [{ insert: 'note\n' }] })
  assert.notEqual(first.style, 'group0')
  assert.equal(dest.styles.get(first.style).name, 'Source')
  assert.equal(dest.edges.get(pasted.edges[0]).source, pasted.nodes[0])
  assert.equal(dest.edges.get(pasted.edges[0]).target, pasted.nodes[1])
  dest.undo()
  assert.equal(dest.nodes.size, 0)
  assert.equal(dest.edges.size, 0)
  assert.equal(dest.styles.has(first.style), false)
  cy.destroy()
  source.doc.destroy()
  dest.doc.destroy()
})

test('paste rejects inconsistent attributes and malformed links without changes', () => {
  const store = new MapStore()
  const data = {
    format: 'prsm4-selection',
    version: 1,
    styles: {},
    attributeTitles: { att1: 'Source field' },
    nodes: [{ id: 'a', x: 0, y: 0, att1: 'value' }],
    edges: [],
  }
  assert.throws(() => pasteSelection(store, data), /Attribute att1 differs/)
  assert.equal(store.nodes.size, 0)
  data.attributeTitles = {}
  data.edges = [{ id: 'edge', source: 'a', target: 'missing' }]
  assert.throws(() => pasteSelection(store, data), /Invalid link/)
  assert.equal(store.nodes.size, 0)
  store.doc.destroy()
})
