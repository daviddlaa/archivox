# Informe de Corrección: Errores al promover usuarios a Líder y administración de equipos

**Fecha:** Julio 2026  
**Archivos modificados:**
- `src/controllers/admin.controller.js`
- `src/controllers/equipos.controller.js`
- `src/routes/equipos.routes.js`

---

## Error 1 & 4: Unique constraint violation + 500 en `promoverALider`

### Síntoma

```
POST /api/admin/usuarios/:id/promover-lider
HTTP 500

duplicate key value violates unique constraint "idx_equipo_usuario_unico_activo"
```

### Causa raíz

En `admin.controller.js` → `promoverALider()`, la función primero verifica si el usuario tiene un equipo activo **excluyendo "Sistema"**:

```javascript
WHERE eu.usuario_id = $1 AND eu.fecha_salida IS NULL AND e.nombre != 'Sistema'
```

Si el usuario **solo** tiene membresía en "Sistema" (caso común), el query retorna 0 filas, por lo que el código entra al `else` e intenta:

1. Crear un nuevo equipo (`INSERT INTO equipos`)
2. **Insertar una nueva membresía** (`INSERT INTO equipo_usuarios`)

Pero el usuario **ya tiene un registro activo** en "Sistema" con `fecha_salida IS NULL`. El índice único parcial `idx_equipo_usuario_unico_activo` exige que un usuario tenga **como máximo un** registro activo. El `INSERT` lo viola → error 23505 de PostgreSQL → 500.

### Corrección aplicada

**Archivo:** `src/controllers/admin.controller.js` — función `promoverALider`

Antes de crear el nuevo equipo y la nueva membresía, se **cierra explícitamente cualquier membresía activa** que el usuario tenga (incluyendo "Sistema"):

```javascript
await client.query(
    `UPDATE equipo_usuarios
     SET fecha_salida = CURRENT_TIMESTAMP, motivo_salida = 'promovido_a_lider'
     WHERE usuario_id = $1 AND fecha_salida IS NULL`,
    [id]
);
```

Luego se crea el equipo y se inserta la nueva membresía sin conflictos.

**Flujo completo ahora:**

| Escenario | Acción |
|---|---|
| Usuario ya tiene equipo real (no "Sistema") | Solo actualiza `es_lider = 1` en su membresía existente |
| Usuario solo tiene "Sistema" o ninguna membresía | Cierra membresía activa → crea nuevo equipo → inserta nueva membresía como líder |
| Usuario ya es líder (`rol = 'lider'`) | Retorna 400: "El usuario ya es líder" |

---

## Error 2: 400 Bad Request en `asignarLider`

### Síntoma

```
PUT /api/equipos/1/asignar-lider
HTTP 400

El usuario no pertenece a este equipo o está inactivo
```

### Causa raíz

En `equipos.controller.js` → `asignarLider()`, el código original verificaba si el usuario pertenecía al equipo y, si no, retornaba 400 sin hacer nada más. No era **idempotente** ni manejaba el caso de que el usuario estuviera en otro equipo.

### Corrección aplicada

**Archivo:** `src/controllers/equipos.controller.js` — función `asignarLider`

Se reestructuró la lógica dentro de una transacción para cubrir todos los casos:

**Caso A — El usuario ya pertenece al equipo (idempotente):**
1. Quitar `es_lider` al líder anterior: `UPDATE ... SET es_lider = 0`
2. Asignar `es_lider = 1` al usuario

*Si el usuario ya era el líder, se hace 1→0→1, quedando igual. Sin duplicados.*

**Caso B — El usuario NO pertenece al equipo:**
1. Demover al líder actual del equipo destino: `UPDATE ... SET es_lider = 0`
2. Cerrar membresía previa del usuario (si existe en otro equipo): `UPDATE ... SET fecha_salida = NOW()`
3. Insertar nueva membresía en el equipo destino con `es_lider = 1`

**Caso C — El usuario no tiene ninguna membresía activa:**
- El paso 2 afecta 0 filas (no hay error, solo no actualiza nada)
- El paso 3 crea la membresía normalmente

---

## Error 3: 404 + HTML al eliminar equipo

### Síntoma

```
DELETE /api/equipos/2
HTTP 404

Unexpected token '<'  ← el frontend intenta parsear HTML como JSON
```

### Causa raíz

No existía una ruta `DELETE /api/equipos/:id` en el router. Express, al no encontrar un `router.delete()` para ese path, devolvía su página 404 por defecto en **HTML**, no JSON. El frontend intentaba `res.json()` sobre HTML, causando el error de parseo.

Tampoco existía la función controladora para eliminar equipos.

### Corrección aplicada

**Archivo:** `src/controllers/equipos.controller.js`

Se agregó la función `eliminar()`:

```javascript
async function eliminar(req, res) {
    // 1. Verifica que el equipo existe → 404 JSON si no
    // 2. DELETE FROM equipos WHERE id = $1 (CASCADE elimina relaciones)
    // 3. Audita la operación
    // 4. Retorna JSON { mensaje: "Equipo X eliminado correctamente" }
}
```

**Archivo:** `src/routes/equipos.routes.js`

Se agregó la ruta:

```javascript
router.delete('/:id', requiresRole('superadmin'), equiposController.eliminar);
```

Todas las respuestas ahora son **JSON consistente**, nunca HTML.

---

## Referencia: Índice único `idx_equipo_usuario_unico_activo`

Definición en PostgreSQL:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_equipo_usuario_unico_activo
    ON equipo_usuarios(usuario_id) WHERE fecha_salida IS NULL;
```

**Propósito:** Garantizar que un usuario tenga **como máximo un** registro activo en `equipo_usuarios`. PostgreSQL permite múltiples `NULL` en un índice único, por lo que un usuario puede tener múltiples registros históricos (con `fecha_salida` no nula), pero solo uno activo.

**Reglas que todo flujo debe respetar:**

| Situación | Acción correcta |
|---|---|
| Usuario ya está en el equipo | Solo actualizar `es_lider` (UPDATE, no INSERT) |
| Usuario cambia de equipo | Cerrar membresía anterior (`fecha_salida`), luego INSERT |
| Usuario sin equipo | INSERT directo (no hay registro activo que conflicte) |
| Re-asignar líder | Solo UPDATE `es_lider` en registros existentes |

**Nunca** debe hacerse un `INSERT INTO equipo_usuarios` para un usuario que ya tenga `fecha_salida IS NULL` en otro registro de la misma tabla.
