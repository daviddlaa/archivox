-- ============================================================================
-- MIGRACIÓN 011: Plantillas de mensajes por usuario
-- ============================================================================
-- Fecha: Agosto 2026
-- Descripción: Crea la tabla plantillas para almacenar plantillas de mensajes
--              que cada usuario puede crear (máximo 5 por usuario, validado
--              en el controlador). El contenido puede incluir la variable
--              {nombre} que se reemplaza con el nombre del cliente al enviar.
--
-- Ejecutar: psql -d tu_db -f migrations/011_create_plantillas.pg.sql
-- (También se crea automáticamente al arrancar el servidor vía initDb.pg.js)
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS plantillas (
    id              SERIAL PRIMARY KEY,
    usuario_id      INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    nombre          TEXT NOT NULL,
    contenido       TEXT NOT NULL,
    creada_en       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    actualizada_en  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_plantillas_usuario
    ON plantillas(usuario_id);

-- ============================================================================
-- VERIFICACIÓN
-- ============================================================================
-- SELECT column_name FROM information_schema.columns
-- WHERE table_name = 'plantillas' ORDER BY ordinal_position;

COMMIT;
