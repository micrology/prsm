import cytoscape from 'cytoscape'
import { WebsocketProvider } from 'y-websocket'
import { parseMapText, normaliseLegacy, legacyToV2 } from '../../cy/legacy.js'
import { MapStore } from '../../cy/store.js'
import { bindGraph } from '../../cy/binding.js'
import { Editor } from '../../cy/editing.js'
import { alertMsg, dragElement, elem, listen, statusMsg } from '../utils.js'
import { docName, generateRoom, redirectToRoom, roomFromUrl, serverUrl } from './room.js'
import { loadUser } from './user.js'
import { Toolbar } from './toolbar.js'
import { bindZoomControl, fitMap } from './zoom.js'
import { StyleEditor } from '../../cy/styleeditor.js'
import { Palette } from './palette.js'
import { SidePanel, createColorPicker } from './sidepanel.js'
import { NetworkSettings } from './netsettings.js'
import '../../cy/editors.css'
import { useColorPicker } from '../../cy/colorwell.js'
import { Collaboration } from './collab.js'
import { History } from './history.js'
import { Badges } from './badges.js'
import { NotesPanel } from './notes.js'
import { Search } from './search.js'
import { Analysis } from './analysis.js'
import { Legend } from './legend.js'
import { Minimap } from './minimap.js'
import { Share } from './share.js'
import { Rooms } from './rooms.js'
import { Tutorial } from './tutorial.js'

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
    for (const id of ['buttons', 'net-pane', 'panel', 'nodeNotePanel', 'edgeNotePanel']) {
      elem(id).inert = true
    }
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
      onAddingFactor: (pos) => this.collab?.setAddingFactor(pos),
      isReadOnly: () => !this.ready || Boolean(this.store.meta.get('viewOnly')),
    })
    this.toolbar = new Toolbar({
      store: this.store,
      editor: this.editor,
      cy: this.cy,
      onOpenFile: () => elem('fileInput').click(),
    })
    bindZoomControl(this.cy)
    this.createSidePanel()
    this.analysis = new Analysis({ store: this.store, cy: this.cy })
    this.legend = new Legend({ store: this.store, palette: this.palette })
    this.minimap = new Minimap(this.cy)
    this.badges = new Badges({ store: this.store, cy: this.cy, clientId: this.user.id })
    this.notes = new NotesPanel({ store: this.store, cy: this.cy })
    this.search = new Search({ cy: this.cy })
    this.collab = new Collaboration({
      store: this.store,
      cy: this.cy,
      provider: this.provider,
      user: this.user,
    })
    this.history = new History({ store: this.store, room: this.room })
    this.share = new Share({ store: this.store, provider: this.provider })
    this.rooms = new Rooms({ store: this.store, room: this.room, server: serverUrl(url) })
    this.tutorial = new Tutorial({ user: this.user, collaboration: this.collab })
    this.bindTitle()
    this.store.meta.observe((event) => {
      if (this.ready && (event.keysChanged.has('viewOnly') || event.keysChanged.has('allowCopy'))) {
        this.applyViewOnly()
      }
    })
    listen('help', 'click', () =>
      window.open('https://www.prsm.uk/doc/help/doc_build/manual/Introduction.html', 'helpWindow')
    )
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
    this.styleEditor = new StyleEditor(elem('styleEditorBody'), { single: true })
    this.cy.on('dbltap', (evt) => evt.target === this.cy && fitMap(this.cy))
    this.styleEditor.attach({ store: this.store, cy: this.cy })
    this.styleEditor.setView({ store: this.store, cy: this.cy })
    dragElement(elem('styleDialog'), elem('styleDialogBar'))
    listen('styleDialogClose', 'click', () => this.closeStyleDialog(true))
    listen('styleDialogSave', 'click', () => this.closeStyleDialog(false))
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && elem('styleDialog').open) this.closeStyleDialog(true)
    })
    this.palette = new Palette({
      store: this.store,
      cy: this.cy,
      onEditStyle: (id) => this.editStyle(id),
    })
    const colorPicker = createColorPicker()
    useColorPicker(colorPicker)
    this.networkSettings = new NetworkSettings({ store: this.store, cy: this.cy, colorPicker })
  }

  /**
   * @param {string} styleId the style to show in the style editor
   */
  editStyle(styleId) {
    const dialog = elem('styleDialog')
    if (dialog.open) this.closeStyleDialog(false)
    this.styleBackup = { id: styleId, style: structuredClone(this.store.styles.get(styleId)) }
    this.styleEditor.current = styleId
    this.styleEditor.render()
    elem('styleDialogTitle').textContent = `Edit style: ${this.styleBackup.style.name ?? styleId}`
    dialog.show()
  }

  /**
   * @param {boolean} revert true to put the style back as it was when the dialog was opened
   */
  closeStyleDialog(revert) {
    const backup = this.styleBackup
    this.styleBackup = null
    if (revert && backup) this.store.setStyle(backup.id, backup.style)
    elem('styleDialog').close()
  }

  /** Show the map once the server has sent what it holds; a room with nothing in it is new */
  waitForServer() {
    this.noServerTimer = setTimeout(() => this.showNoServer(), NO_SERVER_DELAY_MS)
    elem('loading').classList.add('show')
    this.provider.once('sync', () => {
      clearTimeout(this.noServerTimer)
      if (this.store.styles.size === 0) this.initialiseNewMap()
      this.rooms.start()
      this.ready = true
      this.applyViewOnly()
      for (const id of ['buttons', 'net-pane', 'panel', 'nodeNotePanel', 'edgeNotePanel']) {
        elem(id).inert = false
      }
      elem('loading').classList.remove('show')
      elem('net-pane').classList.add('loaded')
      this.cy.resize()
      fitMap(this.cy)
      this.store.undoManager.clear()
      this.history.reset()
      statusMsg(`Connected to room ${this.room}`)
      if (!this.store.meta.get('viewOnly')) this.tutorial.startIfNeeded()
    })
  }

  /** Set up the view-only interface from the shared map metadata. */
  applyViewOnly() {
    const viewOnly = Boolean(this.store.meta.get('viewOnly'))
    document.body.classList.toggle('view-only', viewOnly)
    this.cy.autoungrabify(viewOnly)
    elem('maptitle').contentEditable = String(!viewOnly)
    elem('read-only-notice').hidden = !viewOnly
    elem('copy-map-button').classList.toggle(
      'view-copy-enabled',
      viewOnly && Boolean(this.store.meta.get('allowCopy'))
    )
    for (const id of [
      'addNode',
      'addLink',
      'undo',
      'redo',
      'deleteNode',
      'openFile',
      'panelToggle',
    ]) {
      elem(id).disabled = viewOnly
    }
    this.notes.setReadOnly(viewOnly)
  }

  showNoServer() {
    elem('loading').classList.remove('show')
    elem('no-server').classList.add('show')
  }

  /** A new room gets an empty map with the standard styles */
  initialiseNewMap() {
    this.store.loadFile(legacyToV2(normaliseLegacy({ nodes: [], edges: [] })).file)
  }

  /** Keep the editable map title in sync with the shared document. */
  bindTitle() {
    const title = elem('maptitle')
    const current = () => this.store.meta.get('title')?.trim() || 'Untitled map'
    const show = () => {
      title.textContent = current()
      title.classList.toggle('unsetmaptitle', current() === 'Untitled map')
    }
    let beforeEdit = ''
    title.addEventListener('focus', () => (beforeEdit = title.textContent))
    title.addEventListener('blur', () => {
      const value = title.textContent.replace(/\s+/g, ' ').trim() || 'Untitled map'
      if (value !== beforeEdit && value !== current()) {
        this.store.transact(() => this.store.meta.set('title', value))
      }
      show()
    })
    title.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') title.textContent = beforeEdit
      if (event.key === 'Enter' || event.key === 'Escape') {
        event.preventDefault()
        title.blur()
      }
    })
    this.store.meta.observe((event) => {
      if (event.keysChanged.has('title') && document.activeElement !== title) show()
    })
    show()
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
