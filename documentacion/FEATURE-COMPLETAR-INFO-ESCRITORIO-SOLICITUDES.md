# Feature: Completar Info - Versión Escritorio (Solicitudes)

## Fecha
Julio 3, 2026

## Archivo modificado
- `public/desktop/js/solicitudes.js`

## Cambios realizados

### 1. `abrirCompletar(id)` — Nuevo modal con formulario completo
- **Antes:** Modal simple con solo Código Plus + Observaciones
- **Ahora:**
  1. Hace fetch a `GET /api/excel/solicitudes/:id/completa` para precargar datos existentes
  2. Muestra datos del cliente (nombre, cédula, celular) en modo solo lectura
  3. Formulario con campos:
     - 🔢 **Código Plus** (input text)
     - 📍 **Dirección** (input text)
     - 🏢 **Dirección de Trabajo** (input text)
     - 💼 **Ocupación** (input text)
     - 💰 **Ingreso Mensual** (input number, step 0.01)
  4. **3 Referencias** (cada una con nombre, teléfono y relación) — precargadas desde el servidor si existen
  5. Botones: Cancelar / 💾 Guardar

### 2. `guardarCompletar(id)` — Guarda todos los campos
- **Antes:** Solo guardaba Código Plus vía endpoint separado
- **Ahora:**
  1. Recolecta todos los campos del formulario
  2. Recolecta las 3 referencias (nombre, teléfono, relación)
  3. Envía `PUT /api/excel/solicitudes/:id/completar-info` con toda la data en una transacción
  4. Muestra estado de carga en el botón
  5. Al guardar: alerta de éxito → cierra modal → recarga datos (`init()`)
  6. Manejo de errores con mensajes al usuario

## Backend utilizado (sin cambios)
- `GET /api/excel/solicitudes/:id/completa` — Obtiene solicitud + referencias
- `PUT /api/excel/solicitudes/:id/completar-info` — Guarda en transacción (actualiza solicitud + reemplaza referencias)

## Notas
- El modal precarga los datos existentes del servidor, no solo los de la card
- Las referencias se guardan completas (se eliminan las anteriores y se insertan las nuevas)
- El campo Observaciones fue removido (no forma parte del nuevo esquema)
