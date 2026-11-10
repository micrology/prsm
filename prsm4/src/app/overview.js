/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Displays and edits the shared description of the map.
********************************************************************************************/

import Quill from 'quill'
import { elem, listen } from '../../../js/utils.js'

/** The shared map overview drawer. */
export class Overview {
  /**
   * Connect the map description to its editor.
   * @param {import('../graph/store.js').MapStore} store Shared map.
   */
  constructor(store) {
    this.store = store
    this.editor = new Quill('#drawer-editor', {
      modules: { toolbar: '#sideNotesToolbar' },
      placeholder: 'Notes about the map',
      theme: 'snow',
    })
    elem('drawer').inert = true
    listen('drawer-handle', 'click', () => {
      const wrapper = elem('drawer-wrapper')
      wrapper.classList.toggle('hide-drawer')
      elem('drawer').inert = wrapper.classList.contains('hide-drawer')
      elem('drawer-handle').setAttribute(
        'aria-expanded',
        String(!wrapper.classList.contains('hide-drawer'))
      )
    })
    this.editor.on('text-change', (_delta, _old, source) => {
      if (source !== 'user') return
      const description = this.store.meta.get('description') || {}
      this.store.transact(() =>
        this.store.meta.set('description', {
          ...description,
          text: { ops: this.editor.getContents().ops },
        })
      )
    })
    store.meta.observe((event) => {
      if (event.keysChanged.has('description')) this.refresh()
    })
    this.refresh()
  }

  /**
   * Apply shared map notes without overwriting an unchanged editor.
   * @returns {void}
   */
  refresh() {
    const text = this.store.meta.get('description')?.text
    const contents =
      text && typeof text === 'object' && Array.isArray(text.ops)
        ? text
        : { ops: [{ insert: typeof text === 'string' && text ? `${text}\n` : '\n' }] }
    if (JSON.stringify(this.editor.getContents().ops) !== JSON.stringify(contents.ops)) {
      this.editor.setContents(contents, 'silent')
    }
  }

  /**
   * Allow reading the overview while disabling edits in read-only maps.
   * @param {boolean} readOnly Whether the map is read-only.
   * @returns {void}
   */
  setReadOnly(readOnly) {
    this.editor.enable(!readOnly)
    elem('sideNotesToolbar').hidden = readOnly
  }
}
