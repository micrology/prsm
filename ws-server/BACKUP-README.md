# PRSM LevelDB Backup and Restore

## Overview

The PRSM websocket server stores Y.js document data in a LevelDB database at `/data/prsm/dbDir` (currently ~3.5 GB, 35,000+ keys). LevelDB only allows single-process access, so backups require briefly stopping the websocket-server.

These scripts use a two-phase rsync approach to minimise downtime to ~1 second.

## Backup

**Script:** `/usr/local/bin/backup-prsmdb.sh` (copy in this directory)

**Schedule:** Runs automatically via root crontab at **07:00** and **19:00** BST, staggered with EC2 snapshots at 01:00 and 13:00.

**How it works:**

1. Phase 1: rsync the database while the server is still running (no downtime)
2. Phase 2: stop the server, rsync only the changed files (~1 second), restart
3. Create a timestamped hardlink snapshot for rotation
4. Prune backups older than 14 days

**Backup location:** `/data/backups/prsm/`

- `latest/` — most recent backup (always kept up to date)
- `YYYYMMDD_HHMMSS/` — timestamped snapshots (hardlinked, minimal extra disk usage)

**Manual run:**

``` bash
sudo /usr/local/bin/backup-prsmdb.sh
```

**Logs:** Tagged `prsm-backup` in syslog. View with:

``` bash
sudo journalctl -t prsm-backup
```

## Restore

**Script:** `/usr/local/bin/restore-prsmdb.sh` (copy in this directory)

**Restore from latest backup:**

``` bash
sudo restore-prsmdb.sh
```

**Restore from a specific snapshot:**

``` bash
sudo restore-prsmdb.sh 20260410_212419
```

**What it does:**

1. Asks for confirmation
2. Stops the websocket-server
3. Moves the current database to `/data/prsm/dbDir.broken.<timestamp>` (safe to delete later)
4. Copies the backup into place
5. Removes the stale LOCK file
6. Restarts the websocket-server

If any step fails, the script rolls back and restarts the server.

**Restore from EC2 snapshot (for older data):**

1. Create a new EBS volume from the desired EC2 snapshot
2. Attach and mount it (e.g. `/mnt/restore`)
3. Stop websocket-server: `sudo systemctl stop websocket-server`
4. Replace the database: `sudo mv /data/prsm/dbDir /data/prsm/dbDir.broken && sudo cp -a /mnt/restore/data/prsm/dbDir /data/prsm/dbDir && sudo rm -f /data/prsm/dbDir/LOCK`
5. Restart: `sudo systemctl start websocket-server`
6. Detach and delete the temporary EBS volume

**Important:** A full restore replaces ALL rooms. Changes to other rooms made after the backup point will be lost.
