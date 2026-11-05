/* ****************************************************************************************
cluster.js: clustering of factors. A cluster is an ordinary node record in the store, with
  cluster: { collapsed: boolean }
and each factor in it has  inCluster: <cluster id>.
All clusters are created, changed and dissolved by writing these fields, so they are shared
between users and undoable. How they look (a single node when collapsed, a box around the
members when expanded, and the summary links between collapsed clusters and other factors)
is worked out by clusterview.js and is never stored.
**************************************************************************************** */

import { jLouvain } from './louvain.js'

const MIN_CLUSTER_SIZE = 2
export const CLUSTER_STYLE = 'clusterNode'

/**
 * @param {MapStore} store
 * @param {object} rec node record
 * @returns {object} the Cytoscape style properties that apply to the node, from base, style and overrides
 */
export function nodeCss(store, rec) {
  return {
    ...store.styles.get('nodeBase')?.css,
    ...store.styles.get(rec.style)?.css,
    ...rec.overrides,
  }
}

/**
 * Make colours that differ only in spacing or case compare equal
 * @param {string} color any CSS colour
 * @returns {string}
 */
function normalizeColor(color) {
  return String(color ?? '')
    .replace(/\s+/g, '')
    .toLowerCase()
}

/**
 * A colour that is the same for the same text each time
 * @param {string} text
 * @returns {string} an HSL colour
 */
function colorFromText(text) {
  let h = 0
  for (const ch of String(text)) h = (h * 31 + ch.codePointAt(0)) % 360
  return `hsl(${h}, 55%, 70%)`
}

/**
 * @param {MapStore} store
 * @returns {Array<[string, object]>} the factors that are not clusters
 */
function plainNodes(store) {
  return [...store.nodes.entries()].filter(([, rec]) => !rec.cluster)
}

/**
 * Group the factors by a key
 * @param {MapStore} store
 * @param {function(object): {key: string, label: string, color: string}|null} describe
 * @returns {Map<string, {label: string, color: string, members: Array<string>}>}
 */
function groupBy(store, describe) {
  const groups = new Map()
  for (const [id, rec] of plainNodes(store)) {
    const d = describe(rec)
    if (!d) continue
    if (!groups.has(d.key)) groups.set(d.key, { label: d.label, color: d.color, members: [] })
    groups.get(d.key).members.push(id)
  }
  return groups
}

const DESCRIBERS = {
  style: (store) => (rec) => ({
    key: rec.style,
    label: `${store.styles.get(rec.style)?.name || rec.style} cluster`,
    color: nodeCss(store, { style: rec.style })['background-color'],
  }),
  color: (store) => (rec) => {
    const color = nodeCss(store, rec)['background-color']
    return { key: normalizeColor(color), label: '', color }
  },
}

/**
 * @param {MapStore} store
 * @param {string} mode 'style', 'color', or the name of an attribute such as 'att1'
 * @returns {function(object): object|null}
 */
function describer(store, mode) {
  if (DESCRIBERS[mode]) return DESCRIBERS[mode](store)
  const title = store.meta.get('attributeTitles')?.[mode] ?? mode
  return (rec) => {
    if (!rec[mode]) return null
    return {
      key: String(rec[mode]),
      label: `${title} ${rec[mode]}`,
      color: colorFromText(rec[mode]),
    }
  }
}

/**
 * Dissolve all clusters: delete the cluster nodes and free their members
 * @param {MapStore} store
 */
function releaseAll(store) {
  for (const [id, rec] of [...store.nodes.entries()]) {
    if (rec.cluster) {
      store.nodes.delete(id)
    } else if (rec.inCluster) {
      const { inCluster, ...rest } = rec
      store.nodes.set(id, rest)
    }
  }
}

/**
 * Add a collapsed cluster node holding the given members, placed at their centroid
 * @param {MapStore} store
 * @param {string} id
 * @param {{label: string, color: string, members: Array<string>}} group
 */
function addCluster(store, id, group) {
  let x = 0
  let y = 0
  for (const m of group.members) {
    const rec = store.nodes.get(m)
    x += rec.x
    y += rec.y
    store.nodes.set(m, { ...rec, inCluster: id })
  }
  const now = Date.now()
  store.nodes.set(id, {
    label: group.label,
    style: CLUSTER_STYLE,
    cluster: { collapsed: true },
    x: x / group.members.length,
    y: y / group.members.length,
    created: now,
    modified: now,
    overrides: { 'background-color': group.color },
  })
}

/**
 * Cluster the factors, replacing any existing clustering
 * @param {MapStore} store
 * @param {string} mode 'none', 'style', 'color', or an attribute name; or 'groups' with options.groups
 * @param {object} [options]
 * @param {Map<string, {label: string, color: string, members: Array<string>}>} [options.groups]
 *   groups computed elsewhere (e.g. by community detection), used when mode is 'groups'
 * @returns {number} the number of clusters made
 */
export function clusterBy(store, mode, options = {}) {
  let made = 0
  store.transact(() => {
    releaseAll(store)
    if (mode === 'none') return
    const groups = mode === 'groups' ? options.groups : groupBy(store, describer(store, mode))
    let n = 0
    for (const [key, group] of groups) {
      if (group.members.length < MIN_CLUSTER_SIZE) continue
      n++
      addCluster(store, `cluster-${options.name ?? mode}-${key}`, {
        ...group,
        label: group.label || `Cluster ${n}`,
      })
      made++
    }
    store.meta.set('settings', {
      ...store.meta.get('settings'),
      cluster: options.name ?? mode,
    })
  })
  return made
}

/**
 * Find the most common value
 * @param {Array<string>} values
 * @returns {string|undefined}
 */
function mostFrequent(values) {
  const counts = new Map()
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
}

/**
 * Cluster the factors into communities found by the Louvain method
 * @param {MapStore} store
 * @returns {number} the number of clusters made, or -1 if the map has no links to analyse
 */
export function clusterByLouvain(store) {
  const ids = plainNodes(store).map(([id]) => id)
  const edges = [...store.edges.values()]
    .filter((e) => store.nodes.has(e.source) && store.nodes.has(e.target))
    .map((e) => ({ source: e.source, target: e.target, weight: 1 }))
  if (edges.length === 0) return -1
  const partition = jLouvain(ids, edges)
  const groups = new Map()
  for (const id of ids) {
    const key = partition[id]
    if (key === undefined) continue
    if (!groups.has(key)) groups.set(key, { label: `Cluster ${Number(key) + 1}`, members: [] })
    groups.get(key).members.push(id)
  }
  for (const g of groups.values()) {
    g.color = mostFrequent(
      g.members.map((m) => nodeCss(store, store.nodes.get(m))['background-color'])
    )
  }
  return clusterBy(store, 'groups', { groups, name: 'louvain' })
}

/**
 * Show or hide the members of a cluster
 * @param {MapStore} store
 * @param {string} id cluster node id
 * @param {boolean} collapsed
 */
export function setCollapsed(store, id, collapsed) {
  const rec = store.nodes.get(id)
  if (!rec?.cluster) return
  store.transact(() => store.nodes.set(id, { ...rec, cluster: { ...rec.cluster, collapsed } }))
}

/**
 * Remove one cluster, leaving its members as ordinary factors
 * @param {MapStore} store
 * @param {string} id cluster node id
 */
export function dissolveCluster(store, id) {
  store.transact(() => {
    for (const [mid, rec] of store.nodes.entries()) {
      if (rec.inCluster !== id) continue
      const { inCluster, ...rest } = rec
      store.nodes.set(mid, rest)
    }
    store.nodes.delete(id)
  })
}
