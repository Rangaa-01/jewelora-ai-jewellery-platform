#!/usr/bin/env bash
# Creates the local development and test databases on an existing PostgreSQL server.
# Usage: PGHOST=127.0.0.1 PGUSER=postgres PGPASSWORD=... ./scripts/setup_local_db.sh
set -euo pipefail
: "${PGHOST:=127.0.0.1}"; : "${PGPORT:=5432}"; : "${PGUSER:=postgres}"
APP_USER="${JEWELORA_DB_USER:-jewelora}"
APP_PASSWORD="${JEWELORA_DB_PASSWORD:-jewelora_dev_password}"
export PGHOST PGPORT PGUSER

psql -v ON_ERROR_STOP=1 -d postgres <<SQL
DO \$\$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='${APP_USER}') THEN
    CREATE ROLE ${APP_USER} LOGIN PASSWORD '${APP_PASSWORD}';
  END IF;
END \$\$;
SQL
for db in jewelora jewelora_test; do
  if ! psql -tAc "SELECT 1 FROM pg_database WHERE datname='${db}'" -d postgres | grep -q 1; then
    psql -v ON_ERROR_STOP=1 -d postgres -c "CREATE DATABASE ${db} OWNER ${APP_USER}"
  fi
  psql -v ON_ERROR_STOP=1 -d "${db}" -f "$(dirname "$0")/../database/init/01_extensions.sql"
done
echo "Databases ready: jewelora, jewelora_test (user ${APP_USER})"
