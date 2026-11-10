/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Shows an enlarged view of the graph under the pointer.
********************************************************************************************/

import cytoscape from 'cytoscape'
import { suspendBoxSelection } from '../graph/box-selection.js'

const SIZE = 200
const SCALE = 2

/** A temporary, independent Cytoscape viewport following the pointer. */
export class Magnifier {
  /**
   * Connect the magnifier to the graph and Control key.
   * @param {cytoscape.Core} cy Graph to magnify.
   */
  constructor(cy) {
    this.cy = cy
    this.container = cy.container()
    this.lens = document.createElement('div')
    this.lens.className = 'magnifier4'
    this.lens.hidden = true
    document.body.append(this.lens)
    this.container.addEventListener('pointermove', (event) => this.move(event))
    this.container.addEventListener('pointerleave', () => this.close())
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Control' && !event.shiftKey && !this.releaseBoxSelection) {
          this.releaseBoxSelection = suspendBoxSelection(cy)
        }
      },
      true
    )
    window.addEventListener(
      'keyup',
      (event) => {
        if (event.key === 'Control') {
          this.releaseBoxSelection?.()
          this.releaseBoxSelection = null
          this.close()
        }
      },
      true
    )
    window.addEventListener('blur', () => {
      this.releaseBoxSelection?.()
      this.releaseBoxSelection = null
      this.close()
    })
    cy.on('add remove data position style select unselect', () => (this.dirty = true))
  }

  /**
   * Copy the displayed graph into an independent viewport.
   * @returns {void}
   */
  create() {
    this.graph?.destroy()
    this.lens.hidden = false
    this.graph = cytoscape({
      container: this.lens,
      elements: this.cy.elements().jsons(),
      style: this.cy.style().json(),
      layout: { name: 'preset', fit: false },
      minZoom: 0.0001,
      maxZoom: 100,
      userPanningEnabled: false,
      userZoomingEnabled: false,
    })
    this.graph.batch(() => {
      this.cy.elements().forEach((element) => {
        const copy = this.graph.getElementById(element.id())
        const style = Object.fromEntries(
          Object.entries(element.style()).filter(([name]) => !/[A-Z]/.test(name))
        )
        copy.style(style)
      })
    })
    this.dirty = false
  }

  /**
   * Centre the enlarged viewport on the pointer's map position.
   * @param {PointerEvent} event Pointer movement.
   * @returns {void}
   */
  move(event) {
    if (
      !event.ctrlKey ||
      event.pointerType !== 'mouse' ||
      event.target.closest('.element-editor')
    ) {
      return this.close()
    }
    if (!this.graph || this.dirty) this.create()
    const bounds = this.container.getBoundingClientRect()
    const zoom = this.cy.zoom()
    const pan = this.cy.pan()
    const x = (event.clientX - bounds.left - pan.x) / zoom
    const y = (event.clientY - bounds.top - pan.y) / zoom
    const magnified = zoom * SCALE
    this.lens.style.setProperty('--x', `${event.clientX}px`)
    this.lens.style.setProperty('--y', `${event.clientY}px`)
    this.lens.style.setProperty(
      '--lens-background',
      getComputedStyle(this.container).backgroundColor
    )
    this.graph.viewport({
      zoom: magnified,
      pan: { x: SIZE / 2 - x * magnified, y: SIZE / 2 - y * magnified },
    })
  }

  /**
   * Hide the lens and release its renderer.
   * @returns {void}
   */
  close() {
    this.graph?.destroy()
    this.graph = null
    this.lens.hidden = true
  }
}
