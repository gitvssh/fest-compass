#!/bin/sh
set -eu

umask 077

enabled() {
  case "${1:-0}" in
    1|true|TRUE|yes|YES) return 0 ;;
    0|false|FALSE|no|NO|"") return 1 ;;
    *)
      echo "invalid boolean deployment setting" >&2
      exit 64
      ;;
  esac
}

: "${DATABASE_URL:?DATABASE_URL must be set}"

case "$DATABASE_URL" in
  file:/data/*) ;;
  *)
    echo "DATABASE_URL must point inside /data" >&2
    exit 78
    ;;
esac

if [ ! -d /data ] || [ ! -w /data ]; then
  echo "/data must be a writable persistent volume" >&2
  exit 78
fi

database_path="${DATABASE_URL#file:}"
database_path="${database_path%%\?*}"
if [ -e "$database_path" ] && [ ! -w "$database_path" ]; then
  echo "existing SQLite database is not writable" >&2
  exit 78
fi

if enabled "${RUN_DB_MIGRATIONS:-0}"; then
  node /app/scripts/migrate-sqlite.mjs
fi

if enabled "${SEED_DEMO_DATA:-0}"; then
  if ! enabled "${RUN_DB_MIGRATIONS:-0}"; then
    echo "SEED_DEMO_DATA requires RUN_DB_MIGRATIONS=true" >&2
    exit 64
  fi
  node /app/prisma/seed.cjs
fi

if enabled "${MIGRATE_ONLY:-0}"; then
  if ! enabled "${RUN_DB_MIGRATIONS:-0}"; then
    echo "MIGRATE_ONLY requires RUN_DB_MIGRATIONS=true" >&2
    exit 64
  fi
  exit 0
fi

exec "$@"
