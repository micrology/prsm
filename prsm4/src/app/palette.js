/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Displays and selects factor and link styles.
********************************************************************************************/

import cytoscape from 'cytoscape'
import { compileStylesheet } from '../graph/graph.js'
import { elem, listen } from '../../../js/utils.js'

const SAMPLE_COUNT = 15
const SAMPLE_LABEL = 'Sample'
const SAMPLE_PADDING = 4
const LINK_LENGTH = 44
const LINK_END_STYLE = {
  width: 4,
  height: 4,
  padding: 0,
  shape: 'ellipse',
  label: '',
  'background-color': '#555',
  'border-width': 0,
}

const KINDS = {
  node: { prefix: 'group', sampleId: 'nodeSample', selectAll: 'allFactors', table: 'nodes' },
  edge: { prefix: 'edge', sampleId: 'linkSample', selectAll: 'allLinks', table: 'edges' },
}

/**
 * The 15 factor styles and 15 link styles shown in the Factors and Links tabs of the side panel.
 * Each swatch is a very small Cytoscape graph using the map's own stylesheet, so it always
 * looks exactly like the elements it stands for.
 */
export class Palette {
  /**
   * Connect the style swatches to the shared map and graph selection.
   * @param {object} app
   * @param {import('../graph/store.js').MapStore} app.store
   * @param {cytoscape.Core} app.cy
   * @param {function(string):void} app.onEditStyle called with a style id when its swatch is double-clicked
   */
  constructor({ store, cy, onEditStyle }) {
    this.store = store
    this.cy = cy
    this.onEditStyle = onEditStyle
    this.last = { node: 'group0', edge: 'edge0' }
    this.swatches = []
    this.createContextMenu()
    for (const kind of Object.keys(KINDS)) this.createSwatches(kind)
    for (const [kind, k] of Object.entries(KINDS)) {
      listen(k.selectAll, 'click', () => this.selectAll(kind))
    }
    store.doc.on('afterTransaction', (tr) => this.onChange(tr))
    cy.on('select unselect', () => this.markUsed())
    this.refresh()
  }

  /**
   * Get the most recently chosen style for a kind of element.
   * @param {'node'|'edge'} kind
   * @returns {string} the style last chosen, which new factors or links are given
   */
  lastStyle(kind) {
    return this.last[kind]
  }

  /**
   * Create the factor or link style swatches.
   * @param {'node'|'edge'} kind
   * @returns {void}
   */
  createSwatches(kind) {
    const { prefix, sampleId } = KINDS[kind]
    for (let i = 0; i < SAMPLE_COUNT; i++) {
      const div = elem(`${sampleId}${i + 1}`)
      const styleId = `${prefix}${i}`
      const graph = this.miniGraph(div, kind, styleId)
      div.addEventListener('click', (e) => e.detail === 1 && this.apply(kind, styleId))
      div.addEventListener('dblclick', () => this.onEditStyle(styleId))
      if (kind === 'node') {
        div.tabIndex = 0
        div.setAttribute('role', 'button')
        div.setAttribute('aria-label', `Factor style ${i + 1}`)
        div.addEventListener('contextmenu', (event) => this.openContextMenu(event, styleId))
        div.addEventListener('keydown', (event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            this.apply(kind, styleId)
          }
        })
      }
      this.swatches.push({ kind, styleId, div, graph })
      new ResizeObserver(() => this.redraw(graph, kind)).observe(div)
    }
  }

  /**
   * Create the factor style action menu.
   * @returns {void}
   */
  createContextMenu() {
    this.menu = document.createElement('div')
    this.menu.className = 'palette-context-menu'
    this.menu.setAttribute('popover', 'auto')
    this.menu.setAttribute('aria-label', 'Factor style actions')
    const select = document.createElement('button')
    select.type = 'button'
    select.textContent = 'Select factors'
    select.addEventListener('click', () => {
      const nodes = this.styleNodes()
      this.cy.batch(() => {
        this.cy.elements(':selected').unselect()
        nodes.not('.clusterHidden, :parent').select()
      })
      this.menu.hidePopover()
    })
    this.hideButton = document.createElement('button')
    this.hideButton.type = 'button'
    this.hideButton.addEventListener('click', () => {
      const ids = this.styleNodes().map((node) => node.id())
      const hidden = this.hideButton.dataset.show !== 'true'
      this.store.transact(() => {
        for (const id of ids) this.store.update('nodes', id, { hidden: hidden || undefined })
      })
      this.menu.hidePopover()
    })
    this.menu.append(select, this.hideButton)
    document.body.append(this.menu)
  }

  /**
   * Return factors using the context menu's style.
   * @returns {cytoscape.NodeCollection} Matching factors.
   */
  styleNodes() {
    return this.cy
      .nodes()
      .filter((node) => this.store.nodes.get(node.id())?.style === this.menuStyle)
  }

  /**
   * Open style actions at the pointer or focused swatch.
   * @param {MouseEvent} event Context-menu event.
   * @param {string} styleId Style identifier.
   * @returns {void}
   */
  openContextMenu(event, styleId) {
    event.preventDefault()
    this.menuStyle = styleId
    const nodes = this.styleNodes()
    const show = nodes.nonempty() && nodes.every((node) => node.data('hidden'))
    this.hideButton.textContent = show ? 'Show factors' : 'Hide factors'
    this.hideButton.dataset.show = String(show)
    this.hideButton.disabled = Boolean(this.store.meta.get('viewOnly'))
    if (this.menu.matches(':popover-open')) this.menu.hidePopover()
    this.menu.showPopover()
    const rect = this.menu.getBoundingClientRect()
    const anchor = event.currentTarget.getBoundingClientRect()
    const x = event.clientX || anchor.left
    const y = event.clientY || anchor.bottom
    this.menu.style.left = `${Math.max(0, Math.min(x, innerWidth - rect.width))}px`
    this.menu.style.top = `${Math.max(0, Math.min(y, innerHeight - rect.height))}px`
    this.menu.querySelector('button').focus()
  }

  /**
   * Create a small graph for a style preview.
   * @param {HTMLElement} container
   * @param {'node'|'edge'} kind
   * @param {string} styleId
   * @returns {cytoscape.Core} a graph showing one factor, or two factors and a link
   */
  miniGraph(container, kind, styleId) {
    const elements =
      kind === 'node'
        ? [{ data: { id: 'n', label: SAMPLE_LABEL }, classes: styleId }]
        : [
            { data: { id: 'a' }, position: { x: 0, y: 0 }, classes: 'sampleEnd' },
            { data: { id: 'b' }, position: { x: LINK_LENGTH, y: 0 }, classes: 'sampleEnd' },
            { data: { id: 'e', source: 'a', target: 'b', label: '' }, classes: styleId },
          ]
    return cytoscape({
      container,
      elements,
      layout: { name: 'preset' },
      userZoomingEnabled: false,
      userPanningEnabled: false,
      boxSelectionEnabled: false,
      autoungrabify: true,
      autounselectify: true,
    })
  }

  /**
   * Refresh previews when shared styles change.
   * @param {import('yjs').Transaction} tr Completed transaction.
   * @returns {void}
   */
  onChange(tr) {
    if (tr.changed.has(this.store.styles)) this.refresh()
  }

  /**
   * Redraw all the swatches from the current styles.
   * @returns {void}
   */
  refresh() {
    const sheet = compileStylesheet(Object.fromEntries(this.store.styles.entries()))
    sheet.push({ selector: '.sampleEnd', style: LINK_END_STYLE })
    for (const { kind, styleId, graph } of this.swatches) {
      graph.style(sheet)
      if (kind === 'node') graph.getElementById('n').data('label', this.sampleLabel(styleId))
      this.redraw(graph, kind)
    }
    this.markUsed()
  }

  /**
   * Re-measure a swatch (its tab may only just have become visible) and fit it
   * @param {cytoscape.Core} graph
   * @param {'node'|'edge'} kind
   * @returns {void}
   */
  redraw(graph, kind) {
    graph.resize()
    this.fitSample(graph, kind)
  }

  /**
   * A factor is scaled to fit its swatch; a link is shown at full size so that it stays visible
   * @param {cytoscape.Core} graph
   * @param {'node'|'edge'} kind
   * @returns {cytoscape.Core|void} The fitted graph for a factor preview.
   */
  fitSample(graph, kind) {
    if (kind === 'node') return graph.fit(undefined, SAMPLE_PADDING)
    graph.nodes().style(LINK_END_STYLE)
    const edge = graph.edges()[0]
    edge.removeStyle()
    edge.style({ width: Math.max(2, edge.numericStyle('width') * 2), 'arrow-scale': 1.5 })
    graph.zoom(1)
    graph.center()
  }

  /**
   * Get the label for a factor style preview.
   * @param {string} styleId
   * @returns {string} the name the user gave the style, or a generic label
   */
  sampleLabel(styleId) {
    return this.store.styles.get(styleId)?.name || SAMPLE_LABEL
  }

  /**
   * Outline the swatches of the styles used by the selected factors and links, or else the last one chosen
   * @returns {void}
   */
  markUsed() {
    const used = { node: new Set(), edge: new Set() }
    this.cy.elements(':selected').forEach((ele) => {
      const style = ele.data('cluster')
        ? null
        : ele.classes().find((c) => /^(group|edge)\d+$/.test(c))
      if (style) used[ele.isNode() ? 'node' : 'edge'].add(style)
    })
    for (const { kind, styleId, div } of this.swatches) {
      const on = used[kind].size > 0 ? used[kind].has(styleId) : this.last[kind] === styleId
      div.classList.toggle('sampleSelected', on)
    }
  }

  /**
   * Give the selected factors (or links) a style, and make it the one for new ones
   * @param {'node'|'edge'} kind
   * @param {string} styleId
   * @returns {void}
   */
  apply(kind, styleId) {
    this.last[kind] = styleId
    const selected = this.cy[kind === 'node' ? 'nodes' : 'edges'](':selected').filter(
      (ele) => !ele.data('cluster')
    )
    if (selected.nonempty()) {
      this.store.setElementStyle(
        KINDS[kind].table,
        selected.map((e) => e.id()),
        styleId,
        true
      )
    }
    this.markUsed()
  }

  /**
   * Select all visible factors or links.
   * @param {'node'|'edge'} kind
   * @returns {void}
   */
  selectAll(kind) {
    const all = this.cy[kind === 'node' ? 'nodes' : 'edges']().not('.hidden, .clusterHidden')
    this.cy.batch(() => {
      this.cy.elements(':selected').unselect()
      all.not(':parent').select()
    })
  }
}
