/* ****************************************************************************************
store.js: the Yjs document holding a PRSM map (schema v2). Everything the user can change is
written here; the Cytoscape graph is only ever updated from this store (see binding.js),
apart from node positions while a node is being dragged.
**************************************************************************************** */
import * as Y from 'yjs'

export const LOCAL = 'local'
const LOAD = 'load'
const SCHEMA_VERSION = 2

/**
 * Split a record map entry into the form used in files (id included)
 * @param {Y.Map} ymap
 * @returns {Array<object>}
 */
function toRecords(ymap) {
  return [...ymap.entries()].map(([id, rec]) => ({ id, ...rec }))
}

/**
 * A map held in a Yjs document
 */
export class MapStore {
  /**
   * @param {Y.Doc} [doc]
   */
  constructor(doc = new Y.Doc()) {
    this.doc = doc
    this.meta = doc.getMap('meta')
    this.nodes = doc.getMap('nodes')
    this.edges = doc.getMap('edges')
    this.styles = doc.getMap('styles')
    this.history = doc.getArray('history')
    this.userName = ''
    this.undoManager = new Y.UndoManager([this.nodes, this.edges, this.styles], {
      trackedOrigins: new Set([LOCAL]),
      captureTimeout: 400,
    })
  }

  /**
   * @param {function} fn changes to make in one transaction (one undo step)
   * @param {string} [origin]
   */
  transact(fn, origin = LOCAL) {
    if (this.meta.get('viewOnly')) throw new Error('This map is read-only')
    this.doc.transact(fn, origin)
  }

  /**
   * Replace the content of the document with a v2 file (not undoable)
   * @param {object} file v2 file object, as produced by legacyToV2()
   * @param {{replaceHistory?: boolean}} [options] whether to replace the shared history
   */
  loadFile(file, { replaceHistory = false } = {}) {
    this.transact(() => {
      for (const m of [this.nodes, this.edges, this.styles]) m.clear()
      this.meta.clear()
      for (const [k, v] of Object.entries(file.meta)) this.meta.set(k, v)
      this.meta.set('schemaVersion', SCHEMA_VERSION)
      for (const [id, st] of Object.entries(file.styles)) this.styles.set(id, st)
      for (const { id, ...rec } of file.nodes) this.nodes.set(id, rec)
      for (const { id, ...rec } of file.edges) this.edges.set(id, rec)
      if (replaceHistory) {
        this.history.delete(0, this.history.length)
        if (file.history?.length) this.history.push(file.history)
      }
    }, LOAD)
    this.undoManager.clear()
  }

  /**
   * @returns {object} the map as a v2 file object
   */
  toFile() {
    return {
      format: 'prsm',
      schemaVersion: SCHEMA_VERSION,
      saved: new Date().toISOString(),
      meta: Object.fromEntries(this.meta.entries()),
      styles: Object.fromEntries(this.styles.entries()),
      nodes: toRecords(this.nodes),
      edges: toRecords(this.edges),
    }
  }

  /** @returns {{time:number,user:string}} the form of the created and modified fields */
  stamp() {
    return { time: Date.now(), user: this.userName }
  }

  /**
   * Add a factor
   * @param {object} rec node record without id
   * @returns {string} the new id
   */
  addNode(rec) {
    const id = crypto.randomUUID()
    const now = this.stamp()
    this.transact(() => this.nodes.set(id, { created: now, modified: now, ...rec }))
    return id
  }

  /**
   * Add a link
   * @param {object} rec edge record without id; source and target are node ids
   * @returns {string|null} the new id, or null if the link is not allowed
   */
  addEdge(rec) {
    if (!this.canLink(rec.source, rec.target)) return null
    const id = crypto.randomUUID()
    const now = this.stamp()
    this.transact(() => this.edges.set(id, { created: now, modified: now, ...rec }))
    return id
  }

  /**
   * A link is allowed between two existing, different factors if there isn't one already
   * @param {string} source node id
   * @param {string} target node id
   * @returns {boolean}
   */
  canLink(source, target) {
    if (source === target || !this.nodes.has(source) || !this.nodes.has(target)) return false
    if (this.nodes.get(source).cluster || this.nodes.get(target).cluster) return false
    for (const e of this.edges.values()) {
      if (e.source === source && e.target === target) return false
    }
    return true
  }

  /**
   * Change some properties of a node or edge
   * @param {'nodes'|'edges'} kind
   * @param {string} id
   * @param {object} patch properties to set (undefined values delete the property)
   */
  update(kind, id, patch) {
    const ymap = this[kind]
    const old = ymap.get(id)
    if (!old) return
    const rec = { ...old, ...patch, modified: this.stamp() }
    for (const k of Object.keys(rec)) if (rec[k] === undefined) delete rec[k]
    this.transact(() => ymap.set(id, rec))
  }

  /**
   * Record the new positions of nodes after a drag
   * @param {Object<string,{x:number,y:number}>} positions by node id
   */
  moveNodes(positions) {
    this.transact(() => {
      for (const [id, { x, y }] of Object.entries(positions)) {
        const old = this.nodes.get(id)
        if (old) this.nodes.set(id, { ...old, x, y })
      }
    })
  }

  /**
   * Delete nodes and edges, together with the edges attached to the deleted nodes
   * @param {Array<string>} nodeIds
   * @param {Array<string>} edgeIds
   */
  remove(nodeIds, edgeIds = []) {
    const gone = new Set(nodeIds)
    this.transact(() => {
      for (const [id, e] of this.edges.entries()) {
        if (gone.has(e.source) || gone.has(e.target)) this.edges.delete(id)
      }
      this.freeMembers(gone)
      for (const id of edgeIds) this.edges.delete(id)
      for (const id of nodeIds) this.nodes.delete(id)
    })
  }

  /**
   * Members of deleted clusters become ordinary factors again
   * @param {Set<string>} gone ids of nodes being deleted
   */
  freeMembers(gone) {
    for (const [id, rec] of this.nodes.entries()) {
      if (!gone.has(rec.inCluster) || gone.has(id)) continue
      const { inCluster, ...rest } = rec
      this.nodes.set(id, rest)
    }
  }

  /**
   * Change one of the map-wide settings
   * @param {string} key
   * @param {*} value
   */
  setSetting(key, value) {
    this.transact(() => this.meta.set('settings', { ...this.meta.get('settings'), [key]: value }))
  }

  /**
   * Replace a style definition
   * @param {string} id style id (e.g. group3)
   * @param {{kind:string,name:string,css:object}} style
   */
  setStyle(id, style) {
    this.transact(() => this.styles.set(id, style))
  }

  /** @returns {object} user-defined attribute titles by field (att1, att2...); deleted ones are '*deleted*' */
  attributeTitles() {
    return this.meta.get('attributeTitles') ?? {}
  }

  /**
   * Add a user-defined attribute (a column in the table)
   * @returns {string} the field name, e.g. att3
   */
  addAttribute() {
    const titles = this.attributeTitles()
    const n = Object.keys(titles).length + 1
    this.transact(() => this.meta.set('attributeTitles', { ...titles, [`att${n}`]: `Att ${n}` }))
    return `att${n}`
  }

  /**
   * Rename an attribute, or delete it (title '*deleted*'; the values stay in the records)
   * @param {string} field
   * @param {string} title
   */
  setAttributeTitle(field, title) {
    this.transact(() =>
      this.meta.set('attributeTitles', { ...this.attributeTitles(), [field]: title })
    )
  }

  /**
   * Add a new style
   * @param {'node'|'edge'} kind
   * @param {string} name
   * @param {object} css Cytoscape style properties
   * @returns {string} the id of the new style
   */
  addStyle(kind, name, css) {
    const id = `${kind === 'node' ? 'group' : 'edge'}${crypto.randomUUID().slice(0, 8)}`
    this.setStyle(id, { kind, name, css })
    return id
  }

  /**
   * Delete a style; elements that used it get another style
   * @param {string} id style to delete
   * @param {string} replacement id of the style the elements should use instead
   */
  deleteStyle(id, replacement) {
    const kind = this.styles.get(id)?.kind
    if (!kind || id === `${kind}Base`) return
    this.transact(() => {
      const ymap = kind === 'node' ? this.nodes : this.edges
      for (const [key, rec] of ymap.entries()) {
        if (rec.style === id) ymap.set(key, { ...rec, style: replacement })
      }
      this.styles.delete(id)
    })
  }

  /**
   * Set the style of several nodes or edges in one undo step
   * @param {'nodes'|'edges'} kind
   * @param {Array<string>} ids
   * @param {string} style style id
   */
  setElementStyle(kind, ids, style) {
    this.transact(() => {
      for (const id of ids) this.update(kind, id, { style })
    })
  }

  /**
   * Change the per-element style overrides of several nodes or edges
   * @param {'nodes'|'edges'} kind
   * @param {Array<string>} ids
   * @param {object|null} patch properties to add (undefined deletes one); null clears all overrides
   */
  setOverrides(kind, ids, patch) {
    this.transact(() => {
      for (const id of ids) {
        const rec = this[kind].get(id)
        if (!rec) continue
        const merged = patch ? { ...rec.overrides, ...patch } : {}
        for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k]
        this.update(kind, id, { overrides: Object.keys(merged).length ? merged : undefined })
      }
    })
  }

  undo() {
    if (this.meta.get('viewOnly')) throw new Error('This map is read-only')
    this.undoManager.undo()
  }

  redo() {
    if (this.meta.get('viewOnly')) throw new Error('This map is read-only')
    this.undoManager.redo()
  }
}
