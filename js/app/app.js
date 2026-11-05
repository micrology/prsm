import cytoscape from 'cytoscape'
import { WebsocketProvider } from 'y-websocket'
import { parseMapText, normaliseLegacy, legacyToV2 } from '../../cy/legacy.js'
import { MapStore } from '../../cy/store.js'
import { bindGraph } from '../../cy/binding.js'
import { Editor } from '../../cy/editing.js'
import { alertMsg, elem, listen, statusMsg } from '../utils.js'
import { docName, generateRoom, redirectToRoom, roomFromUrl, serverUrl } from './room.js'
import { loadUser } from './user.js'
import { Toolbar } from './toolbar.js'
import { bindZoomControl, fitMap } from './zoom.js'
import { StyleEditor } from '../../cy/styleeditor.js'
import { Palette } from './palette.js'
import { SidePanel, createColorPicker } from './sidepanel.js'
import { NetworkSettings } from './netsettings.js'
import { Badges } from './badges.js'
import { NotesPanel } from './notes.js'
import { Search } from './search.js'

const VERSION = '4.0.0'
const NO_SERVER_DELAY_MS = 8000

/**
 * PRSM 4: a Cytoscape map, shared through a Yjs server.
 * Nothing here is global: the pieces of the app are given the store and the graph they need.
 */
class App {
  constructor() {
    const url = new URL(document.location)
    this.room = roomFromUrl(url)
    if (!this.room) return redirectToRoom(generateRoom())
    this.store = new MapStore()
    this.cy = this.createGraph()
    this.provider = new WebsocketProvider(serverUrl(url), docName(this.room), this.store.doc)
    this.user = loadUser(this.provider.awareness.clientID)
    this.provider.awareness.setLocalState({ user: this.user })
    this.store.userName = this.user.name
    this.editor = new Editor(this.cy, this.store, {
      defaultNodeStyle: () => this.palette.lastStyle('node'),
      defaultEdgeStyle: () => this.palette.lastStyle('edge'),
      onMode: (mode) => this.toolbar.showMode(mode),
    })
    this.toolbar = new Toolbar({
      store: this.store,
      editor: this.editor,
      cy: this.cy,
      onOpenFile: () => elem('fileInput').click(),
    })
    bindZoomControl(this.cy)
    this.createSidePanel()
    this.badges = new Badges({ store: this.store, cy: this.cy, clientId: this.user.id })
    this.notes = new NotesPanel({ store: this.store, cy: this.cy })
    this.search = new Search({ cy: this.cy })
    this.wireFileInput()
    this.waitForServer()
    elem('version').textContent = VERSION
  }

  /**
   * @returns {cytoscape.Core} an empty graph, bound to the store
   */
  createGraph() {
    const cy = cytoscape({
      container: elem('net-pane'),
      layout: { name: 'preset' },
      wheelSensitivity: 0.3,
      selectionType: 'additive',
      minZoom: 0.02,
      maxZoom: 8,
    })
    bindGraph(cy, this.store)
    return cy
  }

  createSidePanel() {
    this.sidePanel = new SidePanel()
    this.styleEditor = new StyleEditor(elem('styleEditorBody'))
    this.styleEditor.attach({ store: this.store, cy: this.cy })
    this.styleEditor.setView({ store: this.store, cy: this.cy })
    listen('styleDialogClose', 'click', () => elem('styleDialog').close())
    this.palette = new Palette({
      store: this.store,
      cy: this.cy,
      onEditStyle: (id) => this.editStyle(id),
    })
    this.networkSettings = new NetworkSettings({
      store: this.store,
      cy: this.cy,
      colorPicker: createColorPicker(),
    })
  }

  /**
   * @param {string} styleId the style to show in the style editor
   */
  editStyle(styleId) {
    this.styleEditor.current = styleId
    this.styleEditor.render()
    const dialog = elem('styleDialog')
    if (!dialog.open) dialog.show()
  }

  /** Show the map once the server has sent what it holds; a room with nothing in it is new */
  waitForServer() {
    this.noServerTimer = setTimeout(() => this.showNoServer(), NO_SERVER_DELAY_MS)
    elem('loading').classList.add('show')
    this.provider.once('sync', () => {
      clearTimeout(this.noServerTimer)
      if (this.store.styles.size === 0) this.initialiseNewMap()
      elem('loading').classList.remove('show')
      elem('net-pane').classList.add('loaded')
      this.cy.resize()
      fitMap(this.cy)
      this.store.undoManager.clear()
      statusMsg(`Connected to room ${this.room}`)
    })
  }

  showNoServer() {
    elem('loading').classList.remove('show')
    elem('no-server').classList.add('show')
  }

  /** A new room gets an empty map with the standard styles */
  initialiseNewMap() {
    this.store.loadFile(legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file)
  }

  wireFileInput() {
    listen('fileInput', 'change', async (e) => {
      const file = e.target.files[0]
      e.target.value = ''
      if (file) this.openText(await file.text())
    })
  }

  /**
   * Replace the map with the contents of a PRSM file in any format earlier versions wrote
   * @param {string} text
   */
  async openText(text) {
    await document.fonts.load('14px Oxygen')
    const { file, report } = legacyToV2(normaliseLegacy(parseMapText(text)))
    if (!file) return alertMsg(report.warnings.join('; '), 'error')
    this.store.loadFile(file)
    fitMap(this.cy)
    alertMsg(`Opened a map of ${file.nodes.length} factors and ${file.edges.length} links`, 'info')
  }
}

window.prsm = new App()
