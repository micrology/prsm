/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Manages the current user display name.
********************************************************************************************/

import { generateName } from '../../../js/utils.js'

const STORAGE_KEY = 'myName'
const FORBIDDEN_CHARS = /[&<>*"']/g

/**
 * The record describing the user, kept in local storage so that it survives reloads.
 * @param {number} clientId identifies this browser tab among the room's users
 * @returns {{name: string, anon: boolean, id: number}}
 */
export function loadUser(clientId) {
  let saved = null
  try {
    saved = JSON.parse(localStorage.getItem(STORAGE_KEY))
  } catch {
    saved = null
  }
  const user = saved?.name ? saved : generateName()
  user.id = clientId
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
  return user
}

/**
 * Change the user's name; an empty name gives a generated anonymous one
 * @param {object} user record from loadUser()
 * @param {string} name
 * @returns {object} the updated record
 */
export function renameUser(user, name) {
  const clean = name.replace(FORBIDDEN_CHARS, '')
  const updated = clean ? { ...user, name: clean, anon: false } : { ...generateName(), id: user.id }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  return updated
}
