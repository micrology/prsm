#!/usr/bin/env bash
# Stop processes started by utils/start-all-locally.sh / npm run start:all-locally.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

LOG_DIR="${TMPDIR:-/tmp}/prsm-local"

if [[ -d "$LOG_DIR" ]]; then
  shopt -s nullglob
  for pidfile in "$LOG_DIR"/*.pid; do
    pid="$(cat "$pidfile" 2>/dev/null || true)"
    if [[ -n "${pid:-}" ]] && kill -0 "$pid" 2>/dev/null; then
      # Kill the whole process group when possible (covers npm → parcel trees).
      kill -- "-$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
    fi
    rm -f "$pidfile"
  done
  shopt -u nullglob
fi

pkill -f 'ws-server/src/server.js' 2>/dev/null || true
pkill -f 'api-server/src/api-server.mjs' 2>/dev/null || true
pkill -f 'parcel watch' 2>/dev/null || true
pkill -f 'utils/dashboard-server.mjs' 2>/dev/null || true

if command -v lsof >/dev/null 2>&1; then
  for port in 1234 3001 8881; do
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill $pids 2>/dev/null || true
    fi
  done
  sleep 0.5
  for port in 1234 3001 8881; do
    pids="$(lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
      # shellcheck disable=SC2086
      kill -9 $pids 2>/dev/null || true
    fi
  done
fi

./launch_dashboard.sh kill >/dev/null 2>&1 || true

echo "Local stack stopped."
