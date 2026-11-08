import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { handlers } = require('../../../utils/jsdoc-prsm4.cjs')

test('JSDoc conversion changes comments without changing executable code', () => {
  const event = {
    source: `
/** @param {import('../graph/store.js').MapStore} store
 * @param {{enabled?:boolean}} options
 * @returns {Array<[string, object]>}
 */
const importName = "import('../graph/store.js').MapStore"
`,
  }
  handlers.beforeParse(event)
  assert.match(event.source, /@param \{MapStore\} store/)
  assert.match(event.source, /enabled: \(boolean\|undefined\)/)
  assert.match(event.source, /Array<Array<\(string\|object\)>>/)
  assert.match(event.source, /const importName = "import\('\.\.\/graph\/store\.js'\)\.MapStore"/)
})
