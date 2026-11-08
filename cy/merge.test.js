import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MapStore } from './store.js'
import { mergeMap } from '../js/app/merge.js'

const style = (color) => ({ kind: 'node', name: 'Factor', css: { 'background-color': color } })
const source = () => ({
  meta: { attributeTitles: {} },
  styles: { group0: style('blue') },
  nodes: [
    { id: 'a', label: 'New name', x: 10, y: 20, style: 'group0' },
    { id: 'b', label: 'B', x: 30, y: 40, style: 'group0' },
  ],
  edges: [{ id: 'ab', source: 'a', target: 'b', style: 'edge0' }],
})

test('merge preserves styles, flags renamed factors and links, and is one undo step', () => {
  const store = new MapStore()
  store.nodes.set('a', { label: 'Original', x: 0, y: 0, style: 'group0' })
  store.styles.set('group0', style('red'))
  const result = mergeMap(store, source())
  assert.equal(result.conflicts, 1)
  assert.equal(result.addedNodes, 2)
  assert.equal(result.addedEdges, 1)
  const renamed = [...store.nodes.entries()].find(([, rec]) => rec.label === 'New name')
  assert.equal(renamed[1].overrides['border-color'], '#ff0000')
  assert.equal(store.styles.get(renamed[1].style).css['background-color'], 'blue')
  assert.equal([...store.edges.values()][0].overrides['line-color'], '#ff0000')
  store.undo()
  assert.equal(store.nodes.size, 1)
  assert.equal(store.edges.size, 0)
  assert.equal(store.styles.size, 1)
  store.doc.destroy()
})

test('matching labels reuse factors and preserve links; repeating a merge adds no duplicates', () => {
  const store = new MapStore()
  store.styles.set('group0', style('blue'))
  store.nodes.set('x', { label: 'A B', style: 'group0' })
  const file = source()
  file.nodes[0].label = 'AB'
  assert.equal(mergeMap(store, file).addedEdges, 1)
  assert.equal(store.edges.get('ab').source, 'x')
  const again = mergeMap(store, file)
  assert.equal(again.addedNodes, 0)
  assert.equal(again.addedEdges, 0)
  store.doc.destroy()
})

test('incompatible attributes and ambiguous matching leave the map unchanged', () => {
  const store = new MapStore()
  store.nodes.set('x', { label: 'B' })
  store.nodes.set('y', { label: 'B' })
  assert.throws(() => mergeMap(store, source()), /matches multiple/)
  const file = source()
  file.meta.attributeTitles = { att1: 'Importance' }
  assert.throws(() => mergeMap(store, file), /Attribute att1/)
  assert.equal(store.nodes.size, 2)
  assert.equal(store.edges.size, 0)
  store.doc.destroy()
})
