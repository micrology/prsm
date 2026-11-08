/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Provides the map editor toolbar.
********************************************************************************************/

import { elem, listen } from '../../../js/utils.js'

/**
 * Connects the buttons of the navigation bar to the editor and store.
 */
export class Toolbar {
  /**
   * Connect the map toolbar to its editing controls.
   * @param {object} app Toolbar dependencies.
   * @param {import('../graph/store.js').MapStore} app.store Map store.
   * @param {import('../graph/editing.js').Editor} app.editor Graph editor.
   * @param {cytoscape.Core} app.cy Displayed graph.
   * @param {function} [app.onOpenFile] called when the user presses the Open button
   */
  constructor({ store, editor, cy, onOpenFile }) {
    this.store = store
    this.editor = editor
    this.cy = cy
    listen('addNode', 'click', () => this.toggleMode('addNode'))
    listen('addLink', 'click', () => this.toggleMode('addLink'))
    listen('undo', 'click', () => this.store.undo())
    listen('redo', 'click', () => this.store.redo())
    listen('deleteNode', 'click', () => this.editor.deleteSelection())
    if (onOpenFile) listen('openFile', 'click', onOpenFile)
    store.undoManager.on('stack-item-added', () => this.showUndoState())
    store.undoManager.on('stack-item-popped', () => this.showUndoState())
    store.undoManager.on('stack-cleared', () => this.showUndoState())
    cy.on('select unselect remove', () => this.showDeleteState())
    this.showUndoState()
    this.showDeleteState()
  }

  /**
   * Called by the editor when it changes mode, however the change came about
   * @param {string} mode 'select', 'addNode' or 'addLink'
   * @returns {void}
   */
  showMode(mode) {
    for (const id of ['addNode', 'addLink']) {
      elem(id)
        .children.item(0)
        .classList.toggle('pressed', id === mode)
    }
  }

  /**
   * Switch an add mode on or return to selection mode.
   * @param {'addNode'|'addLink'} mode
   * @returns {void}
   */
  toggleMode(mode) {
    this.editor.setMode(this.editor.mode === mode ? 'select' : mode)
  }

  /**
   * Reflect the available undo and redo actions in the toolbar.
   * @returns {void}
   */
  showUndoState() {
    const { undoStack, redoStack } = this.store.undoManager
    elem('undo').classList.toggle('disabled', undoStack.length === 0)
    elem('redo').classList.toggle('disabled', redoStack.length === 0)
  }

  /**
   * Reflect whether the graph has a selection that can be deleted.
   * @returns {void}
   */
  showDeleteState() {
    elem('deleteNode').classList.toggle('disabled', this.cy.elements(':selected').empty())
  }
}
