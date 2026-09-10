#!/usr/bin/env bash
# Dump SQLite help cache entries (dev helper).
# Usage: ./dump_help_cache.sh [path/to/helpCache.db]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DB="${1:-${HELP_CACHE_LOCATION:-$ROOT/helpCache.db}}"
# If a legacy LevelDB dir path is passed, prefer sibling .db
if [[ -d "$DB" && ! -f "$DB" ]]; then
  DB="${DB}.db"
fi
node "$ROOT/doc/help/scripts/listKeys.mjs" "$DB"
