import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MapStore } from './store.js'
import cytoscape from 'cytoscape'
import { bindGraph } from './binding.js'
import { readGraphviz, writeGraphviz } from '../js/app/graphviz.js'

for (const [name, nodes, edges] of [
  ['simple.gv', 5, 6],
  ['pathgraph.gv', 6, 8],
  ['largegraph.dot', 21, 42],
  ['stylesdemo.dot', 10, 9],
  ['toctemplateexample.dot', 30, 30],
]) {
  test(`imports ${name}`, () => {
    const result = readGraphviz(readFileSync(`data/${name}`, 'utf8'))
    assert.equal(result.file.nodes.length, nodes)
    assert.equal(result.file.edges.length, edges)
  })
}

test('imports defaults, scoped subgraphs, chains and strict edges', () => {
  const { file } = readGraphviz(`strict digraph {
    node [fillcolor=red]; edge [color=blue];
    a -> { b c } -> d [label="x"];
    subgraph cluster_s { node [fillcolor=green]; e; }
    node [fillcolor=yellow]; a [label="A"]; f;
    edge [color=green]; a -> b [label="updated"];
  }`)
  assert.equal(file.nodes.length, 6)
  assert.equal(file.edges.length, 4)
  const node = (id) => file.nodes.find((n) => n.id === id)
  assert.equal(node('a').overrides['background-color'], 'red')
  assert.equal(node('a').label, 'A')
  assert.equal(node('e').overrides['background-color'], 'green')
  assert.equal(node('f').overrides['background-color'], 'yellow')
  const edge = file.edges.find((e) => e.source === 'a' && e.target === 'b')
  assert.equal(edge.label, 'updated')
  assert.equal(edge.overrides['line-color'], 'blue')
})

test('round trips escaped labels, IDs, positions, notes and edge endpoints', () => {
  const store = new MapStore()
  store.nodes.set('a\\b', {
    label: 'Line "one" & 🗺️\\literal\nnext',
    style: 'group0',
    x: -1.5,
    y: 3,
    note: { ops: [{ insert: 'one\ntwo\n' }] },
    overrides: { 'background-color': '#123456' },
  })
  store.nodes.set('b', { label: 'B', style: 'group0', x: 5, y: 6 })
  store.edges.set('ab', { source: 'a\\b', target: 'b', label: 'edge', style: 'edge0' })
  const { file } = readGraphviz(writeGraphviz(store))
  assert.equal(file.nodes[0].id, 'a\\b')
  assert.equal(file.nodes[0].label, 'Line "one" & 🗺️\\literal\nnext')
  assert.equal(file.nodes[0].note.ops[0].insert, 'one\ntwo\n')
  assert.equal(file.nodes[0].x, -1.5)
  assert.equal(file.nodes[0].overrides['background-color'], '#123456')
  assert.equal(file.edges[0].id, 'ab')
  assert.equal(file.edges[0].source, 'a\\b')
  store.doc.destroy()
})

test('rejects malformed, multiple and HTML-labelled graphs', () => {
  for (const graph of [
    'digraph { a -> ',
    'graph {} graph {}',
    'digraph { a [label=<b>]; }',
    'digraph { a -- b }',
    'graph { a -> b }',
  ]) {
    assert.throws(() => readGraphviz(graph))
  }
})

test('preserves distinct numeric IDs without precision loss', () => {
  const { file } = readGraphviz(`digraph {
    # "ignored preprocessor text"
    01 -> 1; 9007199254740993 -> 9007199254740992;
  }`)
  assert.deepEqual(
    file.nodes.map((node) => node.id),
    ['01', '1', '9007199254740993', '9007199254740992']
  )
})

test('replacing a graph with its export updates empty style overrides safely', () => {
  const store = new MapStore()
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  store.loadFile(readGraphviz('digraph { a -> b; }').file)
  assert.doesNotThrow(() => store.loadFile(readGraphviz(writeGraphviz(store)).file))
  assert.equal(cy.nodes().length, 2)
  assert.equal(cy.edges().length, 1)
  unbind()
  cy.destroy()
  store.doc.destroy()
})
