import * as Y from 'yjs'
import { WebsocketProvider } from 'y-websocket'
import cytoscape from 'cytoscape'
import { parseMapText, normaliseLegacy, legacyToV2 } from './legacy.js'
import { MapStore } from './store.js'
import { bindGraph } from './binding.js'
import { Editor } from './editing.js'
import { clusterBy, clusterByLouvain } from './cluster.js'
import { StyleEditor } from './styleeditor.js'
import { TableView } from './tableview.js'

const info = document.getElementById('info')
const view = { a: null, b: null }
let active = 'a'

/**
 * Create a store, graph and editor in a container
 * @param {string} id container id
 * @returns {{store: MapStore, cy: cytoscape.Core, editor: Editor}}
 */
function createView(id) {
  const store = new MapStore()
  const cy = cytoscape({
    container: document.getElementById(id),
    layout: { name: 'preset' },
    wheelSensitivity: 0.3,
    selectionType: 'additive',
    minZoom: 0.02,
    maxZoom: 8,
  })
  bindGraph(cy, store)
  const editor = new Editor(cy, store, {
    defaultNodeStyle: () => [...store.styles.keys()].find((k) => k.startsWith('group')),
    defaultEdgeStyle: () => [...store.styles.keys()].find((k) => k.startsWith('edge')),
    onMode: (mode) => syncMode(mode),
  })
  document.getElementById(id).addEventListener('pointerdown', () => setActive(id), true)
  return { store, cy, editor }
}

/**
 * The Add buttons set the mode of both panes, so that either can be clicked next
 * @param {string} mode
 */
function syncMode(mode) {
  for (const v of [view.a, view.b]) if (v?.editor.mode !== mode) v.editor.setMode(mode)
  for (const b of ['addNode', 'addLink']) {
    document.getElementById(b).classList.toggle('active', b === mode)
  }
}

/**
 * The toolbar acts on the pane that was used last
 * @param {string} id container id
 */
function setActive(id) {
  active = id === 'cy' ? 'a' : 'b'
  document.getElementById('cy').classList.toggle('current', active === 'a')
  document.getElementById('cy2').classList.toggle('current', active === 'b')
  styleEditor.setView(view[active])
}

/** connect two stores so that every change made in one appears in the other, as a server would */
function connect(a, b) {
  const forward = (to) => (update, origin) => {
    if (origin !== 'remote') Y.applyUpdate(to.doc, update, 'remote')
  }
  a.doc.on('update', forward(b))
  b.doc.on('update', forward(a))
}

view.a = createView('cy')
view.b = createView('cy2')
const params = new URLSearchParams(location.search)
if (params.get('ws')) {
  // ?ws=ws://localhost:4399&room=test: both panes are separate clients of a real Yjs server
  const room = `prsm-test-${params.get('room') ?? 'room'}`
  for (const v of [view.a, view.b]) {
    v.provider = new WebsocketProvider(params.get('ws'), room, v.store.doc)
  }
  window.providers = [view.a.provider, view.b.provider]
} else connect(view.a.store, view.b.store)
const styleEditor = new StyleEditor(document.getElementById('styles'))
styleEditor.attach(view.a)
styleEditor.attach(view.b)
styleEditor.setView(view.a)
document.getElementById('toggleStyles').addEventListener('click', () => {
  const panel = document.getElementById('styles')
  panel.hidden = !panel.hidden
  for (const v of [view.a, view.b]) v.cy.resize()
})

document.getElementById('file').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (file) loadText(await file.text())
})
document.getElementById('curve').addEventListener('change', (e) => {
  view[active].store.setSetting('curve', e.target.value)
})
document.getElementById('cluster').addEventListener('change', (e) => {
  const { store } = view[active]
  if (e.target.value !== 'louvain') return clusterBy(store, e.target.value)
  if (clusterByLouvain(store) < 0) e.target.value = 'none'
})

/** Offer the user's attributes as ways to cluster */
function fillClusterMenu() {
  const menu = document.getElementById('cluster')
  const fixed = ['none', 'style', 'color', 'louvain']
  for (const o of [...menu.options]) {
    if (!fixed.includes(o.value)) o.remove()
  }
  const titles = view[active].store.attributeTitles()
  for (const [field, title] of Object.entries(titles)) {
    if (title === '*deleted*') continue
    menu.append(
      Object.assign(document.createElement('option'), { value: field, textContent: title })
    )
  }
}
document.getElementById('addNode').addEventListener('click', () => toggleMode('addNode'))
document.getElementById('addLink').addEventListener('click', () => toggleMode('addLink'))
document.getElementById('undo').addEventListener('click', () => view[active].store.undo())
document.getElementById('redo').addEventListener('click', () => view[active].store.redo())
document.getElementById('second').addEventListener('change', (e) => {
  document.getElementById('cy2').classList.toggle('off', !e.target.checked)
  view.b.cy.resize()
  view.b.cy.fit(undefined, 30)
})

/**
 * @param {string} mode 'addNode' or 'addLink'
 */
function toggleMode(mode) {
  const { editor } = view[active]
  editor.setMode(editor.mode === mode ? 'select' : mode)
}

/**
 * Load a map into the shared document. Also exposed for automated tests: await window.loadMap(text)
 * @param {string} text contents of a .prsm file
 */
async function loadText(text) {
  await document.fonts.load('14px Oxygen')
  const t0 = performance.now()
  const { file, report } = legacyToV2(normaliseLegacy(parseMapText(text)))
  if (!file) {
    info.textContent = report.warnings.join('; ')
    return
  }
  const t1 = performance.now()
  document.getElementById('curve').value = file.meta.settings.curve
  document.getElementById('cluster').value = 'none'
  view.a.store.loadFile(file)
  const t2 = performance.now()
  for (const v of [view.a, view.b]) {
    v.cy.resize()
    v.cy.fit(undefined, 30)
  }
  info.textContent =
    `${file.nodes.length} factors, ${file.edges.length} links; ` +
    `convert ${(t1 - t0).toFixed(0)} ms, load+render ${(t2 - t1).toFixed(0)} ms`
}
window.loadMap = loadText
view.a.store.doc.on('afterTransaction', (tr) => {
  if (tr.changed.has(view.a.store.meta)) fillClusterMenu()
})
window.view = view

const tableView = new TableView(document.getElementById('table'), view.a.store, {
  onSelect: (ids) => {
    const { cy } = view.a
    cy.batch(() => {
      cy.elements(':selected').unselect()
      for (const id of ids) cy.getElementById(id).select()
    })
  },
})
view.a.cy.on('select unselect', () =>
  tableView.setSelection(view.a.cy.elements(':selected').map((e) => e.id()))
)
document.getElementById('toggleTable').addEventListener('click', () => {
  const panel = document.getElementById('table')
  panel.hidden = !panel.hidden
  for (const v of [view.a, view.b]) v.cy.resize()
})
window.tableView = tableView
