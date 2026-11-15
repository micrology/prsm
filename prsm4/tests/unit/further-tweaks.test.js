import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { MapStore } from '../../src/graph/store.js'
import { bindGraph } from '../../src/graph/binding.js'

globalThis.window = {}
const { Analysis } = await import('../../src/app/analysis.js')
const { History } = await import('../../src/app/history.js')

test('analysis sizes range from 25 to 125, with equal metrics at 75', () => {
  const store = new MapStore()
  const a = store.addNode({ x: 0, y: 0 })
  const b = store.addNode({ x: 100, y: 0 })
  const edge = store.addEdge({ source: a, target: b })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  const analysis = { store, cy }
  store.setSetting('sizing', 'Inputs')
  Analysis.prototype.size.call(analysis)
  assert.equal(cy.getElementById(a).numericStyle('width'), 25)
  assert.equal(cy.getElementById(b).numericStyle('width'), 125)
  store.remove([], [edge])
  Analysis.prototype.size.call(analysis)
  assert.equal(cy.getElementById(a).numericStyle('width'), 75)
  assert.equal(cy.getElementById(b).numericStyle('width'), 75)
  store.setSetting('sizing', 'Equal')
  Analysis.prototype.size.call(analysis)
  assert.equal(cy.getElementById(a).numericStyle('width'), 100)
  unbind()
  cy.destroy()
  store.doc.destroy()
})

test('history records reactions but not position-only changes', () => {
  const store = new MapStore()
  const id = store.addNode({ label: 'Factor A', x: 0, y: 0 })
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  store.moveNodes({ [id]: { x: 10, y: 10 } })
  assert.deepEqual(actions, [])
  store.transact((transaction) => {
    transaction.meta.set('reaction', { side: 'down', added: true, label: 'Factor A' })
    store.update('nodes', id, { thumbDown: [42] })
  })
  assert.deepEqual(actions, ["added a thumbs down reaction to 'Factor A'"])
  store.update('nodes', id, { label: 'Renamed' })
  assert.equal(actions[1], "edited factor 'Renamed'")
  store.doc.destroy()
})
