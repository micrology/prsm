/**
 * PRSM dashboard front-end.
 * Fetches /api/stats and renders the three monitoring sections.
 */

const REFRESH_MS = 300000 // 5 minutes

const els = {
  dayLabel: document.getElementById('day-label'),
  updatedAt: document.getElementById('updated-at'),
  refreshBtn: document.getElementById('refresh-btn'),
  statusBanner: document.getElementById('status-banner'),
  serverGrid: document.getElementById('server-grid'),
  serverExtra: document.getElementById('server-extra'),
  websocketGrid: document.getElementById('websocket-grid'),
  websocketExtra: document.getElementById('websocket-extra'),
  apiGrid: document.getElementById('api-grid'),
  apiExtra: document.getElementById('api-extra'),
  helpCacheMeta: document.getElementById('help-cache-meta'),
  helpCacheBody: document.getElementById('help-cache-body'),
  helpCacheSelectAll: document.getElementById('help-cache-select-all'),
  helpCacheDeleteBtn: document.getElementById('help-cache-delete-btn'),
  helpCacheDeleteStatus: document.getElementById('help-cache-delete-status'),
}

/**
 * Escape text for safe HTML insertion.
 * @param {unknown} value
 * @returns {string}
 */
function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

/**
 * @param {string} label
 * @param {string} value
 * @param {{small?: boolean}} [opts]
 * @returns {string}
 */
function statCard(label, value, opts = {}) {
  const valueClass = opts.small ? 'stat-value small' : 'stat-value'
  return `
    <article class="stat-card">
      <span class="stat-label">${escapeHtml(label)}</span>
      <span class="${valueClass}">${value}</span>
    </article>
  `
}

/**
 * @param {string} state
 * @returns {string}
 */
function stateBadge(state) {
  const normalised = String(state || 'unknown').toLowerCase()
  let cls = 'badge'
  if (normalised !== 'active' && normalised !== 'running') cls += ' warn'
  if (normalised === 'failed' || normalised === 'inactive') cls += ' danger'
  return `<span class="${cls}">${escapeHtml(state || 'unknown')}</span>`
}

/**
 * @param {string|number|Date|null|undefined} value
 * @returns {string}
 */
function formatTime(value) {
  if (!value) return '—'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString()
}

/**
 * @param {object} server
 */
function renderServer(server) {
  const load = server.loadAverage || {}
  const memory = server.memory || {}
  const swap = server.swap || {}
  const largest = server.largestProcess

  els.serverGrid.innerHTML = [
    statCard('Hostname', escapeHtml(server.hostname || '—')),
    statCard('Uptime', escapeHtml(server.uptimeHuman || '—')),
    statCard(
      'Load average',
      escapeHtml(
        `${load.one?.toFixed?.(2) ?? load.one} / ${load.five?.toFixed?.(2) ?? load.five} / ${load.fifteen?.toFixed?.(2) ?? load.fifteen}`
      )
    ),
    statCard('CPUs', escapeHtml(String(server.cpuCount ?? '—'))),
    statCard(
      'Memory free / available',
      escapeHtml(`${memory.freeHuman || '—'} / ${memory.availableHuman || '—'}`),
      { small: true }
    ),
    statCard(
      'Memory used',
      escapeHtml(`${memory.usedHuman || '—'} (${memory.usedPercent ?? '—'}%)`),
      { small: true }
    ),
    statCard(
      'Swap free / total',
      escapeHtml(`${swap.freeHuman || '—'} / ${swap.totalHuman || '—'}`),
      { small: true }
    ),
    statCard('Apache processes', escapeHtml(String(server.apacheProcesses ?? 0))),
    statCard('php-fpm processes', escapeHtml(String(server.phpFpmProcesses ?? 0))),
    statCard(
      'Largest process',
      escapeHtml(largest ? `${largest.command} · ${largest.rssHuman} (${largest.pmem}%)` : '—'),
      { small: true }
    ),
  ].join('')

  const diskItems = (server.disks || [])
    .map(
      (disk) => `
      <li>
        <span><code>${escapeHtml(disk.mount)}</code> <span class="muted">${escapeHtml(disk.filesystem)}</span></span>
        <span class="mono">${escapeHtml(disk.availableHuman)} free · ${escapeHtml(disk.usePercent)}</span>
      </li>`
    )
    .join('')

  els.serverExtra.innerHTML = `
    <div class="subpanel">
      <h3>Disk</h3>
      <ul class="kv-list">${diskItems || '<li><span class="muted">No disk data</span></li>'}</ul>
      <p class="meta note-spacing">Platform: ${escapeHtml(server.platform || '—')}</p>
    </div>
  `
}

/**
 * @param {object} websocket
 */
function renderWebsocket(websocket) {
  const service = websocket.service || {}

  els.websocketGrid.innerHTML = [
    statCard('Service', stateBadge(service.activeState)),
    statCard('Memory in use', escapeHtml(service.memoryHuman || '—')),
    statCard('Users today (by IP)', escapeHtml(String(websocket.usersToday ?? 0))),
    statCard('Rooms accessed today', escapeHtml(String(websocket.roomsAccessedToday ?? 0))),
    statCard('Users online now', escapeHtml(String(websocket.usersOnlineNow ?? 0))),
    statCard('WSS hits today', escapeHtml(String(websocket.wssHitsToday ?? 0))),
    statCard('Active documents', escapeHtml(String((websocket.activeDocuments || []).length))),
    statCard('Active connections', escapeHtml(String(websocket.activeConnections ?? 0))),
  ].join('')

  const online = (websocket.onlineClients || [])
    .map(
      (client) => `
      <li>
        <code>${escapeHtml(client.ip)}</code>
        <span class="mono">${escapeHtml(client.connections)} conn</span>
      </li>`
    )
    .join('')

  const roomRows = (websocket.roomsToday || [])
    .map((entry) => {
      const room = typeof entry === 'string' ? entry : entry.room
      const count = typeof entry === 'string' ? '—' : entry.count
      return `
      <tr>
        <td class="mono">${escapeHtml(count)}</td>
        <td><code>${escapeHtml(room)}</code></td>
      </tr>`
    })
    .join('')

  const roomsTable = roomRows
    ? `
      <div class="table-scroll table-scroll-compact" tabindex="0">
        <table class="data-table data-table-compact">
          <thead>
            <tr>
              <th scope="col">Count</th>
              <th scope="col">Room</th>
            </tr>
          </thead>
          <tbody>${roomRows}</tbody>
        </table>
      </div>`
    : '<p class="muted">None yet</p>'

  const docs = (websocket.activeDocuments || [])
    .map(
      (doc) => `
      <li>
        <code>${escapeHtml(doc.room)}</code>
        <span class="mono">${escapeHtml(doc.connections)}</span>
      </li>`
    )
    .join('')

  const onlineNote = websocket.onlineError
    ? `<p class="meta">Online probe note: ${escapeHtml(websocket.onlineError)}</p>`
    : ''

  els.websocketExtra.innerHTML = `
    <div class="subpanel">
      <h3>Online clients</h3>
      <ul class="kv-list">${online || '<li><span class="muted">None right now</span></li>'}</ul>
      ${onlineNote}
    </div>
    <div class="subpanel">
      <h3>Active documents (from service log)</h3>
      <ul class="kv-list">${docs || '<li><span class="muted">None</span></li>'}</ul>
    </div>
    <div class="subpanel">
      <h3>Rooms accessed today</h3>
      ${roomsTable}
      <p class="meta note-spacing">PID ${escapeHtml(service.mainPid ?? '—')} · ${escapeHtml(service.subState || '')}</p>
    </div>
  `
}

/**
 * @param {object} api
 * @param {object} helpCache
 */
function renderApi(api, helpCache) {
  const service = api.service || {}

  els.apiGrid.innerHTML = [
    statCard('Service', stateBadge(service.activeState)),
    statCard('Memory in use', escapeHtml(service.memoryHuman || '—')),
    statCard('Users today (by IP)', escapeHtml(String(api.usersToday ?? 0))),
    statCard('PRSM API hits today', escapeHtml(String(api.apiHitsToday ?? 0))),
    statCard('Top IP today', escapeHtml(api.topIp ? `${api.topIp.ip} (${api.topIp.count})` : '—'), {
      small: true,
    }),
    statCard(
      'Room most used today',
      escapeHtml(api.topRoom ? `${api.topRoom.room} (${api.topRoom.count})` : '—'),
      { small: true }
    ),
    statCard('Scanner/other /api hits', escapeHtml(String(api.scannerOrOtherHitsToday ?? 0))),
    statCard('Help cache entries', escapeHtml(String(helpCache?.count ?? 0))),
  ].join('')

  const routes = (api.routes || [])
    .map(
      (row) => `
      <li>
        <code>${escapeHtml(row.route)}</code>
        <span class="mono">${escapeHtml(row.count)}</span>
      </li>`
    )
    .join('')

  els.apiExtra.innerHTML = `
    <div class="subpanel">
      <h3>Route usage today</h3>
      <ul class="kv-list">${routes || '<li><span class="muted">No PRSM API traffic yet today</span></li>'}</ul>
      <p class="meta note-spacing">PID ${escapeHtml(service.mainPid ?? '—')} · ${escapeHtml(service.subState || '')}</p>
    </div>
  `

  if (helpCache?.error) {
    els.helpCacheMeta.textContent = `Error reading helpCache: ${helpCache.error}`
  } else {
    const byOutcome = helpCache?.byOutcome || {}
    const outcomeParts = Object.entries(byOutcome)
      .map(([name, count]) => `${name}: ${count}`)
      .join(' · ')
    els.helpCacheMeta.textContent = outcomeParts
      ? `${helpCache?.count ?? 0} cached Q&A pairs · ${outcomeParts}`
      : `${helpCache?.count ?? 0} cached Q&A pairs`
  }

  const rows = helpCache?.entries || []
  if (els.helpCacheSelectAll) {
    els.helpCacheSelectAll.checked = false
    els.helpCacheSelectAll.indeterminate = false
    els.helpCacheSelectAll.disabled = !rows.length
  }
  if (!rows.length) {
    els.helpCacheBody.innerHTML = '<tr><td colspan="7">No help cache entries found.</td></tr>'
    updateHelpCacheDeleteButton()
    return
  }

  els.helpCacheBody.innerHTML = rows
    .map((row) => {
      const sources = (row.sources || [])
        .map((source) => source?.name || source?.url || 'source')
        .filter(Boolean)
        .join(', ')
      const cacheKey = row.standaloneQuery || row.question || ''
      const rawNote =
        row.rawQuestion && row.rawQuestion !== row.question
          ? `<div class="help-raw-question">asked as: ${escapeHtml(row.rawQuestion)}</div>`
          : ''
      return `
        <tr class="help-row-expandable" tabindex="0" aria-expanded="false" data-cache-key="${escapeHtml(cacheKey)}">
          <td class="help-select-col">
            <input
              type="checkbox"
              class="help-select-checkbox help-row-checkbox"
              title="When checked, this row is marked for deletion"
              aria-label="Select this help cache row for deletion"
            >
          </td>
          <td class="mono when-cell">${escapeHtml(formatTime(row.askedAt))}</td>
          <td class="mono">${escapeHtml(row.room || '—')}</td>
          <td>${outcomeBadge(row.outcome)}</td>
          <td class="help-cell-text">
            <div class="help-clamp">${escapeHtml(row.question)}</div>
            ${rawNote}
            <span class="help-more-hint" aria-hidden="true"></span>
          </td>
          <td class="help-cell-text help-cell-answer">
            <div class="help-clamp">${escapeHtml(row.answer)}</div>
            <span class="help-more-hint" aria-hidden="true"></span>
          </td>
          <td class="help-cell-text help-cell-sources">
            <div class="help-clamp">${escapeHtml(sources || '—')}</div>
            <span class="help-more-hint" aria-hidden="true"></span>
          </td>
        </tr>
      `
    })
    .join('')

  bindHelpCacheRowExpansion(els.helpCacheBody)
  bindHelpCacheSelection(els.helpCacheBody)
  updateHelpCacheDeleteButton()
}

/**
 * Clamp long Q/A/source cells; click or Enter/Space expands the row (retrofit admin pattern).
 * @param {HTMLElement} tbody
 */
function bindHelpCacheRowExpansion(tbody) {
  if (!tbody) return

  const measure = () => {
    for (const node of tbody.querySelectorAll('.help-clamp')) {
      node.classList.toggle('is-truncated', node.scrollHeight - node.clientHeight > 2)
    }
  }
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(measure)
  else measure()

  if (tbody.dataset.expandBound === 'true') return
  tbody.dataset.expandBound = 'true'

  tbody.addEventListener('click', (event) => {
    if (event.target.closest('input, label, button, a')) return
    const row = event.target.closest('tr.help-row-expandable')
    if (!row || !tbody.contains(row)) return
    toggleHelpRowExpansion(row)
  })

  tbody.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    if (event.target.closest('input, label, button, a')) return
    const row = event.target.closest('tr.help-row-expandable')
    if (!row || !tbody.contains(row)) return
    event.preventDefault()
    toggleHelpRowExpansion(row)
  })
}

/**
 * @param {HTMLElement} row
 */
function toggleHelpRowExpansion(row) {
  const expanded = row.classList.toggle('is-expanded')
  row.setAttribute('aria-expanded', expanded ? 'true' : 'false')
}

/**
 * Keep header checkbox and delete button in sync with row selection.
 * @param {HTMLElement} tbody
 */
function bindHelpCacheSelection(tbody) {
  if (!tbody || tbody.dataset.selectBound === 'true') return
  tbody.dataset.selectBound = 'true'

  tbody.addEventListener('change', (event) => {
    const target = event.target
    if (!(target instanceof HTMLInputElement) || !target.classList.contains('help-row-checkbox')) {
      return
    }
    syncHelpCacheSelectAll()
    updateHelpCacheDeleteButton()
  })

  tbody.addEventListener('click', (event) => {
    const target = event.target
    if (target instanceof HTMLInputElement && target.classList.contains('help-row-checkbox')) {
      event.stopPropagation()
    }
  })
}

/**
 * @returns {HTMLInputElement[]}
 */
function helpRowCheckboxes() {
  return [...(els.helpCacheBody?.querySelectorAll('.help-row-checkbox') || [])]
}

function syncHelpCacheSelectAll() {
  if (!els.helpCacheSelectAll) return
  const boxes = helpRowCheckboxes()
  const checked = boxes.filter((box) => box.checked).length
  els.helpCacheSelectAll.checked = boxes.length > 0 && checked === boxes.length
  els.helpCacheSelectAll.indeterminate = checked > 0 && checked < boxes.length
}

function updateHelpCacheDeleteButton() {
  if (!els.helpCacheDeleteBtn) return
  const selected = helpRowCheckboxes().filter((box) => box.checked).length
  els.helpCacheDeleteBtn.disabled = selected === 0
  els.helpCacheDeleteBtn.textContent =
    selected === 0 ? 'Delete selected' : `Delete selected (${selected})`
}

/**
 * @returns {string[]}
 */
function selectedHelpCacheKeys() {
  return helpRowCheckboxes()
    .filter((box) => box.checked)
    .map((box) => box.closest('tr')?.dataset.cacheKey || '')
    .filter(Boolean)
}

/**
 * Delete checked help-cache rows via the dashboard API, then refresh.
 * @returns {Promise<void>}
 */
async function deleteSelectedHelpCache() {
  const keys = selectedHelpCacheKeys()
  if (!keys.length) return

  const label = keys.length === 1 ? '1 selected entry' : `${keys.length} selected entries`
  if (!window.confirm(`Delete ${label} from the help cache? This cannot be undone.`)) {
    return
  }

  els.helpCacheDeleteBtn.disabled = true
  if (els.helpCacheDeleteStatus) {
    els.helpCacheDeleteStatus.textContent = 'Deleting…'
  }

  try {
    const response = await fetch('/api/help-cache/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
      body: JSON.stringify({ keys }),
    })
    const data = await response.json().catch(() => ({}))
    if (!response.ok || data.error) {
      throw new Error(data.error || `HTTP ${response.status}`)
    }
    const missingNote =
      Array.isArray(data.missing) && data.missing.length
        ? ` · ${data.missing.length} already gone`
        : ''
    if (els.helpCacheDeleteStatus) {
      els.helpCacheDeleteStatus.textContent = `Deleted ${data.deleted ?? 0}${missingNote}`
    }
    await refresh()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (els.helpCacheDeleteStatus) {
      els.helpCacheDeleteStatus.textContent = `Delete failed: ${message}`
    }
    setStatus(`Failed to delete help cache entries: ${message}`, true)
    updateHelpCacheDeleteButton()
  }
}

/**
 * @param {string|undefined|null} outcome
 * @returns {string}
 */
function outcomeBadge(outcome) {
  const value = String(outcome || 'unknown')
  let cls = 'badge'
  if (value === 'ok') cls += ' ok'
  else if (value === 'out_of_scope') cls += ' warn'
  else if (value === 'insufficient_context') cls += ' warn'
  else if (value === 'error') cls += ' danger'
  return `<span class="${cls}">${escapeHtml(value)}</span>`
}

/**
 * @param {object} data
 */
function renderAll(data) {
  els.dayLabel.textContent = data.dayLabel ? `Today · ${data.dayLabel}` : 'Today'
  els.updatedAt.textContent = `Updated ${formatTime(data.collectedAt)}`
  renderServer(data.server || {})
  renderWebsocket(data.websocket || {})
  renderApi(data.api || {}, data.helpCache || {})
}

/**
 * @param {string} message
 * @param {boolean} [isError]
 */
function setStatus(message, isError = false) {
  if (!message) {
    els.statusBanner.hidden = true
    els.statusBanner.textContent = ''
    return
  }
  els.statusBanner.hidden = false
  els.statusBanner.textContent = message
  els.statusBanner.classList.toggle('is-error', Boolean(isError))
}

/**
 * Fetch stats and refresh the UI.
 * @returns {Promise<void>}
 */
async function refresh() {
  els.refreshBtn.disabled = true
  try {
    const response = await fetch('/api/stats', { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }
    const data = await response.json()
    if (data.error) throw new Error(data.error)
    renderAll(data)
    setStatus('')
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    setStatus(`Failed to load stats: ${message}`, true)
    els.updatedAt.textContent = 'Update failed'
  } finally {
    els.refreshBtn.disabled = false
  }
}

els.refreshBtn.addEventListener('click', () => {
  refresh()
})

els.helpCacheSelectAll?.addEventListener('change', () => {
  const checked = Boolean(els.helpCacheSelectAll.checked)
  for (const box of helpRowCheckboxes()) {
    box.checked = checked
  }
  els.helpCacheSelectAll.indeterminate = false
  updateHelpCacheDeleteButton()
})

els.helpCacheDeleteBtn?.addEventListener('click', () => {
  deleteSelectedHelpCache()
})

refresh()
setInterval(refresh, REFRESH_MS)
