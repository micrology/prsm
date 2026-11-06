import { clusterBy, clusterByLouvain } from '../../cy/cluster.js'
import { applyCurves } from '../../cy/graph.js'
import { computeStats } from '../../cy/stats.js'
import { alertMsg, elem, listen, statusMsg } from '../utils.js'
import { PathSearchLimitError, pathsBetween, reachable } from './analysis-graph.js'

const METRICS = {
  Inputs: 'inDegree',
  Outputs: 'outDegree',
  Leverage: 'leverage',
  Centrality: 'betweenness',
}
const MODES = ['radius', 'stream', 'paths']

/** Analysis filters are local; sizing and clusters are shared map settings. */
export class Analysis {
  constructor({ store, cy }) {
    this.store = store
    this.cy = cy
    this.roots = []
    for (const mode of MODES) {
      for (const radio of document.querySelectorAll(`input[name="${mode}"]`)) {
        radio.addEventListener('change', () => this.choose())
      }
    }
    listen('sizing', 'change', (e) => store.setSetting('sizing', e.target.value))
    listen('clustering', 'change', (e) => this.cluster(e.target.value))
    store.doc.on('afterTransaction', (tr) => this.onChange(tr))
    this.update()
  }

  values() {
    return Object.fromEntries(
      MODES.map((name) => [name, document.querySelector(`input[name="${name}"]:checked`).value])
    )
  }

  choose() {
    const values = this.values()
    if (Object.values(values).every((v) => v === 'All')) {
      this.roots = []
      return this.filter()
    }
    const nodes = this.cy.nodes(':selected').filter((n) => !n.data('cluster'))
    const minimum = values.paths === 'All' ? 1 : 2
    if (nodes.length < minimum) {
      alertMsg(
        minimum === 2
          ? 'Select at least 2 factors to show paths between them'
          : 'A factor needs to be selected',
        'warn'
      )
      for (const name of MODES) {
        document.querySelector(`input[name="${name}"][value="All"]`).checked = true
      }
      this.roots = []
      return this.filter()
    }
    this.roots = nodes.map((n) => n.id())
    this.filter()
  }

  filter() {
    const { cy } = this
    const { radius, stream, paths } = this.values()
    const graph = cy.elements().not('.meta, .hidden, .clusterHidden')
    const roots = cy.collection(this.roots.map((id) => cy.getElementById(id))).intersection(graph)
    if (this.roots.length && roots.empty()) {
      for (const name of MODES) {
        document.querySelector(`input[name="${name}"][value="All"]`).checked = true
      }
      this.roots = []
      statusMsg('Analysis cleared: the selected factors are no longer visible')
    }
    let nodes = graph.nodes()
    let edges = graph.edges()
    if (this.roots.length && roots.nonempty()) {
      const distance = radius === 'All' ? Infinity : Number(radius)
      nodes = reachable(graph, roots, stream, distance)
      edges = edges.filter((e) => nodes.contains(e.source()) && nodes.contains(e.target()))
      if (paths !== 'All') {
        try {
          const result = pathsBetween(nodes.union(edges), roots, paths === 'shortestPath')
          if (result.edges().empty()) {
            alertMsg('No path between the selected factors', 'info')
            elem('pathsAll').checked = true
          } else {
            nodes = result.nodes()
            edges = result.edges()
          }
        } catch (error) {
          if (!(error instanceof PathSearchLimitError)) throw error
          alertMsg(error.message, 'warn')
          elem('pathsAll').checked = true
        }
      }
    }
    cy.batch(() => {
      cy.elements().removeClass('analysisHidden')
      if (this.roots.length && roots.nonempty()) {
        graph.difference(nodes.union(edges)).addClass('analysisHidden')
      }
    })
  }

  cluster(mode) {
    const count = mode === 'louvain' ? clusterByLouvain(this.store) : clusterBy(this.store, mode)
    if (count < 0) {
      alertMsg('There are no links to analyse', 'warn')
      this.showSettings()
      return
    }
    statusMsg(mode === 'none' ? 'Clustering removed' : `${count} clusters created`)
  }

  onChange(tr) {
    if (
      tr.changed.has(this.store.nodes) ||
      tr.changed.has(this.store.edges) ||
      tr.changed.has(this.store.styles) ||
      tr.changed.has(this.store.meta)
    ) {
      this.update()
    }
  }

  update() {
    this.showSettings()
    this.size()
    this.filter()
  }

  showSettings() {
    const settings = this.store.meta.get('settings') ?? {}
    elem('sizing').value = settings.sizing ?? 'Off'
    const menu = elem('clustering')
    const cluster = [...this.store.nodes.values()].find((node) => node.cluster)?.cluster
    const mode = cluster ? (cluster.mode ?? settings.cluster ?? 'none') : 'none'
    for (const option of [...menu.options]) {
      if (!['none', 'style', 'color', 'louvain'].includes(option.value)) option.remove()
    }
    for (const [key, title] of Object.entries(this.store.attributeTitles())) {
      if (title !== '*deleted*') menu.add(new Option(title, key))
    }
    menu.value = mode
    if (menu.selectedIndex < 0) menu.value = 'none'
  }

  size() {
    const mode = this.store.meta.get('settings')?.sizing ?? 'Off'
    const nodes = this.cy.nodes().filter((n) => !n.data('cluster'))
    const stats = METRICS[mode]
      ? computeStats(this.store, { centrality: mode === 'Centrality' })
      : null
    const values = nodes.map((n) => stats?.get(n.id())?.[METRICS[mode]] ?? 0)
    const min = Math.min(...values)
    const max = Math.max(...values)
    this.cy.batch(() =>
      nodes.forEach((node, i) => {
        node.removeStyle('width height')
        const overrides = node.scratch('_ov')
        if (mode === 'Off') {
          if (overrides?.width !== undefined) node.style('width', overrides.width)
          if (overrides?.height !== undefined) node.style('height', overrides.height)
        } else {
          const size =
            mode === 'Equal'
              ? 100
              : 50 + 200 * (max === min ? 0.5 : (values[i] - min) / (max - min))
          node.style({ width: size, height: size })
        }
      })
    )
    applyCurves(this.cy, this.cy.scratch('curveMode'))
  }
}
