/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Coordinates temporary suspension of graph box selection.
********************************************************************************************/

const locks = new WeakMap()

/**
 * Disable box selection until this and any other active suspensions are released.
 * @param {cytoscape.Core} cy Graph to suspend.
 * @returns {function():void} Idempotent release function.
 */
export function suspendBoxSelection(cy) {
  let state = locks.get(cy)
  if (!state) {
    state = { enabled: cy.boxSelectionEnabled(), count: 0 }
    locks.set(cy, state)
    cy.boxSelectionEnabled(false)
  }
  state.count++
  let released = false
  return () => {
    if (released) return
    released = true
    if (--state.count) return
    locks.delete(cy)
    cy.boxSelectionEnabled(state.enabled)
  }
}
