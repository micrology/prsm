/* ****************************************************************************************
noteeditor.js: a dialog with a Quill editor for the (whole) note of a factor or link.
**************************************************************************************** */
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

const TOOLBAR = [
  'bold',
  'italic',
  'underline',
  'link',
  { list: 'ordered' },
  { list: 'bullet' },
  { indent: '-1' },
  { indent: '+1' },
]

/**
 * @param {object|string|undefined} note existing note, a Quill delta or plain text
 * @returns {Promise<object|null|undefined>} the new note as a delta, null if the user emptied it,
 *   undefined if the user cancelled
 */
export function editNote(note) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'note-dialog'
    const holder = document.createElement('div')
    const buttons = document.createElement('form')
    buttons.method = 'dialog'
    buttons.innerHTML = '<button value="cancel">Cancel</button> <button value="ok">Save</button>'
    dialog.append(holder, buttons)
    document.body.append(dialog)
    const editor = new Quill(holder, {
      modules: { toolbar: TOOLBAR },
      placeholder: 'Notes',
      theme: 'snow',
    })
    if (note instanceof Object) editor.setContents(note)
    else editor.setText(note ?? '')
    dialog.addEventListener('close', () => {
      const empty = editor.getText().trim() === '' && editor.getLength() <= 1
      const result =
        dialog.returnValue === 'ok' ? (empty ? null : { ops: editor.getContents().ops }) : undefined
      dialog.remove()
      resolve(result)
    })
    dialog.showModal()
    editor.focus()
  })
}
