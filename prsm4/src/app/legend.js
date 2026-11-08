/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Displays the map style legend.
********************************************************************************************/

import { alertMsg, dragElement, elem, listen } from '../../../js/utils.js'
import { compileStylesheet } from '../graph/graph.js'

/** A draggable legend containing the named factor and link styles. */
export class Legend {
  /**
   * Connect the draggable legend to shared map styles.
   * @param {object} options Legend dependencies.
   * @param {import('../graph/store.js').MapStore} options.store Shared map.
   * @param {import('./palette.js').Palette} options.palette Style preview renderer.
   */
  constructor({ store, palette }) {
    this.store = store
    this.palette = palette
    this.graphs = []
    this.box = document.createElement('section')
    this.box.className = 'legend'
    this.box.hidden = true
    this.box.setAttribute('aria-label', 'Legend')
    const title = document.createElement('div')
    title.className = 'legendTitle dragHandle'
    title.textContent = 'Legend'
    this.body = document.createElement('div')
    this.body.className = 'legendWrapper'
    this.box.append(title, this.body)
    elem('main').append(this.box)
    dragElement(this.box, title)
    listen('showLegendSwitch', 'change', (e) => {
      if (e.target.checked && !this.namedStyles().length) {
        e.target.checked = false
        alertMsg('Nothing to include in the legend - rename some styles first', 'warn')
      }
      store.setSetting('legend', e.target.checked)
    })
    store.doc.on('afterTransaction', (tr) => {
      if (tr.changed.has(store.styles) || tr.changed.has(store.meta)) this.render()
    })
    this.render()
  }

  /**
   * Find named standard factor and link styles for the legend.
   * @returns {Array<[string, object]>} Style identifiers and records.
   */
  namedStyles() {
    return [...this.store.styles.entries()].filter(
      ([id, style]) => /^(group|edge)\d+$/.test(id) && style.name && style.name !== 'Sample'
    )
  }

  /**
   * Rebuild the legend previews from the current shared styles.
   * @returns {void}
   */
  render() {
    const show = Boolean(this.store.meta.get('settings')?.legend)
    elem('showLegendSwitch').checked = show
    this.box.hidden = !show
    for (const graph of this.graphs) graph.destroy()
    this.graphs = []
    this.body.replaceChildren()
    if (!show) return
    const sheet = compileStylesheet(Object.fromEntries(this.store.styles.entries()))
    for (const [id, style] of this.namedStyles()) {
      const sample = document.createElement('div')
      sample.className = 'legendCanvas'
      const label = document.createElement('div')
      label.className = 'legendStyleName'
      label.textContent = style.name
      this.body.append(sample, label)
      const graph = this.palette.miniGraph(sample, style.kind, id)
      graph.style(sheet)
      if (style.kind === 'node') {
        const node = graph.nodes()
        node.data('label', node.numericStyle('background-opacity') === 0 ? 'T' : '')
        node.style({ width: 18, height: 18, padding: 0 })
      }
      this.palette.redraw(graph, style.kind)
      this.graphs.push(graph)
    }
  }
}
