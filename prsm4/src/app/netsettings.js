/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Provides settings for the map and its appearance.
********************************************************************************************/

import { alertMsg, elem, listen, statusMsg } from '../../../js/utils.js'
import { layoutPositions, LAYOUTS } from './layouts.js'

const GRID_SPACING = 50
const DEFAULT_BACKGROUND = '#ffffff'

/**
 * The Network tab: layout, snap to grid, link curves and background colour.
 * Settings live in the map's shared `settings`, so every user sees the same ones.
 */
export class NetworkSettings {
  /**
   * Connect network settings to the shared map and graph.
   * @param {object} app Settings dependencies.
   * @param {import('../graph/store.js').MapStore} app.store Map store.
   * @param {cytoscape.Core} app.cy Displayed graph.
   * @param {import('../../../js/utils.js').CP} app.colorPicker Shared colour picker.
   */
  constructor({ store, cy, colorPicker }) {
    this.store = store
    this.cy = cy
    this.fillLayoutMenu()
    listen('layoutSelect', 'change', (e) => this.runLayout(e.target.value))
    listen('curveSelect', 'change', (e) => store.setSetting('curve', e.target.value))
    listen('snaptogridswitch', 'change', (e) => this.setSnap(e.target.checked))
    listen('showNotesSwitch', 'change', (e) => store.setSetting('showNotes', e.target.checked))
    listen('showVotingSwitch', 'change', (e) => store.setSetting('voting', e.target.checked))
    colorPicker.createColorPicker('netBackColorWell', (color) =>
      store.setSetting('background', color)
    )
    // dragging a factor on to the grid
    cy.on('dragfree', 'node', (evt) => this.snapDragged(evt.target))
    store.doc.on('afterTransaction', (tr) => tr.changed.has(store.meta) && this.showSettings())
    this.showSettings()
  }

  /**
   * Populate the layout menu with available layouts.
   * @returns {void}
   */
  fillLayoutMenu() {
    elem('layoutSelect').replaceChildren(
      ...Object.entries(LAYOUTS).map(([value, text]) => new Option(text, value))
    )
  }

  /**
   * Bring the controls and map background into line with the shared settings.
   * @returns {void}
   */
  showSettings() {
    const settings = this.store.meta.get('settings') ?? {}
    elem('curveSelect').value = settings.curve ?? 'Curved'
    elem('snaptogridswitch').checked = Boolean(settings.snapToGrid)
    elem('showNotesSwitch').checked = settings.showNotes ?? true
    elem('showVotingSwitch').checked = Boolean(settings.voting)
    const background = settings.background ?? DEFAULT_BACKGROUND
    elem('netBackColorWell').style.backgroundColor = background
    elem('net-pane').style.setProperty('--map-background', background)
  }

  /**
   * Enable or disable grid snapping, aligning existing factors when enabled.
   * @param {boolean} on Whether snapping is enabled.
   * @returns {void}
   */
  setSnap(on) {
    this.store.setSetting('snapToGrid', on)
    if (on) this.store.moveNodes(this.snapped(this.cy.nodes().not(':parent')))
  }

  /**
   * Compute the nearest grid position for each factor.
   * @param {cytoscape.NodeCollection} nodes
   * @returns {Object<string,{x:number,y:number}>} positions of the nodes moved to the nearest grid points
   */
  snapped(nodes) {
    const positions = {}
    nodes.forEach((n) => {
      const { x, y } = n.position()
      positions[n.id()] = {
        x: GRID_SPACING * Math.round(x / GRID_SPACING),
        y: GRID_SPACING * Math.round(y / GRID_SPACING),
      }
    })
    return positions
  }

  /**
   * Snap a dragged factor or selection to the grid when snapping is enabled.
   * @param {cytoscape.NodeSingular} node a factor that has just been dropped
   * @returns {void}
   */
  snapDragged(node) {
    if (!this.store.meta.get('settings')?.snapToGrid) return
    const moved = node.selected() ? this.cy.nodes(':selected') : node
    const positions = this.snapped(moved.not(':parent'))
    for (const [id, pos] of Object.entries(positions)) this.cy.getElementById(id).position(pos)
  }

  /**
   * Apply a layout to the visible factors.
   * @param {string} name a key of LAYOUTS
   * @returns {Promise<void>} Resolves after applying the layout or reporting an error.
   */
  async runLayout(name) {
    elem('layoutSelect').value = 'off'
    if (name === 'off') return
    statusMsg('Working...')
    try {
      const positions = await layoutPositions(name, this.cy)
      this.store.moveNodes(positions)
      this.cy.fit(undefined, 30)
      statusMsg(`${LAYOUTS[name]} layout applied`)
    } catch (e) {
      statusMsg('')
      alertMsg(`${LAYOUTS[name]} layout: ${e.message}`, 'error')
    }
  }
}
