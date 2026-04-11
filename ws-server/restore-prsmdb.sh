#!/bin/bash
# Restore PRSM LevelDB from backup
# Usage:
#   restore-prsmdb.sh                  # restore from latest backup
#   restore-prsmdb.sh 20260410_212419  # restore from specific snapshot

BACKUP_BASE="/data/backups/prsm"
DB_DIR="/data/prsm/dbDir"
BROKEN_DIR="/data/prsm/dbDir.broken.$(date +%Y%m%d_%H%M%S)"

# Determine which backup to restore
if [ -z "$1" ]; then
    RESTORE_FROM="$BACKUP_BASE/latest"
else
    RESTORE_FROM="$BACKUP_BASE/$1"
fi

# Validate
if [ ! -d "$RESTORE_FROM" ]; then
    echo "ERROR: Backup not found: $RESTORE_FROM"
    echo ""
    echo "Available backups:"
    ls -1d "$BACKUP_BASE"/2* "$BACKUP_BASE/latest" 2>/dev/null | while read dir; do
        echo "  $(basename "$dir")  ($(du -sh "$dir" 2>/dev/null | cut -f1))"
    done
    exit 1
fi

echo "=== PRSM LevelDB Restore ==="
echo "Restoring from: $RESTORE_FROM"
echo "Current DB:     $DB_DIR"
echo "Broken DB will be saved to: $BROKEN_DIR"
echo ""
read -p "This will stop the websocket-server and replace the database. Continue? [y/N] " confirm
if [[ "$confirm" != [yY] ]]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Step 1/4: Stopping websocket-server..."
systemctl stop websocket-server
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to stop websocket-server"
    exit 1
fi

echo "Step 2/4: Moving current database to $BROKEN_DIR..."
mv "$DB_DIR" "$BROKEN_DIR"
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to move current database. Restarting websocket-server..."
    systemctl start websocket-server
    exit 1
fi

echo "Step 3/4: Copying backup into place..."
cp -a "$RESTORE_FROM" "$DB_DIR"
if [ $? -ne 0 ]; then
    echo "ERROR: Failed to copy backup. Restoring original database..."
    mv "$BROKEN_DIR" "$DB_DIR"
    systemctl start websocket-server
    exit 1
fi
rm -f "$DB_DIR/LOCK"

echo "Step 4/4: Starting websocket-server..."
systemctl start websocket-server
if [ $? -ne 0 ]; then
    echo "ERROR: websocket-server failed to start. Check: systemctl status websocket-server"
    exit 1
fi

echo ""
echo "=== Restore complete ==="
echo "The previous (broken) database is saved at: $BROKEN_DIR"
echo "You can delete it once you've confirmed everything is working:"
echo "  rm -rf $BROKEN_DIR"
