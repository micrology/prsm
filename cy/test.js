import * as Y from 'yjs'
import cytoscape from 'cytoscape'
import { parseMapText, normaliseLegacy, legacyToV2 } from './legacy.js'
import { MapStore } from './store.js'
import { bindGraph } from './binding.js'
import { Editor } from './editing.js'

const info = document.getElementById('info')
const view = { a: null, b: null }

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
    onMode: (mode) => highlight(id, mode),
  })
  return { store, cy, editor }
}

/**
 * Show which mode is active on the buttons
 * @param {string} id container id
 * @param {string} mode
 */
function highlight(id, mode) {
  if (id !== 'cy') return
  for (const b of ['addNode', 'addLink']) {
    document.getElementById(b).classList.toggle('active', b === mode)
  }
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
connect(view.a.store, view.b.store)

document.getElementById('file').addEventListener('change', async (e) => {
  const file = e.target.files[0]
  if (file) loadText(await file.text())
})
document.getElementById('curve').addEventListener('change', (e) => {
  const settings = { ...view.a.store.meta.get('settings'), curve: e.target.value }
  view.a.store.transact(() => view.a.store.meta.set('settings', settings), 'meta')
})
document.getElementById('addNode').addEventListener('click', () => toggleMode('addNode'))
document.getElementById('addLink').addEventListener('click', () => toggleMode('addLink'))
document.getElementById('undo').addEventListener('click', () => view.a.store.undo())
document.getElementById('redo').addEventListener('click', () => view.a.store.redo())
document.getElementById('second').addEventListener('change', (e) => {
  document.getElementById('cy2').classList.toggle('off', !e.target.checked)
  view.b.cy.resize()
  view.b.cy.fit(undefined, 30)
})

/**
 * @param {string} mode 'addNode' or 'addLink'
 */
function toggleMode(mode) {
  const { editor } = view.a
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
window.view = view
