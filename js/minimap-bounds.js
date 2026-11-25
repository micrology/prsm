/*********************************************************************************************
 * Minimap overview bounds helpers (pure, no DOM).
 *
 * Used by prsm.js to decide when a moved factor has left the canvas area last shown
 * on the minimap overview, so the snapshot can be rebuilt only when needed.
 ********************************************************************************************/

/**
 * Canvas-space rectangle covered by a fitted overview view.
 *
 * @param {object} opts
 * @param {number} opts.scale - view scale of the fitted overview (> 0)
 * @param {{x: number, y: number}} opts.position - view centre in canvas coords
 * @param {number} opts.width - overview pane width in CSS pixels
 * @param {number} opts.height - overview pane height in CSS pixels
 * @returns {{left: number, right: number, top: number, bottom: number}|null}
 */
export function computeOverviewCanvasBounds({ scale, position, width, height }) {
  if (!Number.isFinite(scale) || scale <= 0) return null
  if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null
  }
  const halfW = width / (2 * scale)
  const halfH = height / (2 * scale)
  return {
    left: position.x - halfW,
    right: position.x + halfW,
    top: position.y - halfH,
    bottom: position.y + halfH,
  }
}

/**
 * Axis-aligned box in canvas space (node bounding box or point as degenerate box).
 * @typedef {{left: number, right: number, top: number, bottom: number}} CanvasBox
 */

/**
 * @param {CanvasBox} box
 * @param {CanvasBox} bounds
 * @returns {boolean} true if any part of box lies strictly outside bounds
 */
export function isBoxOutsideBounds(box, bounds) {
  if (!box || !bounds) return false
  return (
    box.left < bounds.left ||
    box.right > bounds.right ||
    box.top < bounds.top ||
    box.bottom > bounds.bottom
  )
}

/**
 * Build a canvas box from a node record and optional bounding box.
 * Prefers getBoundingBox when it returns a usable box; otherwise uses x/y as a point.
 *
 * @param {object} node - factor with optional x, y
 * @param {CanvasBox|null|undefined} boundingBox - from network.getBoundingBox
 * @returns {CanvasBox|null}
 */
export function nodeToCanvasBox(node, boundingBox) {
  if (
    boundingBox &&
    Number.isFinite(boundingBox.left) &&
    Number.isFinite(boundingBox.right) &&
    Number.isFinite(boundingBox.top) &&
    Number.isFinite(boundingBox.bottom)
  ) {
    return {
      left: boundingBox.left,
      right: boundingBox.right,
      top: boundingBox.top,
      bottom: boundingBox.bottom,
    }
  }
  if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return null
  return { left: node.x, right: node.x, top: node.y, bottom: node.y }
}

/**
 * Whether any of the given nodes lies outside the last minimap overview bounds.
 * Pure decision helper — callers perform the actual snapshot refresh.
 *
 * @param {object} opts
 * @param {CanvasBox|null|undefined} opts.bounds - last overviewBounds
 * @param {Array<{id: string|number, x?: number, y?: number}>} opts.nodes - moved factors
 * @param {function(string|number): (CanvasBox|null|undefined)} [opts.getBoundingBox]
 * @returns {boolean} true if a minimap image refresh is required
 */
export function shouldRefreshMinimapForMovedNodes({ bounds, nodes, getBoundingBox }) {
  if (!bounds || !nodes || nodes.length === 0) return false
  for (const node of nodes) {
    let boundingBox
    if (typeof getBoundingBox === 'function') {
      try {
        boundingBox = getBoundingBox(node.id)
      } catch {
        boundingBox = undefined
      }
    }
    const box = nodeToCanvasBox(node, boundingBox)
    if (box && isBoxOutsideBounds(box, bounds)) return true
  }
  return false
}
