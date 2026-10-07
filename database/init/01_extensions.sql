-- Executed once by the postgres container on first start. Local developers run the
-- equivalent via scripts/setup_local_db.sh. Schema is managed by Alembic, not here.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;
