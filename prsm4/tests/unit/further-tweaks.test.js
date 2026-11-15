import { test } from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { MapStore } from '../../src/graph/store.js'
import { bindGraph } from '../../src/graph/binding.js'
import { clusterBy } from '../../src/graph/cluster.js'

globalThis.window = {}
const { Analysis } = await import('../../src/app/analysis.js')
const { History, describeRecords } = await import('../../src/app/history.js')
const { StyleEditor } = await import('../../src/graph/styleeditor.js')
globalThis.Path2D = class {}
const { thumbBounds, Badges } = await import('../../src/app/badges.js')

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

test('history ignores factor and link note edits but records other simultaneous changes', () => {
  const store = new MapStore()
  const a = store.addNode({ label: 'A', x: 0, y: 0 })
  const b = store.addNode({ label: 'B', x: 100, y: 0 })
  const edge = store.addEdge({ source: a, target: b, label: 'Link' })
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  store.update('nodes', a, { note: { ops: [{ insert: 'one' }] } })
  store.update('nodes', a, { note: { ops: [{ insert: 'one two' }] } })
  store.update('edges', edge, { note: { ops: [{ insert: 'link note' }] } })
  store.update('edges', edge, { note: undefined })
  assert.deepEqual(actions, [])
  store.update('nodes', a, { note: { ops: [{ insert: 'changed' }] }, label: 'Renamed' })
  assert.deepEqual(actions, ["edited factor 'Renamed'"])
  store.doc.destroy()
})

test('network settings history describes each changed control', () => {
  const store = new MapStore()
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  store.setSetting('background', 'rgba(0, 0, 0, 0.5)')
  store.setSetting('curve', 'Straight')
  store.setSetting('snapToGrid', true)
  store.setSetting('showNotes', false)
  store.setSetting('voting', true)
  store.setSetting('legend', true)
  assert.deepEqual(actions, [
    'changed the map background colour',
    'changed the link style to straight',
    'enabled snap to grid',
    'hid note indicators',
    'showed reactions',
    'showed the legend',
  ])
  store.doc.destroy()
})

test('history names edited factor and link styles with a fallback for unnamed styles', () => {
  const store = new MapStore()
  store.setStyle('group0', { kind: 'node', name: 'Pressure', css: {} })
  store.setStyle('edge0', { kind: 'edge', name: 'Influence', css: {} })
  store.setStyle('group1', { kind: 'node', name: '', css: {} })
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  store.setStyle('group0', { kind: 'node', name: 'Pressure', css: { shape: 'triangle' } })
  store.setStyle('edge0', { kind: 'edge', name: 'Influence', css: { width: 3 } })
  store.setStyle('group1', { kind: 'node', name: '', css: { shape: 'ellipse' } })
  assert.deepEqual(actions, [
    'edited the Pressure factor style',
    'edited the Influence link style',
    'edited a style',
  ])
  store.doc.destroy()
})

test('style dialog previews log once on save and never on cancellation', () => {
  const store = new MapStore()
  const original = { kind: 'node', name: 'Pressure', css: { 'border-width': 0 } }
  store.setStyle('group0', original)
  const history = new History({ store, room: 'test', withUI: false })
  const events = []
  history.log = (action, state) => events.push({ action, state })
  const editor = { view: { store }, single: true }
  history.beginStyleEdit({ id: 'group0', style: structuredClone(original) })
  StyleEditor.prototype.setStyle.call(editor, 'group0', {
    ...original,
    css: { 'border-width': 1 },
  })
  StyleEditor.prototype.setStyle.call(editor, 'group0', original)
  assert.equal(events.length, 0)
  store.addNode({ label: 'Unrelated', x: 0, y: 0 })
  history.finishStyleEdit(true)
  assert.equal(events.length, 2)
  assert.equal(events[1].action, 'edited the Pressure factor style')
  assert.deepEqual(events[1].state.styles.group0, original)
  assert.equal(events[1].state.nodes.length, 1)
  history.beginStyleEdit({ id: 'group0', style: original })
  StyleEditor.prototype.setStyle.call(editor, 'group0', {
    ...original,
    css: { 'border-width': 2 },
  })
  StyleEditor.prototype.setStyle.call(editor, 'group0', original)
  history.finishStyleEdit(false)
  assert.equal(events.length, 2)
  history.beginStyleEdit({ id: 'group0', style: original })
  history.finishStyleEdit(true)
  assert.equal(events.length, 2)
  const linkStyle = { kind: 'edge', name: 'Influence', css: { width: 1 } }
  store.setStyle('edge0', linkStyle)
  const count = events.length
  history.beginStyleEdit({ id: 'edge0', style: structuredClone(linkStyle) })
  StyleEditor.prototype.setStyle.call(editor, 'edge0', { ...linkStyle, name: 'New name' })
  StyleEditor.prototype.setStyle.call(editor, 'edge0', {
    ...linkStyle,
    name: 'New name',
    css: { width: 3 },
  })
  history.finishStyleEdit(true)
  assert.equal(events.length, count + 1)
  assert.equal(events.at(-1).action, 'edited the New name link style')
  assert.deepEqual(events.at(-1).state.styles.edge0, linkStyle)
  store.doc.destroy()
})

test('history names the endpoints when a link is added', () => {
  const store = new MapStore()
  const source = store.addNode({ label: 'Stephen', x: 0, y: 0 })
  const target = store.addNode({ label: 'Andrew', x: 100, y: 0 })
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  store.addEdge({ source, target })
  assert.deepEqual(actions, ["added a link from 'Stephen' to 'Andrew'"])
  const long = store.addNode({
    label: 'Long\nfactor name that exceeds twenty-five characters',
    x: 0,
    y: 0,
  })
  const blank = store.addNode({ x: 0, y: 0 })
  store.addEdge({ source: long, target, label: 'Influence' })
  assert.equal(actions.at(-1), "added a link from 'Long factor name that exc...' to 'Andrew'")
  store.addEdge({ source: blank, target })
  assert.equal(actions.at(-1), 'added a link')
  const edges = new Map([
    ['one', { source, target }],
    ['two', { source: target, target: source }],
  ])
  assert.deepEqual(describeRecords('edges', new Map(), edges, new Set(edges.keys()), store.nodes), [
    'added 2 links',
  ])
  store.doc.destroy()
})

test('history identifies deleted factors and links, including links attached to deleted factors', () => {
  const store = new MapStore()
  const apple = store.addNode({ label: 'Apple', x: 0, y: 0 })
  const orange = store.addNode({ label: 'Orange', x: 100, y: 0 })
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  let link = store.addEdge({ source: apple, target: orange })
  store.remove([], [link])
  assert.equal(actions.at(-1), "deleted the link from 'Apple' to 'Orange'")
  link = store.addEdge({ source: apple, target: orange, label: 'Fruit link' })
  store.remove([], [link])
  assert.equal(actions.at(-1), "deleted link 'Fruit link'")
  store.addEdge({ source: apple, target: orange })
  store.remove([apple])
  assert.equal(actions.at(-1), "deleted factor 'Apple', deleted the link from 'Apple' to 'Orange'")
  store.remove([orange])
  assert.equal(actions.at(-1), "deleted factor 'Orange'")
  store.doc.destroy()
})

test('history records successful undo and redo with snapshots, but not empty operations', () => {
  const store = new MapStore()
  const history = new History({ store, room: 'test', withUI: false })
  const events = []
  history.log = (action, state) => events.push({ action, state })
  store.undo()
  store.redo()
  assert.equal(events.length, 0)
  const id = store.addNode({ label: 'Apple', x: 0, y: 0 })
  store.undoManager.stopCapturing()
  store.update('nodes', id, { label: 'Orange' })
  store.undo()
  assert.equal(events.at(-1).action, 'undid the last change')
  assert.equal(events.at(-1).state.nodes[0].label, 'Orange')
  assert.equal(store.nodes.get(id).label, 'Apple')
  store.redo()
  assert.equal(events.at(-1).action, 'redid the last change')
  assert.equal(events.at(-1).state.nodes[0].label, 'Apple')
  assert.equal(store.nodes.get(id).label, 'Orange')
  const count = events.length
  store.redo()
  assert.equal(events.length, count)
  store.doc.destroy()
})

test('history does not record an undo whose captured changes cancel out', () => {
  const store = new MapStore()
  const history = new History({ store, room: 'test', withUI: false })
  const actions = []
  history.log = (action) => actions.push(action)
  const id = store.addNode({ label: 'Temporary', x: 0, y: 0 })
  store.remove([id])
  const count = actions.length
  store.undo()
  assert.equal(actions.length, count)
  store.doc.destroy()
})

test('clusters use normal created and modified stamps', () => {
  const store = new MapStore()
  store.userName = 'User'
  store.addNode({ style: 'group0', x: 0, y: 0 })
  store.addNode({ style: 'group0', x: 10, y: 0 })
  clusterBy(store, 'style')
  const cluster = [...store.nodes.values()].find((node) => node.cluster)
  assert.equal(typeof cluster.created.time, 'number')
  assert.equal(cluster.created.user, 'User')
  assert.deepEqual(cluster.modified, cluster.created)
  store.doc.destroy()
})

test('reaction row is below the label while retaining shape width for hit testing', () => {
  const node = {
    boundingBox: ({ includeLabels }) =>
      includeLabels ? { x1: 0, x2: 90, y2: 60 } : { x1: 20, x2: 70, y2: 40 },
  }
  const box = thumbBounds(node)
  assert.deepEqual(box, { x1: 20, x2: 70, y2: 60 })
  assert.equal(Badges.prototype.isInThumbRow(box, { x: 25, y: 65 }), true)
  assert.equal(Badges.prototype.isInThumbRow(box, { x: 25, y: 45 }), false)
})

test('hidden and analysis-filtered elements fade without exposing collapsed members', () => {
  const store = new MapStore()
  const id = store.addNode({ x: 0, y: 0, hidden: true })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  const node = cy.getElementById(id)
  assert.equal(node.numericStyle('opacity'), 0.2)
  node.removeClass('hidden').addClass('analysisHidden')
  assert.equal(node.numericStyle('opacity'), 0.2)
  node.addClass('clusterHidden')
  assert.equal(node.style('display'), 'none')
  unbind()
  cy.destroy()
  store.doc.destroy()
})

test('factor badges and vote counts fade with the factor and restore their opacity', () => {
  const store = new MapStore()
  const id = store.addNode({
    x: 0,
    y: 0,
    locked: true,
    note: 'note',
    thumbUp: [42],
    thumbDown: [42],
  })
  const cy = cytoscape({ headless: true, styleEnabled: true })
  const unbind = bindGraph(cy, store)
  const node = cy.getElementById(id)
  const stack = []
  const alpha = []
  const ctx = {
    globalAlpha: 1,
    save() {
      stack.push(this.globalAlpha)
    },
    restore() {
      this.globalAlpha = stack.pop()
    },
    fillText() {
      alpha.push(this.globalAlpha)
    },
  }
  const badges = {
    settings: { voting: true },
    clientId: 42,
    icon: (context) => alpha.push(context.globalAlpha),
    drawThumbs: Badges.prototype.drawThumbs,
  }
  for (const [classes, expected] of [
    ['hidden', 0.2],
    ['analysisHidden', 0.2],
    ['', 1],
  ]) {
    node.classes(classes)
    Badges.prototype.drawNodeBadges.call(badges, ctx, node, true)
    assert.deepEqual(alpha.splice(0), Array(6).fill(expected))
    assert.equal(ctx.globalAlpha, 1)
  }
  unbind()
  cy.destroy()
  store.doc.destroy()
})
