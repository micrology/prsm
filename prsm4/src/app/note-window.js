/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Edits selected map notes in a larger window.
********************************************************************************************/

import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import '../../css/note4.css'

const editor = new Quill('#note-editor', {
  theme: 'snow',
  placeholder: 'Notes',
  modules: {
    toolbar: [
      [{ font: [] }, { size: [] }, { header: [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike', { color: [] }, { background: [] }],
      [{ list: 'ordered' }, { list: 'bullet' }, { indent: '-1' }, { indent: '+1' }],
      [{ align: [] }, 'blockquote', 'link', 'image', 'clean'],
    ],
  },
})
editor.enable(false)
let sequence = 0
let acknowledged = 0
window.addEventListener('message', (event) => {
  if (event.origin !== location.origin || event.source !== window.opener) return
  if (event.data?.type !== 'prsm4-note-state') return
  if (Number.isSafeInteger(event.data.sequence)) {
    acknowledged = Math.max(acknowledged, event.data.sequence)
    if (event.data.sequence < sequence) return
  } else if (acknowledged < sequence) {
    return
  }
  document.getElementById('note-title').textContent = event.data.label
  document.title = `Notes: ${event.data.label}`
  editor.enable(!event.data.readOnly)
  editor.getModule('toolbar').container.hidden = event.data.readOnly
  if (JSON.stringify(editor.getContents().ops) !== JSON.stringify(event.data.note.ops)) {
    editor.setContents(event.data.note, 'silent')
  }
})
editor.on('text-change', (_delta, _old, source) => {
  if (source === 'user' && window.opener) {
    window.opener.postMessage(
      {
        type: 'prsm4-note-edit',
        note: { ops: editor.getContents().ops },
        sequence: ++sequence,
      },
      location.origin
    )
  }
})
if (window.opener) window.opener.postMessage({ type: 'prsm4-note-ready' }, location.origin)
else document.getElementById('note-title').textContent = 'Open notes from a PRSM map.'
