import test from 'node:test'
import assert from 'node:assert/strict'
import cytoscape from 'cytoscape'
import { selectionMessage, shortLabel } from '../../src/app/selection-status.js'

test('selection status names and abbreviates factors and labelled or unlabelled links', () => {
  const cy = cytoscape({
    headless: true,
    elements: [
      { data: { id: 'a', label: 'A very long factor label exceeding twenty-five characters' } },
      { data: { id: 'b', label: 'Second\nfactor' } },
      { data: { id: 'c', label: 'Third' } },
      { data: { id: 'ab', source: 'a', target: 'b', label: 'A labelled link' } },
      { data: { id: 'bc', source: 'b', target: 'c', label: '' } },
    ],
  })
  assert.equal(shortLabel('1234567890123456789012345'), '1234567890123456789012345')
  assert.equal(shortLabel('12345678901234567890123456'), '1234567890123456789012345…')
  assert.equal(selectionMessage(cy.collection()), '')
  assert.equal(
    selectionMessage(cy.elements('#a, #b, #ab, #bc')),
    "Factors: 'A very long factor label …' and 'Second factor' and Link 'A labelled link' and Link from 'Second factor' to 'Third' selected"
  )
  cy.destroy()
})
