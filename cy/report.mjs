// Convert every .prsm file in a directory to v2 and report problems.
// usage: node cy/report.mjs [dir=data]
import fs from 'node:fs'
import path from 'node:path'
import { parseMapText, normaliseLegacy, legacyToV2 } from './legacy.js'
import { measureDeviation } from './curves.js'

const dir = process.argv[2] || 'data'
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.prsm'))
const totals = {
  files: 0,
  ok: 0,
  parseFail: 0,
  gephi: 0,
  nodes: 0,
  edges: 0,
  overrides: 0,
  curves: 0,
  idRemaps: 0,
  droppedEdges: 0,
  unknownStyles: 0,
}
const unmapped = new Map()
const problems = []
let legacyBytes = 0
let v2Bytes = 0
let worstDev = 0
let sumDev = 0
let nDev = 0
const t0 = performance.now()

for (const f of files) {
  totals.files++
  const text = fs.readFileSync(path.join(dir, f), 'utf8')
  let json
  try {
    json = parseMapText(text)
  } catch (e) {
    totals.parseFail++
    problems.push(`${f}: cannot parse (${e.message.slice(0, 60)})`)
    continue
  }
  const original = JSON.stringify({ nodes: json.nodes, edges: json.edges })
  legacyBytes += original.length
  const { file, report } = legacyToV2(normaliseLegacy(json))
  if (!file) {
    totals.gephi++
    continue
  }
  totals.ok++
  totals.nodes += file.nodes.length
  totals.edges += file.edges.length
  totals.overrides += report.overrides
  totals.curves += report.curves
  totals.idRemaps += report.idRemaps
  totals.droppedEdges += report.droppedEdges
  totals.unknownStyles += report.unknownStyles
  v2Bytes += JSON.stringify({ nodes: file.nodes, edges: file.edges }).length
  report.unmapped.forEach((u) => unmapped.set(u, (unmapped.get(u) || 0) + 1))

  // integrity checks
  const ids = new Set(file.nodes.map((n) => n.id))
  const all = new Set(ids)
  let dangling = 0
  for (const e of file.edges) {
    if (!ids.has(e.source) || !ids.has(e.target)) dangling++
    if (all.has(e.id)) problems.push(`${f}: duplicate id ${e.id}`)
    all.add(e.id)
  }
  if (ids.size !== file.nodes.length) problems.push(`${f}: duplicate node ids`)
  if (dangling) problems.push(`${f}: ${dangling} edges refer to missing nodes`)
  for (const n of file.nodes) {
    if (!file.styles[n.style]) problems.push(`${f}: node style ${n.style} undefined`)
  }

  // curve fidelity on this map's real geometry (sample up to 2000 edges)
  const pos = new Map(file.nodes.map((n) => [n.id, n]))
  for (const e of file.edges.slice(0, 2000)) {
    const s = pos.get(e.source)
    const t = pos.get(e.target)
    if (!s || !t || e.curve) continue
    const d = measureDeviation(s, t, 0.5)
    worstDev = Math.max(worstDev, d)
    sumDev += d
    nDev++
  }
}
console.log(totals)
console.log(`conversion time ${(performance.now() - t0).toFixed(0)} ms`)
console.log(
  `nodes+edges JSON: legacy ${(legacyBytes / 1e6).toFixed(1)} MB -> v2 ${(v2Bytes / 1e6).toFixed(1)} MB`
)
console.log(
  `curve approximation: mean deviation ${((sumDev / nDev) * 100).toFixed(2)}% of edge length, worst ${(worstDev * 100).toFixed(2)}%`
)
console.log('unmapped:', Object.fromEntries(unmapped))
console.log(`${problems.length} problems`)
problems.slice(0, 25).forEach((p) => console.log('  ', p))
