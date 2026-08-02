#!/usr/bin/env bash
set -euo pipefail
: "${DATABASE_URL:?Set DATABASE_URL to the PostgreSQL connection string}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-35}"
mkdir -p "$BACKUP_DIR"
STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
FILE="$BACKUP_DIR/alpha_erp_${STAMP}.dump"
pg_dump "$DATABASE_URL" --format=custom --compress=9 --no-owner --no-acl --file="$FILE"
sha256sum "$FILE" > "$FILE.sha256"
pg_restore --list "$FILE" > "$FILE.manifest.txt"
find "$BACKUP_DIR" -type f -mtime "+$RETENTION_DAYS" -delete
printf 'BACKUP_OK %s\n' "$FILE"
