/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Controls the map viewport and magnification.
********************************************************************************************/

import { elem, listen } from '../../../js/utils.js'

const ZOOM_STEP = 1.2

/**
 * The zoom slider and +/- buttons in the footer, kept in step with the graph.
 * @param {cytoscape.Core} cy
 * @returns {void}
 */
export function bindZoomControl(cy) {
  const slider = elem('zoom')
  /**
   * Zoom around the centre of the viewport.
   * @param {number} level Desired zoom level.
   * @returns {cytoscape.Core} Graph with its viewport updated.
   */
  const zoomTo = (level) => cy.zoom({ level, renderedPosition: centre(cy) })
  listen('zoom', 'input', () => zoomTo(Math.max(Number(slider.value), cy.minZoom())))
  listen('zoomminus', 'click', () => zoomTo(cy.zoom() / ZOOM_STEP))
  listen('zoomplus', 'click', () => zoomTo(cy.zoom() * ZOOM_STEP))
  cy.on('zoom', () => {
    slider.value = cy.zoom()
  })
}

/**
 * Find the centre of the visible graph viewport.
 * @param {cytoscape.Core} cy
 * @returns {{x: number, y: number}} the middle of the visible graph, in screen pixels
 */
function centre(cy) {
  return { x: cy.width() / 2, y: cy.height() / 2 }
}

/**
 * Fit the whole map into the window
 * @param {cytoscape.Core} cy
 * @returns {void}
 */
export function fitMap(cy) {
  if (cy.elements().nonempty()) cy.fit(undefined, 30)
}
