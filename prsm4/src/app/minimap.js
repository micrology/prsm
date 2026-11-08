/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Displays an overview of the map and its visible area.
********************************************************************************************/

import { elem } from '../../../js/utils.js'

const WIDTH = 180
const HEIGHT = 120
const PADDING = 8

/** A local, interactive overview of the currently visible graph. */
export class Minimap {
  /**
   * Connect the overview to graph updates and navigation controls.
   * @param {cytoscape.Core} cy Displayed graph.
   */
  constructor(cy) {
    this.cy = cy
    this.button = elem('minimapWrapper')
    this.canvas = elem('minimapCanvas')
    this.pending = false
    cy.on('render viewport resize', () => this.schedule())
    this.button.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return
      this.button.focus({ preventScroll: true })
      this.button.setPointerCapture(event.pointerId)
      this.dragMapping = this.mapping
      this.panTo(event)
    })
    this.button.addEventListener('pointermove', (event) => {
      if (this.button.hasPointerCapture(event.pointerId)) this.panTo(event)
    })
    this.button.addEventListener('keydown', (event) => this.keyPan(event))
    this.button.addEventListener('lostpointercapture', () => {
      this.dragMapping = null
    })
    this.schedule()
  }

  /**
   * Schedule at most one overview redraw for the next frame.
   * @returns {void}
   */
  schedule() {
    if (this.pending) return
    this.pending = true
    requestAnimationFrame(() => {
      this.pending = false
      this.draw()
    })
  }

  /**
   * Draw visible factors, links and the current viewport in the overview.
   * @returns {void}
   */
  draw() {
    const nodes = this.cy.nodes().filter((node) => node.visible())
    if (nodes.empty()) {
      this.button.classList.remove('show')
      return
    }
    const b = nodes.boundingBox({ includeLabels: false })
    const viewport = this.cy.extent()
    const allVisible =
      viewport.x1 <= b.x1 && viewport.y1 <= b.y1 && viewport.x2 >= b.x2 && viewport.y2 >= b.y2
    this.button.classList.toggle('show', !allVisible)
    if (allVisible) return
    const bounds = {
      x1: Math.min(b.x1, viewport.x1),
      y1: Math.min(b.y1, viewport.y1),
      x2: Math.max(b.x2, viewport.x2),
      y2: Math.max(b.y2, viewport.y2),
    }
    const scale = Math.min(
      (WIDTH - 2 * PADDING) / Math.max(1, bounds.x2 - bounds.x1),
      (HEIGHT - 2 * PADDING) / Math.max(1, bounds.y2 - bounds.y1)
    )
    const x = (WIDTH - (bounds.x2 - bounds.x1) * scale) / 2 - bounds.x1 * scale
    const y = (HEIGHT - (bounds.y2 - bounds.y1) * scale) / 2 - bounds.y1 * scale
    this.mapping = { scale, x, y }
    const ratio = window.devicePixelRatio || 1
    this.canvas.width = WIDTH * ratio
    this.canvas.height = HEIGHT * ratio
    const ctx = this.canvas.getContext('2d')
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.clearRect(0, 0, WIDTH, HEIGHT)
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, WIDTH, HEIGHT)
    this.cy
      .edges()
      .filter((edge) => edge.visible())
      .forEach((edge) => {
        const a = edge.source().position()
        const z = edge.target().position()
        ctx.strokeStyle = edge.style('line-color')
        ctx.lineWidth = Math.max(0.7, edge.numericStyle('width') * scale)
        ctx.beginPath()
        ctx.moveTo(x + a.x * scale, y + a.y * scale)
        ctx.lineTo(x + z.x * scale, y + z.y * scale)
        ctx.stroke()
      })
    nodes.forEach((node) => {
      const p = node.position()
      const w = Math.max(2, node.outerWidth() * scale)
      const h = Math.max(2, node.outerHeight() * scale)
      ctx.fillStyle = node.style('background-color')
      ctx.fillRect(x + p.x * scale - w / 2, y + p.y * scale - h / 2, w, h)
    })
    ctx.strokeStyle = '#555'
    ctx.lineWidth = 1
    ctx.strokeRect(
      x + viewport.x1 * scale,
      y + viewport.y1 * scale,
      (viewport.x2 - viewport.x1) * scale,
      (viewport.y2 - viewport.y1) * scale
    )
  }

  /**
   * Centre the map on the point selected in the overview.
   * @param {PointerEvent} event Pointer position in the overview.
   * @returns {void}
   */
  panTo(event) {
    if (!this.mapping) return
    const rect = this.canvas.getBoundingClientRect()
    const px = ((event.clientX - rect.left) * WIDTH) / rect.width
    const py = ((event.clientY - rect.top) * HEIGHT) / rect.height
    const { x, y, scale } = this.dragMapping ?? this.mapping
    const zoom = this.cy.zoom()
    this.cy.pan({
      x: this.cy.width() / 2 - ((px - x) / scale) * zoom,
      y: this.cy.height() / 2 - ((py - y) / scale) * zoom,
    })
  }

  /**
   * Move the viewport in response to an overview arrow key.
   * @param {KeyboardEvent} event Key pressed in the overview.
   * @returns {void}
   */
  keyPan(event) {
    const steps = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }
    if (!steps[event.key]) return
    event.preventDefault()
    const [x, y] = steps[event.key]
    this.cy.panBy({ x: (-x * this.cy.width()) / 4, y: (-y * this.cy.height()) / 4 })
  }
}
