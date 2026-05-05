#!/bin/sh
set -eu

DUMP_FILE="${DATA_DUMP_FILE:-/docker-entrypoint-initdata/local-data-dump.sql}"
BRANDING_LOGO_FILE="${BRANDING_LOGO_FILE:-/docker-entrypoint-initdata/branding-logo.png}"
BRANDING_LOGO_TARGET="${BRANDING_LOGO_TARGET:-/app/uploads/branding/logo-1777865698688-670336801.png}"
DB_USER="${POSTGRES_USER:-admin}"
DB_NAME="${POSTGRES_DB:-english_center_db}"
DB_HOST="${POSTGRES_HOST:-postgres}"
DB_PORT="${POSTGRES_PORT:-5432}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Data dump not found: $DUMP_FILE" >&2
  exit 1
fi

export PGPASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"; do
  sleep 1
done

schema_ready="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'Center';")"
if [ "$schema_ready" != "1" ]; then
  echo "Database schema is not ready. Run Prisma migrations before importing data." >&2
  exit 1
fi

if [ -f "$BRANDING_LOGO_FILE" ] && [ ! -f "$BRANDING_LOGO_TARGET" ]; then
  echo "Seeding branding logo to $BRANDING_LOGO_TARGET..."
  mkdir -p "$(dirname "$BRANDING_LOGO_TARGET")"
  cp "$BRANDING_LOGO_FILE" "$BRANDING_LOGO_TARGET"
fi

existing_rows="$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -Atc "select count(*) from public.\"Center\";")"
if [ "$existing_rows" != "0" ]; then
  echo "Database already has data. Skipping import from $DUMP_FILE."
  exit 0
fi

echo "Importing seed data from $DUMP_FILE..."
psql -v ON_ERROR_STOP=1 -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$DUMP_FILE"
echo "Data import completed."
