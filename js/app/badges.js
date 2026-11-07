import { isCluster } from '../../cy/clusterview.js'

const NOTE_PATH = new Path2D(
  'M14.5 3a.5.5 0 0 1 .5.5v9a.5.5 0 0 1-.5.5h-13a.5.5 0 0 1-.5-.5v-9a.5.5 0 0 1 .5-.5h13zm-13-1A1.5 1.5 0 0 0 0 3.5v9A1.5 1.5 0 0 0 1.5 14h13a1.5 1.5 0 0 0 1.5-1.5v-9A1.5 1.5 0 0 0 14.5 2h-13zM3 5.5a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9a.5.5 0 0 1-.5-.5zM3 8a.5.5 0 0 1 .5-.5h9a.5.5 0 0 1 0 1h-9A.5.5 0 0 1 3 8zm0 2.5a.5.5 0 0 1 .5-.5h6a.5.5 0 0 1 0 1h-6a.5.5 0 0 1-.5-.5z'
)
const PIN_PATH = new Path2D(
  'M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A6 6 0 0 1 5 6.708V2.277a3 3 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354'
)
const THUMB_UP_OUTLINE = new Path2D(
  'M8.864.046C7.908-.193 7.02.53 6.956 1.466c-.072 1.051-.23 2.016-.428 2.59-.125.36-.479 1.013-1.04 1.639-.557.623-1.282 1.178-2.131 1.41C2.685 7.288 2 7.87 2 8.72v4.001c0 .845.682 1.464 1.448 1.545 1.07.114 1.564.415 2.068.723l.048.03c.272.165.578.348.97.484.397.136.861.217 1.466.217h3.5c.937 0 1.599-.477 1.934-1.064a1.86 1.86 0 0 0 .254-.912c0-.152-.023-.312-.077-.464.201-.263.38-.578.488-.901.11-.33.172-.762.004-1.149.069-.13.12-.269.159-.403.077-.27.113-.568.113-.857 0-.288-.036-.585-.113-.856a2.144 2.144 0 0 0-.138-.362 1.9 1.9 0 0 0 .234-1.734c-.206-.592-.682-1.1-1.2-1.272-.847-.282-1.803-.276-2.516-.211a9.84 9.84 0 0 0-.443.05 9.365 9.365 0 0 0-.062-4.509A1.38 1.38 0 0 0 9.125.111L8.864.046zM11.5 14.721H8c-.51 0-.863-.069-1.14-.164-.281-.097-.506-.228-.776-.393l-.04-.024c-.555-.339-1.198-.731-2.49-.868-.333-.036-.554-.29-.554-.55V8.72c0-.254.226-.543.62-.65 1.095-.3 1.977-.996 2.614-1.708.635-.71 1.064-1.475 1.238-1.978.243-.7.407-1.768.482-2.85.025-.362.36-.594.667-.518l.262.066c.16.04.258.143.288.255a8.34 8.34 0 0 1-.145 4.725.5.5 0 0 0 .595.644l.003-.001.014-.003.058-.014a8.908 8.908 0 0 1 1.036-.157c.663-.06 1.457-.054 2.11.164.175.058.45.3.57.65.107.308.087.67-.266 1.022l-.353.353.353.354c.043.043.105.141.154.315.048.167.075.37.075.581 0 .212-.027.414-.075.582-.05.174-.111.272-.154.315l-.353.353.353.354c.047.047.109.177.005.488a2.224 2.224 0 0 1-.505.805l-.353.353.353.354c.006.005.041.05.041.17a.866.866 0 0 1-.121.416c-.165.288-.503.56-1.066.56z'
)
const THUMB_UP_FILLED = new Path2D(
  'M6.956 1.745C7.021.81 7.908.087 8.864.325l.261.066c.463.116.874.456 1.012.965.22.816.533 2.511.062 4.51a9.84 9.84 0 0 1 .443-.051c.713-.065 1.669-.072 2.516.21.518.173.994.681 1.2 1.273.184.532.16 1.162-.234 1.733.058.119.103.242.138.363.077.27.113.567.113.856 0 .289-.036.586-.113.856-.039.135-.09.273-.16.404.169.387.107.819-.003 1.148a3.163 3.163 0 0 1-.488.901c.054.152.076.312.076.465 0 .305-.089.625-.253.912C13.1 15.522 12.437 16 11.5 16H8c-.605 0-1.07-.081-1.466-.218a4.82 4.82 0 0 1-.97-.484l-.048-.03c-.504-.307-.999-.609-2.068-.722C2.682 14.464 2 13.846 2 13V9c0-.85.685-1.432 1.357-1.615.849-.232 1.574-.787 2.132-1.41.56-.627.914-1.28 1.039-1.639.199-.575.356-1.539.428-2.59z'
)
const THUMB_DOWN_OUTLINE = new Path2D(
  'M8.864 15.674c-.956.24-1.843-.484-1.908-1.42-.072-1.05-.23-2.015-.428-2.59-.125-.36-.479-1.012-1.04-1.638-.557-.624-1.282-1.179-2.131-1.41C2.685 8.432 2 7.85 2 7V3c0-.845.682-1.464 1.448-1.546 1.07-.113 1.564-.415 2.068-.723l.048-.029c.272-.166.578-.349.97-.484C6.931.08 7.395 0 8 0h3.5c.937 0 1.599.478 1.934 1.064.164.287.254.607.254.913 0 .152-.023.312-.077.464.201.262.38.577.488.9.11.33.172.762.004 1.15.069.13.12.268.159.403.077.27.113.567.113.856 0 .289-.036.586-.113.856-.035.12-.08.244-.138.363.394.571.418 1.2.234 1.733-.206.592-.682 1.1-1.2 1.272-.847.283-1.803.276-2.516.211a9.877 9.877 0 0 1-.443-.05 9.364 9.364 0 0 1-.062 4.51c-.138.508-.55.848-1.012.964l-.261.065zM11.5 1H8c-.51 0-.863.068-1.14.163-.281.097-.506.229-.776.393l-.04.025c-.555.338-1.198.73-2.49.868-.333.035-.554.29-.554.55V7c0 .255.226.543.62.65 1.095.3 1.977.997 2.614 1.709.635.71 1.064 1.475 1.238 1.977.243.7.407 1.768.482 2.85.025.362.36.595.667.518l.262-.065c.16-.04.258-.144.288-.255a8.34 8.34 0 0 0-.145-4.726.5.5 0 0 1 .595-.643h.003l.014.004.058.013a8.912 8.912 0 0 0 1.036.157c.663.06 1.457.054 2.11-.163.175-.059.45-.301.57-.651.107-.308.087-.67-.266-1.021L12.793 7l.353-.354c.043-.042.105-.14.154-.315.048-.167.075-.37.075-.581 0-.211-.027-.414-.075-.581-.05-.174-.111-.273-.154-.315l-.353-.354.353-.354c.047-.047.109-.176.005-.488a2.224 2.224 0 0 0-.505-.804l-.353-.354.353-.354c.006-.005.041-.05.041-.17a.866.866 0 0 0-.121-.415C12.4 1.272 12.063 1 11.5 1z'
)
const THUMB_DOWN_FILLED = new Path2D(
  'M6.956 14.534c.065.936.952 1.659 1.908 1.42l.261-.065a1.378 1.378 0 0 0 1.012-.965c.22-.816.533-2.512.062-4.51.136.02.285.037.443.051.713.065 1.669.071 2.516-.211.518-.173.994-.68 1.2-1.272a1.896 1.896 0 0 0-.234-1.734c.058-.118.103-.242.138-.362.077-.27.113-.568.113-.856 0-.29-.036-.586-.113-.857a2.094 2.094 0 0 0-.16-.403c.169-.387.107-.82-.003-1.149a3.162 3.162 0 0 0-.488-.9c.054-.153.076-.313.076-.465a1.86 1.86 0 0 0-.253-.912C13.1.757 12.437.28 11.5.28H8c-.605 0-1.07.08-1.466.217a4.823 4.823 0 0 0-.97.485l-.048.029c-.504.308-.999.61-2.068.723C2.682 1.815 2 2.434 2 3.279v4c0 .851.685 1.433 1.357 1.616.849.232 1.574.787 2.132 1.41.56.626.914 1.28 1.039 1.638.199.575.356 1.54.428 2.591z'
)

const ICON_SIZE = 16
const THUMB_ROW_HEIGHT = 20
const SIDES = ['thumbUp', 'thumbDown']

/**
 * Whether a note has any text in it
 * @param {object|string|undefined} note a Quill delta, or plain text
 * @returns {boolean}
 */
export function hasNote(note) {
  if (!note || note === 'Notes') return false
  if (typeof note === 'string') return note.trim() !== ''
  return (note.ops ?? []).some((op) => typeof op.insert !== 'string' || op.insert.trim() !== '')
}

/**
 * Small icons around factors and links: a pin for factors that cannot be moved, a note card
 * for those with Notes, and thumbs up and down (with counts) when reactions are switched on.
 * They are drawn on a canvas laid over the map, so they follow pan and zoom, and a click
 * on a thumb is a vote.
 */
export class Badges {
  /**
   * @param {object} app
   * @param {import('../../cy/store.js').MapStore} app.store
   * @param {cytoscape.Core} app.cy
   * @param {number} app.clientId identifies this user in the lists of voters
   */
  constructor({ store, cy, clientId }) {
    this.store = store
    this.cy = cy
    this.clientId = clientId
    this.canvas = document.createElement('canvas')
    this.canvas.className = 'badge-layer'
    cy.container().append(this.canvas)
    this.pending = false
    cy.on('render viewport data position add remove', () => this.requestDraw())
    cy.on('tap', (evt) => this.vote(evt.position))
    store.doc.on('afterTransaction', (tr) => tr.changed.has(store.meta) && this.requestDraw())
  }

  /** @returns {object} the shared settings */
  get settings() {
    return this.store.meta.get('settings') ?? {}
  }

  requestDraw() {
    if (this.pending) return
    this.pending = true
    queueMicrotask(() => {
      this.pending = false
      this.draw()
    })
  }

  /** Redraw every badge */
  draw() {
    const { cy, canvas } = this
    const ratio = window.devicePixelRatio || 1
    const width = cy.width()
    const height = cy.height()
    if (
      canvas.width !== Math.round(width * ratio) ||
      canvas.height !== Math.round(height * ratio)
    ) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    const ctx = canvas.getContext('2d')
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    const zoom = cy.zoom() * ratio
    ctx.setTransform(zoom, 0, 0, zoom, cy.pan().x * ratio, cy.pan().y * ratio)
    ctx.fillStyle = 'black'
    ctx.font = '12px Oxygen, sans-serif'
    const showNotes = this.settings.showNotes ?? true
    cy.nodes()
      .filter((n) => n.visible() && !n.isParent())
      .forEach((n) => this.drawNodeBadges(ctx, n, showNotes))
    if (showNotes) {
      cy.edges()
        .filter((e) => e.visible() && hasNote(e.data('note')))
        .forEach((e) => {
          const { x, y } = e.midpoint()
          this.icon(ctx, NOTE_PATH, x - ICON_SIZE / 2, y - ICON_SIZE / 2)
        })
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {cytoscape.NodeSingular} node
   * @param {boolean} showNotes
   */
  drawNodeBadges(ctx, node, showNotes) {
    const box = node.boundingBox({ includeLabels: false, includeOverlays: false })
    if (node.data('locked')) this.icon(ctx, PIN_PATH, box.x1 - 10, box.y1)
    if (showNotes && hasNote(node.data('note'))) this.icon(ctx, NOTE_PATH, box.x2, box.y1)
    if (this.settings.voting && !isCluster(node)) this.drawThumbs(ctx, node, box)
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {cytoscape.NodeSingular} node
   * @param {{x1:number,x2:number,y2:number}} box
   */
  drawThumbs(ctx, node, box) {
    const up = node.data('thumbUp') ?? []
    const down = node.data('thumbDown') ?? []
    const upPath = up.includes(this.clientId) ? THUMB_UP_FILLED : THUMB_UP_OUTLINE
    const downPath = down.includes(this.clientId) ? THUMB_DOWN_FILLED : THUMB_DOWN_OUTLINE
    this.icon(ctx, upPath, box.x1 + 20, box.y2)
    if (up.length) ctx.fillText(String(up.length), box.x1 + 36, box.y2 + 10)
    this.icon(ctx, downPath, box.x2 - 36, box.y2)
    if (down.length) ctx.fillText(String(down.length), box.x2 - 20, box.y2 + 10)
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   * @param {Path2D} path
   * @param {number} x left, in map coordinates
   * @param {number} y top
   */
  icon(ctx, path, x, y) {
    ctx.save()
    ctx.translate(x, y)
    ctx.fill(path)
    ctx.restore()
  }

  /**
   * A click just below a factor, on its left half or its right half, is a vote up or down
   * @param {{x:number,y:number}} pos where the click was, in map coordinates
   */
  vote(pos) {
    if (this.store.meta.get('viewOnly')) return
    if (!this.settings.voting) return
    const hit = this.cy
      .nodes()
      .filter((n) => n.visible() && !n.isParent() && !isCluster(n))
      .filter((n) => this.isInThumbRow(n.boundingBox({ includeLabels: false }), pos))
    if (hit.empty()) return
    const node = hit[0]
    const box = node.boundingBox({ includeLabels: false })
    this.toggleVote(node, pos.x < (box.x1 + box.x2) / 2 ? SIDES[0] : SIDES[1])
  }

  /**
   * @param {{x1:number,x2:number,y2:number}} box
   * @param {{x:number,y:number}} pos
   * @returns {boolean}
   */
  isInThumbRow(box, pos) {
    return pos.x > box.x1 && pos.x < box.x2 && pos.y > box.y2 && pos.y < box.y2 + THUMB_ROW_HEIGHT
  }

  /**
   * Add this user's vote, or remove it if they have already voted that way
   * @param {cytoscape.NodeSingular} node
   * @param {'thumbUp'|'thumbDown'} side
   */
  toggleVote(node, side) {
    const voters = node.data(side) ?? []
    const updated = voters.includes(this.clientId)
      ? voters.filter((id) => id !== this.clientId)
      : [...voters, this.clientId]
    this.store.update('nodes', node.id(), { [side]: updated.length ? updated : undefined })
  }
}
