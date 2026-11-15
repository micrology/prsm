# Plan 001: Keep PRSM 4 collaboration connected during keyboard and pointer activity

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md` — unless a reviewer dispatched you and told you they
> maintain the index.
>
> **Drift check (run first)**: `git diff --stat 71fd3a2..HEAD -- prsm4/src/app/collab.js prsm4/src/app/notes.js prsm4/tests/unit/`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: bug
- **Planned at**: commit `71fd3a2`, 2026-11-15

## Why this matters

PRSM 4 disconnects the Yjs websocket after 15 minutes without **mouse movement**, even if the user is actively typing notes or using the keyboard. Notes and other edits still mutate the local Y.Doc while offline (`notes.js` saves on every Quill `text-change`). Peers stop receiving those edits until a mouse move reconnects the client. Idle disconnect remains desirable for resource savings; it must only fire when the user is truly idle across input modalities, not merely mouseless.

## Current state

Relevant files:

- `prsm4/src/app/collab.js` — presence, cursors, and sleep/disconnect (`Collaboration`)
- `prsm4/src/app/notes.js` — Quill note panels; writes to the store on user typing (no wake call)
- `prsm4/src/app/app.js` — constructs `Collaboration` with `{ store, cy, provider, user }` only
- `prsm4/tests/unit/readonly.test.js` — exemplar for Node test runner style (no browser)

Excerpts as of `71fd3a2`:

```js
// prsm4/src/app/collab.js — constructor (only mousemove wakes)
window.addEventListener('mousemove', (e) => this.onMouseMove(e))
listen('showUsersSwitch', 'change', () => this.refresh())
this.wake()
```

```js
// prsm4/src/app/collab.js — sleep path
onMouseMove(e) {
  this.wake()
  // ... throttled cursor publish ...
}
wake() {
  clearTimeout(this.sleepTimer)
  this.setAsleep(false)
  this.sleepTimer = setTimeout(() => this.setAsleep(true), SLEEP_AFTER_MS)
}
setAsleep(asleep) {
  if (Boolean(this.user.asleep) === asleep) return
  this.user.asleep = asleep
  this.awareness.setLocalStateField('user', this.user)
  if (asleep) this.provider.disconnect()
  else this.provider.connect()
  this.refresh()
}
```

```js
// prsm4/src/app/notes.js — typing still saves while collab may be disconnected
editor.on('text-change', (delta, old, source) => source === 'user' && this.saveNote(kind))
```

Constants at top of `collab.js`:

```js
const SLEEP_AFTER_MS = 15 * 60 * 1000
const THROTTLE_MS = 200
```

Repo conventions (match them):

- Vanilla ES modules; JSDoc on non-anonymous functions; `camelCase` / `UPPER_SNAKE_CASE` for constants
- Prefer early returns; keep functions small
- Comment purpose of non-anonymous functions
- Unit tests: `node:test` + `node:assert/strict` under `prsm4/tests/unit/` (see `readonly.test.js`)
- Do **not** run `npm run lint` or `npm run check` (they rewrite files). Prefer:

```bash
./node_modules/.bin/eslint prsm4/src/app/collab.js --no-fix
npm run test:prsm4
```

Documented product context (do not re-litigate): collaboration uses Yjs awareness + websocket; resource-saving idle disconnect is intentional. This plan only broadens what counts as activity.

## Commands you will need

| Purpose | Command | Expected on success |
|---------|---------|---------------------|
| Drift check | `git diff --stat 71fd3a2..HEAD -- prsm4/src/app/collab.js prsm4/src/app/notes.js prsm4/tests/unit/` | empty, or only expected local WIP |
| Lint (read-only) | `./node_modules/.bin/eslint prsm4/src/app/collab.js prsm4/tests/unit/collab-idle.test.js --no-fix` | exit 0, no messages |
| Unit + integration | `npm run test:prsm4` | exit 0; all pass (optional corpus skip OK) |
| Focused unit file | `node --test prsm4/tests/unit/collab-idle.test.js` | exit 0; new tests pass |

## Scope

**In scope** (the only files you should modify or create):

- `prsm4/src/app/collab.js`
- `prsm4/tests/unit/collab-idle.test.js` (create)

**Out of scope** (do NOT touch):

- `prsm4/src/app/notes.js` — do not wire notes → collab; wake listeners on the window must cover typing in Quill without a notes dependency (avoids cycles and keeps sleep logic in one place)
- `prsm4/src/app/app.js` — constructor options need not change if activity binding stays inside `Collaboration`
- Legacy `js/prsm.js` sleep/offline behaviour
- Changing `SLEEP_AFTER_MS` duration (keep 15 minutes)
- Server-side idle, prune, or destroyDocument races (separate findings)
- Debouncing note saves / history snapshots (separate performance findings)
- CSS / avatar "asleep" styling beyond existing `setAsleep` behaviour

## Git workflow

- Branch: `advisor/001-collab-wake-on-activity` (or continue on current branch if the operator already provided one)
- Commit message style (imperative sentence, no conventional-commit prefix required), e.g. from history: `Add Tutorial tour`, `fix: If a key is missing from yDrawingMap...`
- Example: `Keep collaboration awake during keyboard and pointer activity`
- Do NOT push or open a PR unless the operator instructed it
- Do NOT commit unless the operator asked to commit

## Steps

### Step 0: Drift check

Run the drift check command above. If `collab.js` sleep/mousemove sections differ from "Current state", STOP.

**Verify**: drift command exits 0; no unexpected diffs in in-scope paths (or only your own uncommitted work on this plan).

### Step 1: Extract a small, testable activity-binding helper in `collab.js`

Keep `Collaboration` behaviour in the same file (no new production modules unless unavoidable).

1. Export the idle timeout constant for tests:

```js
export const SLEEP_AFTER_MS = 15 * 60 * 1000
```

(Replace the existing non-exported `const SLEEP_AFTER_MS = ...`.)

2. Add and export a pure helper that registers wake-only activity listeners (not cursor tracking):

```js
/**
 * Events that count as user activity for staying connected to the room.
 * Mousemove is handled separately because it also publishes the cursor.
 */
export const WAKE_ACTIVITY_EVENTS = ['keydown', 'pointerdown', 'wheel', 'touchstart']

/**
 * Call wake whenever the user interacts without necessarily moving the mouse cursor stream.
 * @param {EventTarget} target usually `window`
 * @param {function():void} wake marks the user active and restarts the idle timer
 * @param {string[]} [events] activity event names
 * @returns {function():void} remove the listeners
 */
export function bindWakeActivity(target, wake, events = WAKE_ACTIVITY_EVENTS) {
  /** @param {Event} _event */
  const onActivity = (_event) => wake()
  for (const name of events) target.addEventListener(name, onActivity, { passive: true })
  return () => {
    for (const name of events) target.removeEventListener(name, onActivity)
  }
}
```

Match file style: file header already present; JSDoc on the new exports; no inline styles.

3. In `Collaboration` constructor, after the existing `mousemove` listener, store an unbind handle:

```js
this.unbindWakeActivity = bindWakeActivity(window, () => this.wake())
```

4. Do **not** remove `mousemove` → `onMouseMove` → `wake()`; cursor publishing stays as today.

5. Optional but recommended for cleanliness: add a `destroy()` method that clears the sleep timer, calls `this.unbindWakeActivity?.()`, and removes the mousemove listener if you stored a named reference. Only required if you introduce named listener refs; if mousemove stays as an anonymous arrow, document that App owns Collaboration for the page lifetime and unbindWakeActivity is enough for tests. Prefer named `this.onMouseMove` bound method or arrow assigned to `this._onMouseMove` so destroy can remove it — only if you already touch that path; **do not** refactor the whole class.

Minimum acceptable constructor change:

```js
window.addEventListener('mousemove', (e) => this.onMouseMove(e))
this.unbindWakeActivity = bindWakeActivity(window, () => this.wake())
```

Update the comment on `setAsleep` so it no longer says "has not moved the mouse"; say the user has been idle (no pointer/keyboard activity) for a long time.

**Verify**:

```bash
./node_modules/.bin/eslint prsm4/src/app/collab.js --no-fix
```

→ exit 0

```bash
node --input-type=module -e "import { WAKE_ACTIVITY_EVENTS, bindWakeActivity, SLEEP_AFTER_MS } from './prsm4/src/app/collab.js'; if (!WAKE_ACTIVITY_EVENTS.includes('keydown') || SLEEP_AFTER_MS !== 900000) process.exit(1); let n=0; const u=bindWakeActivity({ addEventListener(){}, removeEventListener(){ n++ } }, ()=>{}); u(); if(n!==WAKE_ACTIVITY_EVENTS.length) process.exit(1)"
```

→ exit 0  
(Note: importing `collab.js` pulls browser-oriented deps; if this one-liner fails solely because Cytoscape/`elem` touch `document` at import time, STOP and report — then fall back to verifying exports only via the unit test file in Step 2 using a dynamic import pattern that mocks `document`, or split the helper into `prsm4/src/app/collab-idle.js` with **no** DOM imports. Prefer split only if import-time failure is real.)

**If import-time DOM failure occurs**: create `prsm4/src/app/collab-idle.js` containing `SLEEP_AFTER_MS` (re-export duration constant or keep duration in collab and only move `WAKE_ACTIVITY_EVENTS` + `bindWakeActivity`), import it from `collab.js`, and put the unit test against `collab-idle.js`. That file then becomes in-scope.

### Step 2: Unit tests for activity binding and idle timer restart

Create `prsm4/tests/unit/collab-idle.test.js` modelled on `readonly.test.js` (node:test, strict assert).

Cover at least:

1. **`bindWakeActivity` invokes wake** for each event name in `WAKE_ACTIVITY_EVENTS` when the target dispatches that event (use a tiny EventTarget or a mock with a Map of handlers).
2. **Unbind stops further wakes** after the returned disposer runs.
3. **Idle timer restart (logic test)** — do **not** construct full `Collaboration` unless easy. Instead test a minimal local pattern mirroring `wake`/`setAsleep` **or** export a tiny helper:

```js
/**
 * Restart the idle sleep timer.
 * @param {{ clearTimeout: Function, setTimeout: Function }} timers
 * @param {function(boolean):void} setAsleep
 * @param {number} sleepAfterMs
 * @param {{ current: any }} slot holds the timer id at `slot.current`
 * @returns {void}
 */
export function restartSleepTimer(timers, setAsleep, sleepAfterMs, slot) {
  timers.clearTimeout(slot.current)
  setAsleep(false)
  slot.current = timers.setTimeout(() => setAsleep(true), sleepAfterMs)
}
```

Wire `Collaboration.wake` to call `restartSleepTimer` with `globalThis` timers and `this.sleepTimer` stored on `slot`/`this`. Then unit-test with fake timers:

```js
test('restartSleepTimer marks awake immediately and asleep after delay', () => {
  const calls = []
  let now = 0
  const timers = new Map()
  const fake = {
    clearTimeout(id) { timers.delete(id) },
    setTimeout(fn, ms) {
      const id = Symbol()
      timers.set(id, { fn, when: now + ms })
      return id
    },
  }
  const slot = { current: null }
  const setAsleep = (v) => calls.push(v)
  restartSleepTimer(fake, setAsleep, 1000, slot)
  assert.deepEqual(calls, [false])
  now = 1000
  for (const t of timers.values()) if (t.when <= now) t.fn()
  assert.deepEqual(calls, [false, true])
})
```

(Adjust to whatever small API you export; the point is machine-checkable coverage of "activity resets idle" without Playwright.)

4. Assert `WAKE_ACTIVITY_EVENTS` includes `keydown` and `pointerdown`.

**Verify**:

```bash
node --test prsm4/tests/unit/collab-idle.test.js
```

→ exit 0; all tests pass; at least 3 tests (or equivalent assertions).

### Step 3: Wire helper into `wake` path and sanity-check full suite

Ensure production `wake()` still:

1. clears prior timer
2. calls `setAsleep(false)` (reconnect if was asleep)
3. schedules `setAsleep(true)` after `SLEEP_AFTER_MS`

Ensure `setAsleep(true)` still `provider.disconnect()` and `setAsleep(false)` still `provider.connect()`.

Do not change throttle behaviour for cursor publishing.

**Verify**:

```bash
./node_modules/.bin/eslint prsm4/src/app/collab.js prsm4/tests/unit/collab-idle.test.js --no-fix
npm run test:prsm4
```

→ eslint exit 0; test:prsm4 exit 0 (1 optional skip for missing `data/` corpus is OK; zero failures).

### Step 4: Update plan index status

Set this plan's row in `plans/README.md` to `DONE` (or `IN PROGRESS` while working).

**Verify**: `plans/README.md` status column shows the correct state for 001.

## Test plan

New file: `prsm4/tests/unit/collab-idle.test.js`

| Case | What it locks in |
|------|------------------|
| keydown/pointerdown/wheel/touchstart call wake via `bindWakeActivity` | Regression for "typing does not count as activity" |
| disposer removes listeners | No leaked handlers / double-wake after destroy |
| fake-timer idle restart | Sleep still happens after timeout; activity clears asleep |
| `WAKE_ACTIVITY_EVENTS` membership | Future refactors cannot drop `keydown` silently |

Pattern: `prsm4/tests/unit/readonly.test.js`.

Manual check (operator or browser harness; not required for Done if unit tests pass): open two PRSM 4 clients; in A, focus notes and type without moving the mouse for a short **test** timeout if you temporarily lower `SLEEP_AFTER_MS` behind a query flag — **do not leave a shortened production timeout**. Prefer unit tests only unless operator asks for a debug flag; if you add `?debug=idle1s` support, it must be opt-in via existing `debug=` token style in URL and default production remains 15 minutes — only add if unit tests cannot cover disconnect/reconnect. Prefer unit tests only for this plan.

## Done criteria

Machine-checkable. ALL must hold:

- [ ] `git diff --stat 71fd3a2..HEAD -- prsm4/src/app/collab.js` shows only intentional collab idle/wake changes (and optional `collab-idle.js` if split)
- [ ] `mousemove` still calls `wake()` (cursor path intact): `grep -n "onMouseMove\|mousemove" prsm4/src/app/collab.js` still shows both
- [ ] `keydown` activity is registered: `grep -n "keydown" prsm4/src/app/collab.js prsm4/src/app/collab-idle.js 2>/dev/null` matches the new binding
- [ ] `SLEEP_AFTER_MS` remains `15 * 60 * 1000` (900000 ms)
- [ ] `node --test prsm4/tests/unit/collab-idle.test.js` exits 0
- [ ] `npm run test:prsm4` exits 0 with 0 failures
- [ ] `./node_modules/.bin/eslint prsm4/src/app/collab.js prsm4/tests/unit/collab-idle.test.js --no-fix` exits 0
- [ ] `git status --short` shows no modifications outside in-scope files (+ `plans/README.md`)
- [ ] `plans/README.md` status row for 001 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Drift: sleep/`onMouseMove`/`setAsleep` excerpts no longer match live `collab.js`
- Importing `collab.js` in Node fails due to DOM/Cytoscape and a clean `collab-idle.js` split is refused by other constraints
- Fix appears to require changing `notes.js`, `app.js`, or the websocket server
- You believe disconnect must be removed entirely (out of scope — idle disconnect stays)
- You need to change `SLEEP_AFTER_MS` production duration to make tests pass (use fake timers instead)
- A verification command fails twice after a reasonable fix
- Discovering that Quill handles keyboard events with `stopPropagation` such that `window` never sees `keydown` — then STOP and report; next option is capture-phase listeners (`addEventListener(..., true)`) on `window` or `document`, which is an allowed adjustment **within** this plan if documented in the PR/commit body. Try capture phase once before stopping.

## Maintenance notes

- Future activity types (e.g. stylus-only `pointermove` without mouse) may need inclusion in `WAKE_ACTIVITY_EVENTS`; keep mousemove on the cursor path so awareness cursors stay throttled.
- Reviewers should confirm production idle is still 15 minutes and that disconnect/connect on `setAsleep` is unchanged.
- Deferred: skip disconnect while local doc has unsent updates; note-save debounce; server destroy race — separate plans.
- Touch devices: `touchstart` / `pointerdown` cover primary cases; do not add heavy touch gesture code here.
