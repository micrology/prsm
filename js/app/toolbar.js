import { elem, listen } from '../utils.js'

/**
 * Connects the buttons of the navigation bar to the editor and store.
 */
export class Toolbar {
  /**
   * @param {object} app
   * @param {import('../../cy/store.js').MapStore} app.store
   * @param {import('../../cy/editing.js').Editor} app.editor
   * @param {cytoscape.Core} app.cy
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
   */
  showMode(mode) {
    for (const id of ['addNode', 'addLink']) {
      elem(id)
        .children.item(0)
        .classList.toggle('pressed', id === mode)
    }
  }

  /**
   * @param {'addNode'|'addLink'} mode
   */
  toggleMode(mode) {
    this.editor.setMode(this.editor.mode === mode ? 'select' : mode)
  }

  showUndoState() {
    const { undoStack, redoStack } = this.store.undoManager
    elem('undo').classList.toggle('disabled', undoStack.length === 0)
    elem('redo').classList.toggle('disabled', redoStack.length === 0)
  }

  showDeleteState() {
    elem('deleteNode').classList.toggle('disabled', this.cy.elements(':selected').empty())
  }
}
