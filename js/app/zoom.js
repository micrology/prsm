import { elem, listen } from '../utils.js'

const ZOOM_STEP = 1.2

/**
 * The zoom slider and +/- buttons in the footer, kept in step with the graph.
 * @param {cytoscape.Core} cy
 */
export function bindZoomControl(cy) {
  const slider = elem('zoom')
  const zoomTo = (level) => cy.zoom({ level, renderedPosition: centre(cy) })
  listen('zoom', 'input', () => zoomTo(Math.max(Number(slider.value), cy.minZoom())))
  listen('zoomminus', 'click', () => zoomTo(cy.zoom() / ZOOM_STEP))
  listen('zoomplus', 'click', () => zoomTo(cy.zoom() * ZOOM_STEP))
  cy.on('zoom', () => {
    slider.value = cy.zoom()
  })
}

/**
 * @param {cytoscape.Core} cy
 * @returns {{x: number, y: number}} the middle of the visible graph, in screen pixels
 */
function centre(cy) {
  return { x: cy.width() / 2, y: cy.height() / 2 }
}

/**
 * Fit the whole map into the window
 * @param {cytoscape.Core} cy
 */
export function fitMap(cy) {
  if (cy.elements().nonempty()) cy.fit(undefined, 30)
}
