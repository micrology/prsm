import { alertMsg, dragElement, elem, listen } from '../utils.js'
import { compileStylesheet } from '../../cy/graph.js'

/** A draggable legend containing the named factor and link styles. */
export class Legend {
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

  namedStyles() {
    return [...this.store.styles.entries()].filter(
      ([id, style]) => /^(group|edge)\d+$/.test(id) && style.name && style.name !== 'Sample'
    )
  }

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
