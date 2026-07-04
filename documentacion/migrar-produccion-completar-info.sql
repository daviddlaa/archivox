-- Script de migración para Completar Info en Solicitudes
-- Ejecutar en producción UNA SOLA VEZ

-- PostgreSQL (producción actual)
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS direccion TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS direccion_trabajo TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS ocupacion TEXT;
ALTER TABLE solicitudes ADD COLUMN IF NOT EXISTS ingreso_mensual DECIMAL(12,2);

CREATE TABLE IF NOT EXISTS solicitudes_referencias (
    id SERIAL PRIMARY KEY,
    id_solicitud INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    relacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_referencias_solicitud
ON solicitudes_referencias(id_solicitud);
