# Feature: Botón "Completar Info" en tarjetas de Solicitudes (móvil)

## Fecha
03/07/2026

## Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `src/config/initDb.js` | Nuevas columnas en `solicitudes` + tabla `solicitudes_referencias` |
| `src/config/initDb.pg.js` | Ídem para PostgreSQL |
| `src/controllers/excel.controller.js` | Nuevos controladores: `getSolicitudCompleta` y `actualizarCompletarInfo` |
| `src/routes/excel.routes.js` | Nuevas rutas GET/PUT para completar-info |
| `public/movil/js/solicitudes.js` | Quitar código plus de card + nuevo botón modal formulario |

## Archivos nuevos

| Archivo | Propósito |
|---------|-----------|
| `documentacion/migrar-produccion-completar-info.sql` | Script SQL para migración en producción (ALTER TABLE + CREATE TABLE) |

---

## Cambios realizados

### 1. Base de datos

**Nuevas columnas en `solicitudes`:**
```sql
ALTER TABLE solicitudes ADD COLUMN direccion TEXT;
ALTER TABLE solicitudes ADD COLUMN direccion_trabajo TEXT;
ALTER TABLE solicitudes ADD COLUMN ocupacion TEXT;
ALTER TABLE solicitudes ADD COLUMN ingreso_mensual DECIMAL(12,2);
```

**Nueva tabla `solicitudes_referencias`:**
```sql
CREATE TABLE solicitudes_referencias (
    id SERIAL PRIMARY KEY,
    id_solicitud INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    relacion TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 2. Backend

**`GET /api/excel/solicitudes/:id/completa`** — Devuelve la solicitud con sus campos adicionales + referencias.

**`PUT /api/excel/solicitudes/:id/completar-info`** — Transacción que:
1. Actualiza los campos de la solicitud (código plus, dirección, trabajo, ocupación, ingreso)
2. Elimina referencias existentes
3. Inserta las nuevas referencias

### 3. Frontend móvil

- **Eliminado** el input de código plus que estaba visible en cada card
- **Eliminada** la función `guardarCodigoPlus()`
- **Agregado** botón "✏️ Completar Info" en cada card
- **Agregada** función `abrirCompletarInfoMovil(id)` que:
  - Carga datos existentes desde el backend
  - Muestra modal full-screen con formulario
  - Precarga valores guardados previamente
- **Agregada** función `guardarCompletarInfoMovil(id)` que envía PUT al backend

### Campos del formulario

| Sección | Campos |
|---------|--------|
| 👤 Datos del Cliente | Nombre, cédula, celular (solo lectura) |
| 📋 Información Adicional | Código Plus, Dirección, Dir. Trabajo, Ocupación, Ingreso Mensual |
| 👥 Referencias (x3) | Nombres, Teléfono, Relación (Amigo/Familiar/Vecino/Compañero/Otro) |

## Migración en producción

Ejecutar `documentacion/migrar-produccion-completar-info.sql` en la base de datos PostgreSQL de Render.

## ⚠️ Recordatorio
1. Limpiar caché del navegador (`Ctrl+F5`)
2. Ejecutar el script SQL de migración en producción
3. Reiniciar el servidor
