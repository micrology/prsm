/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Determines the shapes of links between factors.
********************************************************************************************/

/* ****************************************************************************************
curves.js: edge curves for Cytoscape that reproduce the old vis-network ones.

Two kinds of curve existed in the old app:

 1. The map-wide setting ("Curved" / "Straight"): vis-network's cubicBezier with roundness 0.5 / 0.
    An S-shaped cubic Bezier whose two control points sit level with the end points, at fractions
    r and 1-r of the way along the longer axis.
 2. Edges dragged by the user (curvedSymmetricCW / CCW): a quadratic Bezier whose control point is
    perpendicular to the mid-point of the edge, at a distance of roundness * length / 2.

Cytoscape's unbundled-bezier places control points relative to the source->target line (a weight along
the line and a perpendicular distance, positive = clockwise on screen), and draws a chain of quadratic
segments through them.  The second kind therefore maps exactly; the first is approximated by two control
points (see measureDeviation()).
**************************************************************************************** */

const MIN_LENGTH = 1

// Fitted by least-squares against vis-network's cubicBezier (roundness 0.5), for an edge whose longer
// axis is horizontal and which slopes by angle theta (0..45 degrees, every 5 degrees).  The two control
// points are point-symmetric about the mid-point of the edge, so one weight and one distance describe both.
const FIT_DISTANCE = [
  0, -0.0253, -0.0534, -0.0781, -0.0971, -0.1069, -0.1205, -0.131, -0.134, -0.1364,
]
const FIT_STEP_DEG = 5
const FIT_ROUNDNESS = 0.5

/**
 * Estimate a control-point weight for the legacy curve approximation.
 * @param {number} thetaDeg Angle in degrees.
 * @returns {number} Control-point weight.
 */
function fitWeight(thetaDeg) {
  return 0.34 - 0.004 * thetaDeg
}

/**
 * Interpolate a control-point distance for the legacy curve approximation.
 * @param {number} thetaDeg Angle in degrees.
 * @returns {number} Distance as a fraction of edge length.
 */
function fitDistance(thetaDeg) {
  const x = Math.min(thetaDeg, 45) / FIT_STEP_DEG
  const i = Math.min(Math.floor(x), FIT_DISTANCE.length - 2)
  return FIT_DISTANCE[i] + (x - i) * (FIT_DISTANCE[i + 1] - FIT_DISTANCE[i])
}

/**
 * Control points for a map-wide curve
 * @param {{x:number,y:number}} src source node centre
 * @param {{x:number,y:number}} tgt target node centre
 * @param {number} r roundness: 0 for 'Straight', anything else is drawn as the standard 'Curved' shape
 * @returns {{distances:number[], weights:number[]}|null} null if the edge should be straight
 */
export function defaultCurvePoints(src, tgt, r) {
  const dx = tgt.x - src.x
  const dy = tgt.y - src.y
  const len = Math.hypot(dx, dy)
  if (!r || len < MIN_LENGTH) return null
  const horizontal = Math.abs(dx) > Math.abs(dy)
  const theta =
    (Math.atan2(
      horizontal ? Math.abs(dy) : Math.abs(dx),
      horizontal ? Math.abs(dx) : Math.abs(dy)
    ) *
      180) /
    Math.PI
  // reflecting the geometry reverses the side of the line the curve bulges to
  const side = (dx * dy < 0 ? -1 : 1) * (horizontal ? 1 : -1)
  const d = side * fitDistance(theta) * len
  const w = fitWeight(theta)
  return { distances: [d, -d], weights: [w, 1 - w] }
}

/**
 * Control point for an edge with its own curve {side, roundness}
 * @param {{x:number,y:number}} src
 * @param {{x:number,y:number}} tgt
 * @param {{side:number, roundness:number}} curve side: 1 = clockwise
 * @returns {{distances:number[], weights:number[]}|null}
 */
export function symmetricCurvePoints(src, tgt, curve) {
  const len = Math.hypot(tgt.x - src.x, tgt.y - src.y)
  if (len < MIN_LENGTH || !curve.roundness) return null
  return { distances: [curve.side * curve.roundness * len * 0.5], weights: [0.5] }
}

const CLEARANCE = 6

/**
 * Find the distance from a node's centre to its rectangular boundary.
 * @param {{hw:number,hh:number}} half half the width and height of a node
 * @param {number} dx direction from the node centre
 * @param {number} dy
 * @returns {number} distance from the centre of the node to its edge, in that direction
 */
function reach({ hw, hh }, dx, dy) {
  const len = Math.hypot(dx, dy)
  const tx = dx === 0 ? Infinity : hw / Math.abs(dx / len)
  const ty = dy === 0 ? Infinity : hh / Math.abs(dy / len)
  return Math.min(tx, ty)
}

/**
 * Cytoscape cannot find where an edge leaves a node if the first control point is inside the node, and
 * then the edge is not drawn. So move the control points out of the nodes, or draw a straight line if
 * the nodes are too close for that.
 * @param {{distances:number[], weights:number[]}} pts
 * @param {{x:number,y:number}} src
 * @param {{x:number,y:number}} tgt
 * @param {{src:{hw:number,hh:number}, tgt:{hw:number,hh:number}}} sizes
 * @returns {{distances:number[], weights:number[]}|null}
 */
export function clearOfNodes(pts, src, tgt, sizes) {
  const dx = tgt.x - src.x
  const dy = tgt.y - src.y
  const len = Math.hypot(dx, dy)
  const near = (reach(sizes.src, dx, dy) + CLEARANCE) / len
  const far = 1 - (reach(sizes.tgt, dx, dy) + CLEARANCE) / len
  if (near >= far) return null
  const last = pts.weights.length - 1
  const weights = pts.weights.map((w, i) => {
    if (i === 0) return Math.max(w, near)
    return i === last ? Math.min(w, far) : w
  })
  return { distances: pts.distances, weights }
}

/**
 * The Cytoscape style properties that draw an edge between src and tgt
 * @param {{x:number,y:number}} src
 * @param {{x:number,y:number}} tgt
 * @param {{side:number, roundness:number}|undefined} curve the edge's own curve, if it has one
 * @param {number} mapRoundness 0.5 or 0 from the map-wide setting
 * @param {{src:{hw:number,hh:number}, tgt:{hw:number,hh:number}}} [sizes] node half sizes, to keep the curve out of the nodes
 * @returns {object}
 */
export function edgeCurveStyle(src, tgt, curve, mapRoundness, sizes) {
  const raw = curve
    ? symmetricCurvePoints(src, tgt, curve)
    : defaultCurvePoints(src, tgt, mapRoundness)
  const pts = raw && sizes ? clearOfNodes(raw, src, tgt, sizes) : raw
  if (!pts) return { 'curve-style': 'straight' }
  return {
    'curve-style': 'unbundled-bezier',
    'edge-distances': 'node-position',
    'control-point-distances': pts.distances,
    'control-point-weights': pts.weights,
  }
}

/* ------------------------------------------------------------------ measurement (used by the conversion report) */

/**
 * Evaluate a cubic Bezier curve at a parameter value.
 * @param {{x:number,y:number}} p0 Start point.
 * @param {{x:number,y:number}} p1 First control point.
 * @param {{x:number,y:number}} p2 Second control point.
 * @param {{x:number,y:number}} p3 End point.
 * @param {number} t Curve parameter.
 * @returns {{x:number,y:number}} Point on the curve.
 */
function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

/**
 * Evaluate a quadratic Bezier curve at a parameter value.
 * @param {{x:number,y:number}} p0 Start point.
 * @param {{x:number,y:number}} p1 Control point.
 * @param {{x:number,y:number}} p2 End point.
 * @param {number} t Curve parameter.
 * @returns {{x:number,y:number}} Point on the curve.
 */
function quadPoint(p0, p1, p2, t) {
  const u = 1 - t
  return {
    x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
    y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
  }
}

/**
 * Compute the control points of the legacy cubic Bezier curve.
 * @param {{x:number,y:number}} src Source position.
 * @param {{x:number,y:number}} tgt Target position.
 * @param {number} r Curve roundness.
 * @returns {Array<object>} Two control points.
 */
function visVia(src, tgt, r) {
  const dx = src.x - tgt.x
  const dy = src.y - tgt.y
  if (Math.abs(dx) > Math.abs(dy)) {
    return [
      { x: src.x - r * dx, y: src.y },
      { x: tgt.x + r * dx, y: tgt.y },
    ]
  }
  return [
    { x: src.x, y: src.y - r * dy },
    { x: tgt.x, y: tgt.y + r * dy },
  ]
}

/**
 * Largest distance between the old cubic curve and the Cytoscape two-control-point approximation,
 * as a fraction of the edge length.
 * @param {{x:number,y:number}} src Source position.
 * @param {{x:number,y:number}} tgt Target position.
 * @param {number} [r] Curve roundness.
 * @returns {number}
 */
export function measureDeviation(src, tgt, r = FIT_ROUNDNESS) {
  const pts = defaultCurvePoints(src, tgt, r)
  if (!pts) return 0
  const dx = tgt.x - src.x
  const dy = tgt.y - src.y
  const len = Math.hypot(dx, dy)
  const nx = -dy / len
  const ny = dx / len
  const ctrl = pts.weights.map((w, i) => ({
    x: src.x + w * dx + nx * pts.distances[i],
    y: src.y + w * dy + ny * pts.distances[i],
  }))
  const mid = { x: (ctrl[0].x + ctrl[1].x) / 2, y: (ctrl[0].y + ctrl[1].y) / 2 }
  const [v1, v2] = visVia(src, tgt, r)
  const approx = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    approx.push(quadPoint(src, ctrl[0], mid, t), quadPoint(mid, ctrl[1], tgt, t))
  }
  let worst = 0
  for (let i = 0; i <= 40; i++) {
    const c = cubicPoint(src, v1, v2, tgt, i / 40)
    let best = Infinity
    for (const a of approx) best = Math.min(best, Math.hypot(a.x - c.x, a.y - c.y))
    worst = Math.max(worst, best)
  }
  return worst / len
}
