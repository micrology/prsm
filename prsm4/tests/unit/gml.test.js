import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { MapStore } from '../../src/graph/store.js'
import { readGml, writeGml } from '../../src/app/gml.js'

test(
  'imports Gephi and legacy PRSM GML examples',
  {
    skip:
      !existsSync('data/random10.gml') || !existsSync('data/styriacmfullmap19april.gml')
        ? 'Optional local sample corpus is not installed'
        : false,
  },
  () => {
    const gephi = readGml(readFileSync('data/random10.gml', 'utf8'))
    assert.equal(gephi.file.nodes.length, 10)
    assert.ok(gephi.file.edges.length > 0)
    assert.equal(gephi.file.nodes[0].x, -68.84125)
    const legacy = readGml(readFileSync('data/styriacmfullmap19april.gml', 'utf8'))
    assert.equal(legacy.file.nodes.length, 72)
    assert.equal(legacy.file.edges.length, 164)
    assert.match(legacy.file.nodes[0].label, /Acceptance\nfor CCU/)
  }
)

test('imports a GML graph with positions and links', () => {
  const { file } = readGml(`graph [
    directed 1
    node [ id 1 label "First" graphics [ x -3 y 4 ] ]
    node [ id 2 label "Second" ]
    edge [ source 1 target 2 label "affects" ]
  ]`)
  assert.equal(file.nodes.length, 2)
  assert.equal(file.nodes[0].x, -3)
  assert.equal(file.nodes[0].y, 4)
  assert.equal(file.edges.length, 1)
  assert.equal(file.edges[0].label, 'affects')
})

test('round trips labels, notes, colours, positions and links', () => {
  const store = new MapStore()
  store.nodes.set('a', {
    label: 'Line "one" & 🗺️\\\nnext',
    style: 'group0',
    x: -1.5,
    y: 0,
    note: { ops: [{ insert: 'one\ntwo\n' }] },
    overrides: { 'background-color': '#123456' },
  })
  store.nodes.set('b', { label: 'B', style: 'group0', x: 5, y: 6 })
  store.edges.set('ab', { source: 'a', target: 'b', label: 'link', style: 'edge0' })
  const { file } = readGml(writeGml(store))
  assert.equal(file.nodes[0].label, 'Line "one" & 🗺️\\\nnext')
  assert.equal(file.nodes[0].note.ops[0].insert, 'one\ntwo\n')
  assert.equal(file.nodes[0].x, -1.5)
  assert.equal(file.nodes[0].overrides['background-color'], '#123456')
  assert.equal(file.edges[0].source, file.nodes[0].id)
  assert.equal(file.edges[0].target, file.nodes[1].id)
  store.doc.destroy()
})

test('handles missing endpoints, direction and malformed files safely', () => {
  const { file, warnings } = readGml('graph [ node [ id 1 ] edge [ source 1 target 2 ] ]')
  assert.equal(file.edges.length, 0)
  assert.match(warnings.join(' '), /missing endpoints/)
  assert.match(warnings.join(' '), /Undirected/)
  for (const invalid of [
    'graph [ node [ id 1 ]',
    'graph [ node [ id 1 ] node [ id 1 ] ]',
    'graph [ node [ label "a" ] ]',
    'graph [ node [ id 1 graphics [ x nope ] ] ]',
    'graph [ node [ id 1 label "unfinished ] ]',
    'graph [ ] ]',
  ]) {
    assert.throws(() => readGml(invalid))
  }
})
