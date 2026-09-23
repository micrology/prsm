#!/usr/bin/env bash
# Start the full local PRSM stack without leaving Node processes attached to the
# invoking TTY. Bare `node ... &` under `npm run` inherits stdin; when the npm
# script exits (or the terminal block closes), those processes crash with:
#   Error: read EIO  (TTY.onStreamRead)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="${TMPDIR:-/tmp}/prsm-local"
mkdir -p "$LOG_DIR"

free_ports() {
  local ports=("$@")
  if ! command -v lsof >/dev/null 2>&1; then
    return 0
  fi
  local port pids
  for port in "${ports[@]}"; do
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
    fi
  done
  # Brief wait, then force-kill stragglers.
  sleep 0.5
  for port in "${ports[@]}"; do
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  done
}

start_detached() {
  local name="$1"
  shift
  local log="$LOG_DIR/${name}.log"
  : >"$log"
  # stdin from /dev/null + nohup so the child survives script/TTY teardown
  nohup env "$@" </dev/null >"$log" 2>&1 &
  local pid=$!
  echo "$pid" >"$LOG_DIR/${name}.pid"
  echo "Started ${name} (pid ${pid}), log: ${log}"
}

# Stop anything left from a previous run (best-effort).
pkill -f 'ws-server/src/server.js' 2>/dev/null || true
pkill -f 'api-server/src/api-server.mjs' 2>/dev/null || true
pkill -f 'parcel watch' 2>/dev/null || true
pkill -f 'utils/dashboard-server.mjs' 2>/dev/null || true
pkill -f 'prsm-dashboard' 2>/dev/null || true
free_ports 1234 3001 8881

start_detached ws-server YPERSISTENCE=./dbDir VERBOSE=1 node ./ws-server/src/server.js
start_detached api-server PORT=3001 NODE_ENV=dev node ./api-server/src/api-server.mjs
start_detached parcel npm run dev

# Dashboard launcher already detaches its Node process and opens the browser.
./launch_dashboard.sh local

echo "Local stack running. Logs under ${LOG_DIR}/"
echo "Stop with: npm run stop:all-locally"
