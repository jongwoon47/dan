#!/usr/bin/env bash
# pg_dump backup of live DAN Supabase (wmznpuhqmmqunwtewntt).
# Never prints the connection string. Writes outside the git worktree by default.
#
# Required:
#   SUPABASE_DB_URL=postgresql://postgres.<ref>:<password>@.../postgres
#   or DATABASE_URL with the same value
#
# Optional:
#   DAN_BACKUP_DIR=/var/dan-backups   (default: /var/dan-backups if writable, else $HOME/dan-backups)
#   DAN_BACKUP_SKIP_RESTORE_PROBE=1   skip local restore probe
#
# Output: <dir>/dan-wmznpuhqmmqunwtewntt-<timestamp>.dump + .sha256 + .manifest.json
set -euo pipefail

REF="wmznpuhqmmqunwtewntt"
URL="${SUPABASE_DB_URL:-${DATABASE_URL:-${STAGING_SUPABASE_DB_URL:-}}}"

if [[ -z "${URL}" ]]; then
  echo "NEEDS USER: set SUPABASE_DB_URL (Postgres URI for project ${REF})." >&2
  echo "Supabase Dashboard → Project Settings → Database → URI (Session mode / direct)." >&2
  exit 2
fi

# Refuse wrong / retired projects without echoing the URL.
lower="$(printf '%s' "$URL" | tr '[:upper:]' '[:lower:]')"
if [[ "$lower" != *"${REF}"* ]]; then
  echo "REFUSED: connection string host/user must include live DAN ref ${REF}." >&2
  exit 1
fi
if [[ "$lower" == *"hcbooyexjgsjzjncpvtk"* ]]; then
  echo "REFUSED: retired Supabase project." >&2
  exit 1
fi

if ! command -v pg_dump >/dev/null; then
  echo "FAIL: pg_dump not installed" >&2
  exit 1
fi

if [[ -n "${DAN_BACKUP_DIR:-}" ]]; then
  OUT_DIR="$DAN_BACKUP_DIR"
elif mkdir -p /var/dan-backups 2>/dev/null && [[ -w /var/dan-backups ]]; then
  OUT_DIR=/var/dan-backups
else
  OUT_DIR="${HOME}/dan-backups"
  mkdir -p "$OUT_DIR"
fi

# Hard refuse writing into the git repo.
case "$OUT_DIR" in
  /workspace/*|*/workspace/*)
    echo "REFUSED: backup directory must be outside the git worktree ($OUT_DIR)" >&2
    exit 1
    ;;
esac

TS="$(date -u +%Y%m%dT%H%M%SZ)"
DUMP="${OUT_DIR}/dan-${REF}-${TS}.dump"
SHA="${DUMP}.sha256"
MANIFEST="${DUMP}.manifest.json"

echo "Backing up live DAN ${REF} → ${DUMP}"
# Custom format: compressible, restorable, listable without loading full SQL into logs.
# --no-owner/--no-acl keep restore portable; include auth schema data for accounts.
PGCONNECT_TIMEOUT=30 pg_dump \
  --dbname="$URL" \
  --format=custom \
  --no-owner \
  --no-acl \
  --verbose \
  --file="$DUMP" \
  2>"${DUMP}.pg_dump.log"

if [[ ! -s "$DUMP" ]]; then
  echo "FAIL: dump file missing or empty" >&2
  exit 1
fi

BYTES="$(wc -c <"$DUMP" | tr -d ' ')"
sha256sum "$DUMP" | awk '{print $1}' >"$SHA"
HASH="$(cat "$SHA")"

# Structural verification without restoring (does not load PII into stdout beyond TOC names).
TOC_LIST="$(pg_restore --list "$DUMP")"
TOC_COUNT="$(printf '%s\n' "$TOC_LIST" | grep -c '^[0-9]\+;' || true)"
HAS_PROFILES="$(printf '%s\n' "$TOC_LIST" | grep -c 'TABLE DATA .* profiles' || true)"
HAS_DEMANDS="$(printf '%s\n' "$TOC_LIST" | grep -c 'TABLE DATA .* demands' || true)"
HAS_MESSAGES="$(printf '%s\n' "$TOC_LIST" | grep -c 'TABLE DATA .* messages' || true)"

if [[ "${TOC_COUNT:-0}" -lt 50 ]]; then
  echo "FAIL: dump TOC too small (${TOC_COUNT})" >&2
  exit 1
fi
if [[ "${HAS_PROFILES:-0}" -lt 1 ]]; then
  echo "FAIL: dump missing profiles TABLE DATA" >&2
  exit 1
fi

RESTORE_PROBE="skipped"
if [[ "${DAN_BACKUP_SKIP_RESTORE_PROBE:-}" != "1" ]] && command -v psql >/dev/null; then
  if command -v initdb >/dev/null && command -v pg_ctl >/dev/null; then
    PROBE_DIR="${OUT_DIR}/restore-probe-${TS}"
    mkdir -p "$PROBE_DIR"
    initdb -D "$PROBE_DIR/data" --auth-local=trust --auth-host=trust >/dev/null
    pg_ctl -D "$PROBE_DIR/data" -l "$PROBE_DIR/pg.log" -o "-p 55432 -k $PROBE_DIR" start
    sleep 1
    createdb -h "$PROBE_DIR" -p 55432 dan_restore_probe
    if pg_restore \
      --dbname="postgresql://ubuntu@127.0.0.1:55432/dan_restore_probe" \
      --no-owner --no-acl \
      --exit-on-error \
      "$DUMP" >"$PROBE_DIR/restore.out" 2>&1; then
      PROF_COUNT="$(psql -h 127.0.0.1 -p 55432 -d dan_restore_probe -Atc 'select count(*) from public.profiles;' 2>/dev/null || echo 0)"
      RESTORE_PROBE="ok:profiles=${PROF_COUNT}"
      # Baseline was 104; probe/signup users may raise the count — require >=104.
      if [[ "${PROF_COUNT}" -lt 104 ]]; then
        echo "WARN: restored profiles count=${PROF_COUNT} (<104). Dump kept; investigate before migrate." >&2
        RESTORE_PROBE="warn:profiles=${PROF_COUNT}"
      fi
    else
      RESTORE_PROBE="fail"
      echo "WARN: local restore probe failed; see ${PROBE_DIR}/restore.out. Dump file still kept for inspection." >&2
    fi
    pg_ctl -D "$PROBE_DIR/data" stop -m fast >/dev/null || true
  else
    RESTORE_PROBE="list-only (install postgresql for full local restore probe)"
  fi
fi

python3 - <<PY
import json, os
manifest = {
  "projectRef": "${REF}",
  "createdAtUtc": "${TS}",
  "dumpPath": "${DUMP}",
  "sha256Path": "${SHA}",
  "sha256": "${HASH}",
  "bytes": int("${BYTES}"),
  "tocEntries": int("${TOC_COUNT}"),
  "hasProfilesTableData": int("${HAS_PROFILES}") > 0,
  "hasDemandsTableData": int("${HAS_DEMANDS}") > 0,
  "hasMessagesTableData": int("${HAS_MESSAGES}") > 0,
  "restoreProbe": "${RESTORE_PROBE}",
  "pgDumpVersion": "$(pg_dump --version)",
  "gitWorktreeSafe": True,
  "note": "Do not commit this dump. Contains PII.",
}
open("${MANIFEST}", "w", encoding="utf8").write(json.dumps(manifest, indent=2) + "\n")
print(json.dumps(manifest, indent=2))
PY

echo "BACKUP_OK manifest=${MANIFEST}"
echo "Set DAN_BACKUP_MANIFEST=${MANIFEST} before applying migrations."
