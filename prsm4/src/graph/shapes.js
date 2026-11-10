/*********************************************************************************************

PRSM Participatory System Mapper

Copyright (c) [2022] Nigel Gilbert email: prsm@prsm.uk
This software is licenced under the PolyForm Noncommercial License 1.0.0
<https://polyformproject.org/licenses/noncommercial/1.0.0>
See the file LICENSE.md for details.

Translates factor shapes between stored and displayed representations.
********************************************************************************************/

/**
 * Replace the former database shape with a circular disc.
 * @param {object|undefined} css Factor style properties.
 * @returns {object|undefined} Normalized properties.
 */
export function normalizeShape(css) {
  if (!css || !['barrel', 'database'].includes(css.shape)) return css
  const size = (Number(css['font-size']) || 14) + 40
  return {
    ...css,
    shape: 'ellipse',
    width: size,
    height: size,
    padding: 0,
    'text-valign': 'bottom',
    'text-margin-y': 5,
  }
}

/**
 * Normalize old database shapes in a map snapshot without changing its input.
 * @param {object} file Map snapshot.
 * @returns {object} Snapshot with compatible factor styles and overrides.
 */
export function normalizeMapShapes(file) {
  return {
    ...file,
    styles: Object.fromEntries(
      Object.entries(file.styles).map(([id, style]) => [
        id,
        style.kind === 'node' ? { ...style, css: normalizeShape(style.css) } : style,
      ])
    ),
    nodes: file.nodes.map((node) =>
      node.overrides ? { ...node, overrides: normalizeShape(node.overrides) } : node
    ),
  }
}

/**
 * Translate Cytoscape properties to a shape-menu name.
 * @param {object} css Resolved factor style.
 * @returns {string} Shape name.
 */
export function shapeName(css) {
  const shape = css.shape
  if (shape === 'round-rectangle') return 'box'
  if (shape === 'barrel' || shape === 'database') return 'disc'
  if (shape === 'ellipse' && css['text-valign'] === 'bottom') return 'disc'
  if (shape === 'rectangle') return css['background-opacity'] === 0 ? 'text' : 'square'
  return shape ?? 'ellipse'
}
