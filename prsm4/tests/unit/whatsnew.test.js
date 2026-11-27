import { test } from 'node:test'
import assert from 'node:assert/strict'
import { shouldShowWhatsNew, showWhatsNew } from '../../src/app/whatsnew.js'

/** Create a localStorage-like store for release-note tests. */
function storage(initial = {}) {
  const values = new Map(Object.entries(initial))
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('release notes appear only for returning users and newer major or minor versions', () => {
  assert.equal(shouldShowWhatsNew('4.0.1', storage()), false)
  assert.equal(shouldShowWhatsNew('4.0.1', storage({ doneIntro: 'false' })), true)
  const returning = (seen) => storage({ doneIntro: 'done', prsm4SeenWhatsNew: seen })
  for (const [current, seen, expected] of [
    ['4.0.1', '4.0.0', false],
    ['4.0.1', '4.0.1', false],
    ['4.0.1', '4.0.2', false],
    ['4.10.0', '4.9.9', true],
    ['4.1.0', '4.2.0', false],
    ['3.99.0', '4.0.0', false],
    ['5.0.0', '4.99.9', true],
    ['4.0.0', '4.0.0-rc.2', false],
    ['4.0.0-rc.10', '4.0.0-rc.2', false],
    ['4.0.0-rc.2', '4.0.0', false],
    ['4.0.0+build.2', '4.0.0+build.1', false],
  ]) {
    assert.equal(shouldShowWhatsNew(current, returning(seen)), expected, `${current} vs ${seen}`)
  }
  assert.throws(() => shouldShowWhatsNew('not-semver', returning('4.0.0')), /Invalid PRSM version/)
})

test('release notes are recorded only after a successful display', async (t) => {
  const globals = ['document', 'localStorage', 'fetch']
  const originals = new Map(
    globals.map((name) => [name, Object.getOwnPropertyDescriptor(globalThis, name)])
  )
  t.after(() => {
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor)
      else delete globalThis[name]
    }
  })
  const state = storage({ doneIntro: 'done' })
  const handlers = {}
  const dialog = {
    showModal() {
      this.open = true
    },
    close() {
      this.open = false
    },
    addEventListener(type, handler) {
      handlers[type] = handler
    },
    getBoundingClientRect: () => ({ left: 10, right: 110, top: 10, bottom: 110 }),
  }
  const elements = { whatsnew: dialog, whatsnewversion: {}, whatsnewlist: {} }
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { getElementById: (id) => elements[id] },
  })
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: state })
  globalThis.fetch = async () => ({ ok: false, status: 503 })
  await assert.rejects(showWhatsNew('4.0.1'), /503/)
  assert.equal(state.getItem('prsm4SeenWhatsNew'), null)

  globalThis.fetch = async () => ({ ok: true, text: async () => '<li>Changes</li>' })
  await showWhatsNew('4.0.1')
  assert.equal(dialog.open, true)
  assert.equal(elements.whatsnewversion.textContent, 'Version 4.0.1')
  assert.equal(elements.whatsnewlist.innerHTML, '<li>Changes</li>')
  assert.equal(state.getItem('prsm4SeenWhatsNew'), '4.0.1')
  handlers.pointerdown({ clientX: 20, clientY: 20 })
  handlers.pointerup({ clientX: 5, clientY: 5 })
  assert.equal(dialog.open, true)
  handlers.pointerdown({ clientX: 5, clientY: 5 })
  handlers.pointerup({ clientX: 5, clientY: 5 })
  assert.equal(dialog.open, false)
  globalThis.fetch = () => {
    throw new Error('Already-seen notes should not be fetched')
  }
  await showWhatsNew('4.0.1')
})
