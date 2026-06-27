-- Migration: add gestion_maestro_id to gestiones and FK to gestiones_maestro
-- Postgres version (safe to run multiple times):
ALTER TABLE gestiones
  ADD COLUMN IF NOT EXISTS gestion_maestro_id INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_gestion_maestro'
  ) THEN
    ALTER TABLE gestiones
      ADD CONSTRAINT fk_gestion_maestro FOREIGN KEY (gestion_maestro_id) REFERENCES gestiones_maestro(id);
  END IF;
END$$;

-- SQLite note: SQLite does not support ADD CONSTRAINT for existing tables.
-- For SQLite the Node migration script will add the column if missing.
