import cytoscape from 'cytoscape'

export const IMAGE_SIZE = 8192
const VIEW_SIZE = 512
const MARGIN = 16
const MAX_ZOOM = 5

/**
 * Calculate the view centred on the selected factors, or the whole visible graph.
 * @param {cytoscape.Core} cy graph to export
 * @returns {{zoom: number, pan: {x: number, y: number}}} export viewport
 */
export function imageViewport(cy) {
  const selected = cy.nodes(':selected:visible')
  const elements = selected.nonempty() ? selected : cy.elements(':visible')
  if (elements.empty()) throw new Error('There are no visible factors or links to export')
  const bounds = elements.boundingBox()
  if (![bounds.x1, bounds.y1, bounds.w, bounds.h].every(Number.isFinite)) {
    throw new Error('The map has invalid dimensions')
  }
  const extent = Math.max(bounds.w, bounds.h, 1)
  const zoom = Math.min(MAX_ZOOM, (VIEW_SIZE - 2 * MARGIN) / extent)
  return {
    zoom,
    pan: {
      x: VIEW_SIZE / 2 - (bounds.x1 + bounds.w / 2) * zoom,
      y: VIEW_SIZE / 2 - (bounds.y1 + bounds.h / 2) * zoom,
    },
  }
}

/**
 * Render the current graph to an 8192 by 8192 PNG without changing the map.
 * @param {cytoscape.Core} cy graph to export
 * @param {string} background CSS background colour
 * @returns {Promise<Blob>} rendered PNG
 */
export async function exportImage(cy, background) {
  await document.fonts.load('14px Oxygen')
  const viewport = imageViewport(cy)
  const container = document.createElement('div')
  container.className = 'image-export-graph'
  document.body.append(container)
  let graph
  try {
    graph = cytoscape({
      container,
      elements: cy
        .elements()
        .jsons()
        .map((element) => ({ ...element, selected: false })),
      style: cy.style().json(),
      layout: { name: 'preset', fit: false },
      minZoom: 0.000001,
      maxZoom: MAX_ZOOM,
      pixelRatio: 1,
    })
    graph.batch(() => {
      cy.elements().forEach((element) => {
        const copy = graph.getElementById(element.id())
        const style = Object.fromEntries(
          Object.entries(element.style()).filter(([name]) => !/[A-Z]/.test(name))
        )
        style['min-zoomed-font-size'] = 0
        if (element.selected()) style['underlay-opacity'] = 0
        copy.style(style)
      })
    })
    graph.viewport(viewport)
    const blob = await graph.png({
      full: false,
      maxWidth: IMAGE_SIZE,
      maxHeight: IMAGE_SIZE,
      bg: background,
      output: 'blob-promise',
    })
    if (!blob || blob.size === 0) throw new Error('The browser could not create the PNG')
    const header = new DataView(await blob.slice(0, 24).arrayBuffer())
    if (
      header.byteLength < 24 ||
      header.getUint32(0) !== 0x89504e47 ||
      header.getUint32(16) !== IMAGE_SIZE ||
      header.getUint32(20) !== IMAGE_SIZE
    ) {
      throw new Error('The browser could not render the image at 8192 × 8192 pixels')
    }
    return blob
  } finally {
    graph?.destroy()
    container.remove()
  }
}
