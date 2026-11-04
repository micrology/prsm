/* ****************************************************************************************
editing.js: user gestures on the graph. Each gesture calls a MapStore method; the graph then
updates itself through binding.js.

Modes (as in the current app):
  select   - default: click/box select, drag factors, drag a selected link to bend it
  addNode  - click on the background to create a factor
  addLink  - drag from a factor to another factor to create a link
**************************************************************************************** */
import cytoscape from 'cytoscape'
import edgehandles from 'cytoscape-edgehandles'
import { applyCurves } from './graph.js'
import { setCollapsed, dissolveCluster } from './cluster.js'

cytoscape.use(edgehandles)

const SNAP_TO_STRAIGHT = 0.04
const MAX_ROUNDNESS = 2

/**
 * Convert the position of the pointer relative to a link's end points into a curve
 * @param {{x:number,y:number}} src
 * @param {{x:number,y:number}} tgt
 * @param {{x:number,y:number}} pt pointer position (model coordinates)
 * @returns {{side:number,roundness:number}|undefined} undefined means straight
 */
export function curveFromPointer(src, tgt, pt) {
  const dx = tgt.x - src.x
  const dy = tgt.y - src.y
  const len = Math.hypot(dx, dy)
  if (len < 1) return undefined
  // signed perpendicular distance of the pointer from the chord, positive on the (-dy, dx) side
  const d = ((pt.x - src.x) * -dy + (pt.y - src.y) * dx) / len
  const roundness = Math.min((2 * Math.abs(d)) / len, MAX_ROUNDNESS)
  if (roundness < SNAP_TO_STRAIGHT) return undefined
  return { side: d < 0 ? -1 : 1, roundness: Math.round(roundness * 100) / 100 }
}

/**
 * Attach the editing behaviour to a graph
 */
export class Editor {
  /** the editor of the pane the user last used (several graphs may share a page) */
  static active = null

  /**
   * @param {cytoscape.Core} cy graph, already bound to store
   * @param {MapStore} store
   * @param {object} [options]
   * @param {function} [options.onMode] called with the new mode name
   * @param {function} [options.defaultNodeStyle] returns the style id for new factors
   * @param {function} [options.defaultEdgeStyle] returns the style id for new links
   * @param {function} [options.onMessage] called with a message to show the user
   */
  constructor(cy, store, options = {}) {
    this.cy = cy
    this.store = store
    this.options = options
    this.mode = 'select'
    this.pendingMoves = new Set()
    this.handles = this.createEdgeHandles()
    cy.on('dragfree', 'node', (evt) => this.queueMove(evt.target))
    cy.on('tap', (evt) => this.onTap(evt))
    cy.on('dbltap', 'node, edge', (evt) => this.onDoubleTap(evt.target))
    cy.on('cxttap', 'node[cluster]', (evt) => dissolveCluster(store, evt.target.id()))
    cy.on('tapstart', 'edge:selected', (evt) => this.startBend(evt))
    cy.on('ehcomplete', (evt, source, target, added) => this.onLinkDrawn(source, target, added))
    cy.container().addEventListener('pointerdown', () => (Editor.active = this), true)
    this.onKey = (evt) => Editor.active === this && this.handleKey(evt)
    cy.container().ownerDocument.addEventListener('keydown', this.onKey)
  }

  /** remove all listeners */
  destroy() {
    this.cy.container().ownerDocument.removeEventListener('keydown', this.onKey)
    this.handles.destroy()
  }

  /**
   * @returns {object} an edgehandles instance, in draw mode only while adding links
   */
  createEdgeHandles() {
    return this.cy.edgehandles({
      canConnect: (src, tgt) => this.store.canLink(src.id(), tgt.id()),
      snap: false,
      noEdit: true,
      disableBrowserGestures: true,
    })
  }

  /**
   * @param {'select'|'addNode'|'addLink'} mode
   */
  setMode(mode) {
    this.mode = mode
    const linking = mode === 'addLink'
    // edgehandles locks the factors while draw mode is on, and restores them when it ends
    if (linking) this.handles.enableDrawMode()
    else this.handles.disableDrawMode()
    this.cy.container().classList.toggle('adding-node', mode === 'addNode')
    this.cy.container().classList.toggle('adding-link', linking)
    this.options.onMode?.(mode)
  }

  /**
   * Remember that a node has been moved; all the moves of one gesture are saved together
   * @param {cytoscape.NodeSingular} node
   */
  queueMove(node) {
    const first = this.pendingMoves.size === 0
    const moved = node.selected() ? this.cy.nodes(':selected') : node
    moved.union(moved.descendants()).forEach((n) => this.pendingMoves.add(n.id()))
    if (first) queueMicrotask(() => this.flushMoves())
  }

  flushMoves() {
    const positions = {}
    for (const id of this.pendingMoves) {
      const { x, y } = this.cy.getElementById(id).position()
      positions[id] = { x, y }
    }
    this.pendingMoves.clear()
    this.store.moveNodes(positions)
  }

  /**
   * A click on the background in addNode mode creates a factor
   * @param {object} evt Cytoscape tap event
   */
  onTap(evt) {
    if (this.mode !== 'addNode' || evt.target !== this.cy) return
    const style = this.options.defaultNodeStyle?.() ?? 'group0'
    const { x, y } = evt.position
    this.setMode('select')
    this.openInput(evt.renderedPosition, 120, '', (label) => {
      if (label) this.store.addNode({ label, style, x, y })
    })
  }

  /**
   * The user has finished dragging a new link between two factors
   * @param {cytoscape.NodeSingular} source
   * @param {cytoscape.NodeSingular} target
   * @param {cytoscape.EdgeSingular} ghost the edge created by edgehandles, which we discard
   */
  onLinkDrawn(source, target, ghost) {
    ghost.remove()
    const style = this.options.defaultEdgeStyle?.() ?? 'edge0'
    this.store.addEdge({ source: source.id(), target: target.id(), label: '', style })
    this.setMode('select')
  }

  /**
   * Dragging a selected link bends it. The curve follows the pointer; it is saved on release.
   * @param {object} evt Cytoscape tapstart event
   */
  startBend(evt) {
    if (this.mode !== 'select') return
    const edge = evt.target
    const cy = this.cy
    const [src, tgt] = [edge.source().position(), edge.target().position()]
    let curve = edge.data('curve')
    let moved = false
    cy.userPanningEnabled(false)
    const onDrag = (e) => {
      moved = true
      curve = curveFromPointer(src, tgt, e.position)
      edge.data('curve', curve)
      applyCurves(edge, cy.scratch('curveMode'))
    }
    cy.on('tapdrag', onDrag)
    cy.one('tapend', () => {
      cy.off('tapdrag', onDrag)
      cy.userPanningEnabled(true)
      if (moved) this.store.update('edges', edge.id(), { curve })
    })
  }

  /**
   * Double-click opens or closes a cluster, and edits the label of anything else
   * @param {cytoscape.SingularElementReturnValue} ele
   */
  onDoubleTap(ele) {
    if (ele.hasClass('meta')) return
    const cluster = ele.data('cluster')
    if (cluster) setCollapsed(this.store, ele.id(), !cluster.collapsed)
    else this.editLabel(ele)
  }

  /**
   * Show a text box over a factor or link to edit its label
   * @param {cytoscape.SingularElementReturnValue} ele
   */
  editLabel(ele) {
    const pos = ele.isNode() ? ele.renderedPosition() : ele.renderedMidpoint()
    const kind = ele.isNode() ? 'nodes' : 'edges'
    this.openInput(pos, Math.max(ele.renderedWidth(), 120), ele.data('label'), (label) => {
      if (label !== ele.data('label')) this.store.update(kind, ele.id(), { label })
    })
  }

  /**
   * Show a text box at a position in the graph; Enter or losing focus accepts, Escape cancels
   * @param {{x:number,y:number}} pos centre of the box, in pixels within the graph container
   * @param {number} width in pixels
   * @param {string} initial starting text
   * @param {function} onDone called with the text if accepted
   */
  openInput(pos, width, initial, onDone) {
    const container = this.cy.container()
    const input = container.ownerDocument.createElement('input')
    input.className = 'cy-label-editor'
    input.value = initial
    input.style.setProperty('--x', `${pos.x}px`)
    input.style.setProperty('--y', `${pos.y}px`)
    input.style.setProperty('--w', `${width}px`)
    container.append(input)
    input.focus()
    input.select()
    let done = false
    const finish = (accept) => {
      if (done) return
      done = true
      const text = input.value
      input.remove()
      if (accept) onDone(text)
    }
    input.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') finish(true)
      if (e.key === 'Escape') finish(false)
    })
    input.addEventListener('blur', () => finish(true))
  }

  /**
   * Keyboard shortcuts: Delete, Undo, Redo, Escape
   * @param {KeyboardEvent} evt
   */
  handleKey(evt) {
    if (evt.target.matches?.('input, textarea, [contenteditable]')) return
    const mod = evt.metaKey || evt.ctrlKey
    if (mod && evt.key.toLowerCase() === 'z') {
      evt.preventDefault()
      if (evt.shiftKey) this.store.redo()
      else this.store.undo()
    } else if (evt.key === 'Delete' || evt.key === 'Backspace') {
      this.deleteSelection()
    } else if (evt.key === 'Escape') {
      this.setMode('select')
    }
  }

  deleteSelection() {
    const sel = this.cy.elements(':selected')
    if (sel.empty()) return
    this.store.remove(
      sel.nodes().map((n) => n.id()),
      sel.edges().map((e) => e.id())
    )
  }
}
