import { test } from 'node:test'
import assert from 'node:assert/strict'

globalThis.window = {}
const { helpServiceOrigin, requestHelp } = await import('../../src/app/aiasst.js')

test('help requests use the local stack proxy without changing other deployments', () => {
  assert.equal(
    helpServiceOrigin(new URL('http://localhost:4174/prsm4.html?localApi=1')),
    'http://localhost:4174'
  )
  assert.equal(
    helpServiceOrigin(new URL('http://127.0.0.1:6789/prsm4.html?localApi=1')),
    'http://127.0.0.1:6789'
  )
  assert.equal(
    helpServiceOrigin(new URL('http://localhost:1234/prsm4.html')),
    'http://localhost:3001'
  )
  assert.equal(
    helpServiceOrigin(new URL('https://prsm.uk/prsm4.html?localApi=1')),
    'https://prsm.uk'
  )
})

test('help requests send the room and complete conversation', async (t) => {
  const messages = [
    { role: 'user', content: [{ text: 'First question' }] },
    { role: 'assistant', content: [{ text: 'First answer' }] },
    { role: 'user', content: [{ text: 'Follow-up' }] },
  ]
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ response: 'Answer', sources: [{ name: 'Paper', url: 'https://example.com' }] })
  )
  const result = await requestHelp('http://localhost:3001', messages, 'ABC-DEF-GHI-JKL')
  const [url, options] = fetch.mock.calls[0].arguments
  assert.equal(url, 'http://localhost:3001/api/helpAssistant')
  assert.equal(options.method, 'POST')
  assert.equal(options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(options.body), { messages, room: 'ABC-DEF-GHI-JKL' })
  assert.equal(result.response, 'Answer')
  assert.equal(result.sources[0].url, 'https://example.com')
})

test('help requests surface service errors and malformed answers', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ error: 'Service unavailable' }, { status: 503 })
  )
  await assert.rejects(requestHelp('http://localhost:3001', [], 'room'), /Service unavailable/)
  fetch.mock.mockImplementation(async () => Response.json({}, { status: 429 }))
  await assert.rejects(requestHelp('http://localhost:3001', [], 'room'), /HTTP 429/)
  fetch.mock.mockImplementation(async () => Response.json({ response: null }))
  await assert.rejects(requestHelp('http://localhost:3001', [], 'room'), /Invalid response/)
})
