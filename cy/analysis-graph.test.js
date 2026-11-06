import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { pathsBetween, reachable } from '../js/app/analysis-graph.js'
import { MapStore } from './store.js'
import { clusterBy, setCollapsed, dissolveCluster } from './cluster.js'
import { bindGraph } from './binding.js'

function graph() {
  return cytoscape({
    headless: true,
    elements: [
      ...['a', 'b', 'c', 'd', 'e'].map((id) => ({ data: { id } })),
      ...[
        ['a', 'b'],
        ['b', 'c'],
        ['a', 'c'],
        ['c', 'a'],
        ['d', 'b'],
      ].map(([source, target]) => ({
        data: { id: source + target, source, target },
      })),
    ],
  })
}

function ids(collection) {
  return collection.map((ele) => ele.id()).sort()
}

test('radius respects direction and does not include siblings', () => {
  const cy = graph()
  const root = cy.getElementById('a')
  assert.deepEqual(ids(reachable(cy.elements(), root, 'downstream', 1)), ['a', 'b', 'c'])
  assert.deepEqual(ids(reachable(cy.elements(), root, 'upstream', 1)), ['a', 'c'])
  assert.deepEqual(ids(reachable(cy.elements(), root, 'All', 2)), ['a', 'b', 'c'])
  assert.deepEqual(ids(reachable(cy.elements(), root, 'upstream', 3)), ['a', 'b', 'c', 'd'])
})

test('paths find both directions, handle cycles, and distinguish shortest paths', () => {
  const cy = graph()
  const roots = cy.getElementById('a').union(cy.getElementById('c'))
  const all = pathsBetween(cy.elements(), roots, false)
  const shortest = pathsBetween(cy.elements(), roots, true)
  assert.deepEqual(ids(all.edges()), ['ab', 'ac', 'bc', 'ca'])
  assert.deepEqual(ids(all.nodes()), ['a', 'b', 'c'])
  assert.deepEqual(ids(shortest.edges()), ['ac', 'ca'])
  assert.equal(
    pathsBetween(cy.elements(), cy.getElementById('a').union(cy.getElementById('e')), true).edges()
      .length,
    0
  )
})

test('clearing clusters also clears the shared cluster setting', () => {
  const store = new MapStore()
  store.setSetting('cluster', 'style')
  clusterBy(store, 'none')
  assert.equal(store.meta.get('settings').cluster, 'none')
})

test('cluster mode survives undoing the removal of clusters', () => {
  const store = new MapStore()
  store.nodes.set('a', { style: 'group0', x: 0, y: 0 })
  store.nodes.set('b', { style: 'group0', x: 10, y: 0 })
  clusterBy(store, 'style')
  store.undoManager.stopCapturing()
  clusterBy(store, 'none')
  store.undo()
  const cluster = [...store.nodes.values()].find((node) => node.cluster)
  assert.equal(cluster.cluster.mode, 'style')
})

for (const mode of ['style', 'color']) {
  test(`expanded ${mode} clusters preserve factors and links through uncluster and recluster`, () => {
    const store = new MapStore()
    store.styles.set('nodeBase', { kind: 'node', css: { 'background-color': '#f00' } })
    store.nodes.set('a', { style: 'group0', x: 0, y: 0 })
    store.nodes.set('b', { style: 'group0', x: 100, y: 0 })
    store.nodes.set('c', { style: 'group1', x: 200, y: 0 })
    store.styles.set('group1', { kind: 'node', css: { 'background-color': '#00f' } })
    store.edges.set('ab', { source: 'a', target: 'b', style: 'edge0' })
    store.edges.set('bc', { source: 'b', target: 'c', style: 'edge0' })
    const cy = cytoscape({ headless: true, styleEnabled: true })
    const unbind = bindGraph(cy, store)
    const clusterId = () =>
      cy
        .nodes()
        .filter((node) => node.data('cluster'))[0]
        .id()
    const check = () => {
      assert.deepEqual(ids(cy.nodes().filter((node) => !node.data('cluster'))), ['a', 'b', 'c'])
      assert.deepEqual(ids(cy.edges().not('.meta')), ['ab', 'bc'])
      assert.equal(cy.getElementById('a').visible(), true)
      assert.equal(cy.getElementById('ab').visible(), true)
      assert.equal(cy.getElementById('bc').visible(), true)
    }
    clusterBy(store, mode)
    setCollapsed(store, clusterId(), false)
    clusterBy(store, 'none')
    check()
    clusterBy(store, mode)
    setCollapsed(store, clusterId(), false)
    check()
    dissolveCluster(store, clusterId())
    check()
    unbind()
    cy.destroy()
    store.doc.destroy()
  })
}
