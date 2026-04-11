#!/bin/bash
# Backup PRSM LevelDB with minimal downtime using two-phase rsync
# Runs at 07:00 and 19:00, staggered with EC2 snapshots at 01:00 and 13:00

BACKUP_DIR="/data/backups/prsm/latest"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_TAG="prsm-backup"

mkdir -p "$BACKUP_DIR"

# Phase 1: warm copy while server is running (no downtime)
logger -t "$LOG_TAG" "Phase 1: warm rsync starting"
rsync -a --delete /data/prsm/dbDir/ "$BACKUP_DIR/"

# Phase 2: stop, sync only the deltas
logger -t "$LOG_TAG" "Phase 2: stopping websocket-server for final sync"
systemctl stop websocket-server
rsync -a --delete /data/prsm/dbDir/ "$BACKUP_DIR/"
systemctl start websocket-server
logger -t "$LOG_TAG" "Phase 2: websocket-server restarted"

# Phase 3: rotate a timestamped hardlink snapshot
cp -al "$BACKUP_DIR" "/data/backups/prsm/$TIMESTAMP"
logger -t "$LOG_TAG" "Snapshot saved: /data/backups/prsm/$TIMESTAMP"

# Prune backups older than 14 days
find /data/backups/prsm -maxdepth 1 -type d -mtime +14 -not -name latest -exec rm -rf {} +
logger -t "$LOG_TAG" "Backup complete"
