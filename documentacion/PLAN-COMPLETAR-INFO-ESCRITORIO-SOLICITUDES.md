# PLAN: Botón "Completar Info" en Solicitudes (versión Escritorio)

## 📋 Resumen

Reemplazar el modal actual de "Completar Información" en la versión de escritorio (que solo tiene código plus + observación) por el mismo formulario completo que ya funciona en móvil: código plus, dirección, dirección trabajo, ocupación, ingreso mensual y 3 referencias.

---

## Estado actual vs objetivo

| Aspecto | Actual (Escritorio) | Objetivo |
|---------|--------------------|----------|
| Botón en card | ✅ Ya existe: "✏️ Completar" en `card-actions` | ✅ Se mantiene igual |
| `abrirCompletar(id)` | ✅ Existe — modal simple (código plus + observación) | 🔄 Reemplazar por formulario completo |
| `guardarCompletar(id)` | ✅ Existe — solo guarda código plus vía PUT `/codigo-plus` | 🔄 Reemplazar por PUT `/completar-info` |
| Campos del formulario | ❌ Solo código plus + observación | ✅ Código Plus, Dirección, Dir. Trabajo, Ocupación, Ingreso Mensual, 3 Referencias |

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `public/desktop/js/solicitudes.js` | Reemplazar `abrirCompletar(id)` y `guardarCompletar(id)` |

**No se necesita:**
- Backend (ya está listo con `PUT /solicitudes/:id/completar-info`)
- BD (ya está migrada)
- HTML (el modal se genera desde JS)

---

## Cambio detallado

### 1. Reemplazar `abrirCompletar(id)`

El modal actual (inline styles, padding 20px):
```
✏️ Completar Información - Solicitud #ID
  - Nombre / Cédula / Celular (solo lectura)
  - Código Plus (input)
  - Observaciones (textarea)
  [Cancelar] [💾 Guardar]
```

Pasará a ser (igual que móvil, pero con el estilo de modal de escritorio usando `crearModal()`):
```
✏️ Completar Información
  - 👤 Cliente / 🆔 Cédula / 📱 Celular (solo lectura)
  
  📋 Información Adicional
    - 📦 Código Plus
    - 📍 Dirección
    - 🏢 Dirección de Trabajo
    - 💼 Ocupación
    - 💰 Ingreso Mensual
  
  👥 Referencias Personales (x3)
    - Referencia #1: Nombre, Teléfono, Relación
    - Referencia #2: Nombre, Teléfono, Relación  
    - Referencia #3: Nombre, Teléfono, Relación
  
  [💾 Guardar Información] [✕ Cerrar]
```

### 2. Reemplazar `guardarCompletar(id)`

En vez de solo guardar código plus vía PUT `/codigo-plus`, ahora enviará todos los campos vía PUT `/completar-info`:

```javascript
function guardarCompletar(id) {
    // Leer todos los campos del formulario
    // Construir objeto con codigo_plus, direccion, direccion_trabajo, 
    //   ocupacion, ingreso_mensual, referencias[]
    // PUT /api/excel/solicitudes/:id/completar-info
    // Mostrar feedback
}
```

### 3. Carga de datos existentes

Se agregará un fetch a `GET /api/excel/solicitudes/:id/completa` al abrir el modal para precargar datos guardados previamente (igual que en móvil).

---

## IDs de los campos del formulario

Los mismos que en móvil (consistencia):

| Campo | ID |
|-------|----|
| Código Plus | `codigo-plus-completar` |
| Dirección | `direccion-completar` |
| Dirección Trabajo | `direccion-trabajo-completar` |
| Ocupación | `ocupacion-completar` |
| Ingreso Mensual | `ingreso-mensual-completar` |
| Referencia #N Nombre | `ref-N-nombre` |
| Referencia #N Teléfono | `ref-N-telefono` |
| Referencia #N Relación | `ref-N-relacion` |

---

## Backend

**No requiere cambios.** Los endpoints ya están implementados y funcionando:
- `GET /api/excel/solicitudes/:id/completa` → devuelve datos + referencias
- `PUT /api/excel/solicitudes/:id/completar-info` → guarda todo en transacción

La BD ya está migrada con las columnas y tabla `solicitudes_referencias`.

---

## Criterios de aceptación

1. ✅ Al hacer clic en "✏️ Completar" se abre un modal con el formulario completo
2. ✅ Los campos precargan datos existentes al abrir el modal
3. ✅ Al guardar, se envían todos los campos al backend
4. ✅ Las referencias se guardan correctamente en `solicitudes_referencias`
5. ✅ No se rompe ninguna funcionalidad existente

---

**¿Apruebas este plan para proceder?**
