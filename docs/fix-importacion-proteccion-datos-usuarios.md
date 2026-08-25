# Fix: Importación Excel — protección de datos entre usuarios (nunca toca registros ajenos)

**Fecha:** Agosto 2026
**Ámbito:** `src/services/excel.service.js`, `src/controllers/excel.controller.js`,
`public/desktop/js/importar.js`, `public/movil/js/importar.js`
**Problema:** Al importar un Excel con la columna `IDSOLICITUD` llena, la búsqueda de
existencia se hacía solo por `id_solicitud` (sin filtrar por usuario) y el UPDATE reasignaba
`usuario_id` al usuario que estaba importando. Si el archivo contenía IDs de solicitudes de
**otro usuario**, esos registros se **robaban** (cambiaban de dueño) y se sobrescribían con
los datos del Excel.

---

## 1. Resumen

En `excel.service.js` existían dos rutas de "existencia" al procesar cada fila:

| Ruta | Antes | Riesgo |
|------|-------|--------|
| ID auto-generado + cédula | `SELECT ... WHERE cedula = ? AND usuario_id = ?` | ✅ Segura (ya filtraba por usuario) |
| `IDSOLICITUD` explícito | `SELECT ... WHERE id_solicitud = ?` **sin usuario** | ❌ **Crítico**: encontraba registros ajenos |

Cuando la segunda ruta encontraba una fila, el `UPDATE` ejecutaba
`SET ... usuario_id = <usuario actual> ...`, por lo que **una importación de otro usuario
reasignaba y sobrescribía las solicitudes ajenas** (pérdida/robo de datos, historial de
gestiones huérfano para el dueño original).

---

## 2. Cambios

### 2.1 `src/services/excel.service.js`

- Ambos `SELECT` de existencia ahora incluyen `usuario_id` en la proyección
  (`SELECT id, id_solicitud, estado, segmento, usuario_id FROM solicitudes ...`).
- **Guard de seguridad** antes del UPDATE (en PostgreSQL y SQLite): si el registro encontrado
  tiene `usuario_id !== usuarioId`, se **omite** la fila:
  - Incrementa `omitidos` y agrega un detalle a `omisiones` (`{ id, motivo: 'pertenece a otro usuario' }`).
  - `continue` — no se inserta ni se actualiza nada.
- Se **eliminó `usuario_id = ...` del UPDATE**: el guard garantiza que solo se actualicen
  registros del usuario actual, y se elimina la reasignación por diseño (defensa en profundidad).
- El servicio ahora retorna `{ total, inserts, updates, omitidos, omisiones, detalles }`.

### 2.2 `src/controllers/excel.controller.js` (`uploadExcel`)

- Agrega `totalOmitidos` y `todasOmisiones` acumulados de todos los archivos.
- La respuesta de `POST /api/excel/upload` ahora incluye `omitidos` (número) y `omisiones`
  (array con `{ id, motivo }`).
- El `mensaje` incluye: `· X omitido(s) por pertenecer a otro usuario` cuando aplica.

### 2.3 Frontends de importación (`public/desktop/js/importar.js`, `public/movil/js/importar.js`)

- En el informe de actualización y en el informe simple se muestra un aviso:
  `⚠️ X registro(s) omitido(s) por pertenecer a otro usuario`.

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Dedupe por cédula al re-subir el mismo Excel (ID auto-generado) | Sin cambios (ya filtraba por usuario) |
| Actualización de registros **propios** al re-subir el Excel | Sin cambios |
| Inserción de filas nuevas | Sin cambios |
| Auditoría de estado/segmento en updates propios | Sin cambios |
| Creación manual de solicitud (`crearSolicitudManual`, advertencia `duplicado_advertencia`) | Sin cambios |

---

## 4. Comportamiento resultante

| Caso | Antes | Ahora |
|------|-------|-------|
| Excel con ID de **otro usuario** | **Robaba/sobrescribía** el registro ajeno | Se **omite** con reporte `omitidos`/`omisiones` y aviso ⚠️ |
| Re-subir el **mismo** Excel del mismo usuario | Actualiza | Actualiza (igual) |
| Excel sin ID (auto-generado) | Inserta copias nuevas | Inserta copias nuevas (igual) |
| Duplicado por cédula del mismo usuario | Actualiza | Actualiza (igual) |

### Nota de uso (demostraciones / usuarios demo)

Para **copiar** datos a otro usuario (ej. preparar un demo), el flujo seguro es:
exportar desde el usuario original → **borrar la columna de ID** → subir al usuario destino.
Con el ID vacío se auto-generan IDs y se insertan copias nuevas sin tocar el original.
Si se sube con IDs ajenos, ahora el sistema **omite esas filas y avisa** (en vez de robarlas).

---

## Verificación

- ✅ `node --check` en los 4 archivos modificados — sin errores de sintaxis.
- ✅ Revisión de código: el guard cubre ambas ramas (PostgreSQL y SQLite); no queda ruta que
  actualice/reasigne registros de otro usuario.
- ⏳ Prueba manual: subir un Excel con IDs de otro usuario desde una cuenta distinta y
  confirmar el aviso `omitido(s)` y que el registro original permanece intacto.

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§4) y módulo Importación Excel (§11.3).
- `docs/anteriores/analisis-solicitud-manual.md` — análisis histórico de la solicitud manual
  (advertencia de duplicados por cédula por usuario).
- `README.md` — tabla de Features Recientes.
