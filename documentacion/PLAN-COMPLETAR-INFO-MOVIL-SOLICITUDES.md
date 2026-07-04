# PLAN: Botón "Completar Info" en tarjetas de Solicitudes (versión móvil)

## 📋 Resumen

Reemplazar el campo "Código Plus" que actualmente está visible en cada card de Solicitudes (móvil) por un botón **"Completar Info"** que abre un modal con un formulario completo de información adicional del cliente, incluyendo referencias personales.

---

## 🔍 Diagnóstico: ¿El código plus ya funciona?

**SÍ, el código plus funciona correctamente.** No hay bugs.

### Backend (ya implementado)
- **Endpoint:** `PUT /api/excel/solicitudes/:id/codigo-plus`
- **Controlador:** `actualizarCodigoPlus` en `src/controllers/excel.controller.js` (línea 849)
- **Query SQL:** `UPDATE solicitudes SET codigo_plus = $1, fecha_actualizacion = CURRENT_TIMESTAMP WHERE id_solicitud = $2 AND usuario_id = $3`
- **Respuesta:** JSON con mensaje y datos actualizados

### Frontend (ya implementado)
- **Función:** `guardarCodigoPlus(input)` en `public/movil/js/solicitudes.js` (línea 553)
- **Disparador:** `onblur` del input — cuando el input pierde el foco, se envía el PUT
- **Feedback visual:** Amarillo (guardando) → Verde (ok) / Rojo (error)

### Base de datos
- **Columna:** `codigo_plus TEXT` en tabla `solicitudes` (ambos motores: SQLite y PostgreSQL)
- **Schemas:** `src/config/initDb.js` línea 27, `src/config/initDb.pg.js` línea 31

---

## 🗄️ Estrategia de Base de Datos

### Opciones para almacenar los nuevos campos

| Opción | Descripción | Pros | Contras |
|--------|-------------|------|---------|
| **A** ⭐ | Agregar columnas a la tabla `solicitudes` existente vía `ALTER TABLE` | ✅ Simple<br>✅ Una tabla, una consulta<br>✅ Ya existe patrón (`codigo_plus`) | ❌ Tabla se vuelve muy ancha<br>❌ Migración en producción requiere ALTER TABLE |
| **B** | Nueva tabla `solicitudes_info_adicional` (1-a-1) | ✅ Separación de concerns<br>✅ No afecta tabla principal<br>✅ Fácil de extender | ❌ JOIN adicional en consultas<br>❌ Más complejo |
| **C** | Tabla `solicitudes_info_adicional` + `solicitudes_referencias` | ✅ Modelo normalizado<br>✅ Las 3 referencias como filas separadas | ❌ 2 tablas nuevas<br>❌ Múltiples JOINs |

### ✅ Recomendación: **Opción A — Agregar columnas a `solicitudes`**

**Motivo:** Es la estrategia más simple y consistente con el código existente. El campo `codigo_plus` ya se guarda así. Además, las consultas actuales (`SELECT s.* FROM solicitudes s`) ya traerán automáticamente los nuevos campos sin modificar queries existentes.

### Nuevas columnas a agregar

```sql
-- PostgreSQL
ALTER TABLE solicitudes 
ADD COLUMN IF NOT EXISTS direccion TEXT,
ADD COLUMN IF NOT EXISTS direccion_trabajo TEXT,
ADD COLUMN IF NOT EXISTS ocupacion TEXT,
ADD COLUMN IF NOT EXISTS ingreso_mensual DECIMAL(12,2);

-- SQLite (better-sqlite3)
ALTER TABLE solicitudes ADD COLUMN direccion TEXT;
ALTER TABLE solicitudes ADD COLUMN direccion_trabajo TEXT;
ALTER TABLE solicitudes ADD COLUMN ocupacion TEXT;
ALTER TABLE solicitudes ADD COLUMN ingreso_mensual REAL;
```

### Tabla para referencias

Para las **3 referencias** se creará una tabla separada `solicitudes_referencias` porque:
- Es una relación 1 solicitud → N referencias (aunque limitemos a 3)
- Las referencias son datos repetitivos (misma estructura)
- Es más limpio que tener `ref1_nombre`, `ref1_telefono`, `ref1_relacion`, `ref2_nombre`, etc. en la tabla `solicitudes`

```sql
CREATE TABLE IF NOT EXISTS solicitudes_referencias (
    id SERIAL PRIMARY KEY,
    id_solicitud INTEGER NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    relacion TEXT,  -- 'Amigo', 'Familiar', 'Vecino', etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_solicitudes_referencias_solicitud 
ON solicitudes_referencias(id_solicitud);
```

### Migración en producción

Se creará un script `migrar-produccion-completar-info.js` que ejecute el `ALTER TABLE` y `CREATE TABLE` en el orden correcto. Este script se ejecutará manualmente en producción UNA SOLA VEZ.

---

## 🎨 Frontend: Modal "Completar Info" (móvil)

### Cambio 1: Quitar input de código plus de la card

**Archivo:** `public/movil/js/solicitudes.js`

**Se elimina** este bloque del template de `renderizarCards()`:
```html
<!-- Código Plus -->
<div class="input-codigo-plus-container" style="margin: 8px 0;">
    <input type="text" class="input-codigo-plus" value="${d.codigo_plus || ''}" 
           data-id="${d.id_solicitud}" placeholder="Código Plus" ...>
</div>
```

### Cambio 2: Agregar botón "Completar Info"

**Se reemplaza** el bloque eliminado por un botón en la fila de `botones-contacto`:

La fila de 3 botones actual:
```
[📞] [💬] [📋]
```

Pasa a ser 4 botones:
```
[📞] [💬] [📋] [✏️ Info]
```

O se agrega un botón aparte debajo de los botones de contacto:
```html
<button onclick="event.stopPropagation(); abrirCompletarInfoMovil('${d.id_solicitud}')" 
        style="width:100%; padding:8px; background:#e0e7ff; border:none; border-radius:6px; font-size:11px; cursor:pointer; font-weight:600;">
    ✏️ Completar Info
</button>
```

### Cambio 3: Nuevo modal con formulario

**Función nueva:** `abrirCompletarInfoMovil(id)`

El modal (full-screen, como los existentes) contendrá:

#### Sección 1: Datos del Cliente (solo lectura)
```
👤 Juan Pérez
🆔 1234567890
📱 0987654321
```

#### Sección 2: Información Adicional

| Campo | Tipo | ID | BD |
|-------|------|----|----|
| 📦 Código Plus | `input text` | `codigo-plus-completar` | `solicitudes.codigo_plus` |
| 📍 Dirección | `input text` | `direccion-completar` | `solicitudes.direccion` |
| 🏢 Dir. Trabajo / Ocupación | `input text` | `direccion-trabajo-completar` | `solicitudes.direccion_trabajo` |
| 💼 Ocupación | `input text` | `ocupacion-completar` | `solicitudes.ocupacion` |
| 💰 Ingreso Mensual | `input number` (decimal) | `ingreso-mensual-completar` | `solicitudes.ingreso_mensual` |

#### Sección 3: Referencias (3 bloques iguales)

Cada referencia tendrá:

| Campo | Tipo | ID |
|-------|------|----|
| 👤 Nombres y Apellidos | `input text` | `ref-${n}-nombre` |
| 📞 Teléfono | `input tel` | `ref-${n}-telefono` |
| 🤝 Relación | `select` (Amigo / Familiar / Vecino / Otro) | `ref-${n}-relacion` |

Donde `n` = 1, 2, 3.

#### Botón Guardar

```html
<button onclick="guardarCompletarInfoMovil('${id}')" 
        style="width:100%; padding:12px; background:#2563eb; color:white; border:none; border-radius:8px; font-weight:600;">
    💾 Guardar Información
</button>
```

### Cambio 4: Nuevo endpoint backend

**Nuevo endpoint:** `PUT /api/excel/solicitudes/:id/completar-info`

**Controlador nuevo:** `actualizarCompletarInfo` en `excel.controller.js`

Este endpoint recibirá en el body:
```json
{
    "codigo_plus": "CP123",
    "direccion": "Av. Siempre Viva 123",
    "direccion_trabajo": "Calle Trabajo 456",
    "ocupacion": "Ingeniero",
    "ingreso_mensual": 1500.00,
    "referencias": [
        { "nombre": "María López", "telefono": "0999999991", "relacion": "Familiar" },
        { "nombre": "Carlos Ruiz", "telefono": "0999999992", "relacion": "Amigo" },
        { "nombre": "Ana Torres", "telefono": "0999999993", "relacion": "Vecino" }
    ]
}
```

**Lógica del endpoint:**
1. Actualizar `solicitudes` con los campos de información adicional
2. Eliminar referencias existentes para esta solicitud (DELETE WHERE id_solicitud = ?)
3. Insertar las 3 nuevas referencias
4. Responder con éxito

### Cambio 5: Función `getSolicitud` para cargar datos existentes

Se modificará `getSolicitud` (o se creará una versión extendida) para que también devuelva las referencias de la solicitud, permitiendo que al abrir el modal "Completar Info" se precarguen los datos existentes.

**Endpoint extendido:** `GET /api/excel/solicitudes/:id/completa`

Incluirá en la respuesta:
```json
{
    "id_solicitud": 123,
    "codigo_plus": "CP123",
    "direccion": "Av. Siempre Viva 123",
    "direccion_trabajo": "Calle Trabajo 456", 
    "ocupacion": "Ingeniero",
    "ingreso_mensual": 1500.00,
    "referencias": [
        { "nombre": "María López", "telefono": "0999999991", "relacion": "Familiar" },
        ...
    ]
}
```

---

## 📂 Archivos a modificar/crear

| Archivo | Acción | Cambio |
|---------|--------|--------|
| `src/config/initDb.pg.js` | ✏️ Modificar | Agregar CREATE TABLE solicitudes_referencias |
| `src/config/initDb.js` | ✏️ Modificar | Agregar CREATE TABLE solicitudes_referencias |
| `src/controllers/excel.controller.js` | ✏️ Modificar | Agregar `actualizarCompletarInfo` y extender `getSolicitud` |
| `src/routes/excel.routes.js` | ✏️ Modificar | Agregar ruta PUT y GET para completar-info |
| `public/movil/js/solicitudes.js` | ✏️ Modificar | Quitar campo código plus de card + agregar botón + crear modal + funciones |
| `documentacion/migrar-produccion-completar-info.js` | ➕ Nuevo | Script de migración con ALTER TABLE y CREATE TABLE |
| `documentacion/FEATURE-COMPLETAR-INFO-MOVIL.md` | ➕ Nuevo | Documentación final del feature |

---

## ⚠️ Aristas y Consideraciones

### 1. Compatibilidad con desktop
El modal "Completar Info" **solo se implementa en móvil por ahora**. El botón "✏️ Completar" existente en escritorio NO se modifica. En el futuro podría unificarse.

### 2. Función `guardarCodigoPlus` existente
La función `guardarCodigoPlus(input)` que guarda en `onblur` **se eliminará** del archivo móvil ya que ya no hay input de código plus en la card. El código plus ahora se guardará exclusivamente desde el modal.

### 3. Carga de datos existentes al abrir modal
Si el usuario ya guardó información previamente, al abrir el modal debe precargarse:
- Código Plus, dirección, ocupación, ingreso → desde `datosFilas[id]` (ya está en memoria si viene del listado)
- Referencias → requieren fetch extra a `GET /api/excel/solicitudes/:id/completa`

### 4. Validación de datos
- **Código Plus:** opcional, texto libre
- **Dirección, Dirección Trabajo, Ocupación:** opcionales
- **Ingreso Mensual:** opcional, se validará como número decimal
- **Referencias:** opcionales, pero si se ingresa un nombre se requiere al menos teléfono o relación

### 5. Seguridad
- Todas las consultas incluyen `usuario_id` para asegurar que solo el propietario modifique sus datos
- Las referencias se eliminan e insertan en una transacción

### 6. Performance
- Las nuevas columnas en `solicitudes` no afectan el rendimiento de las consultas existentes (`SELECT *` ya las incluirá)
- La tabla `solicitudes_referencias` tendrá pocos registros (máx 3 por solicitud)
- El JOIN para obtener referencias solo se hará cuando se abra el modal (bajo demanda)

### 7. Migración en producción existente
Actualmente hay scripts `migrar-produccion.js` y `migrar-produccion-relaciones.js` como referencia de cómo se hacen migraciones. Se seguirá el mismo patrón.

---

## ✅ Criterios de Aceptación

1. ✅ El campo "Código Plus" ya no aparece en las cards de solicitudes móvil
2. ✅ Aparece un botón "✏️ Completar Info" en cada card
3. ✅ Al hacer clic se abre un modal full-screen con el formulario completo
4. ✅ Los datos ingresados se guardan correctamente en la BD
5. ✅ Al volver a abrir el modal, los datos guardados se precargan
6. ✅ No se rompe ninguna funcionalidad existente
7. ✅ La migración de BD se ejecuta correctamente en producción

---

**¿Apruebas este plan para proceder con la implementación?**
