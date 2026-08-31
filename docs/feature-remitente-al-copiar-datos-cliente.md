# Feature: Anexar nombre del remitente al copiar "nombre y cédula" en campañas

> **Estado:** ✅ Implementada
> **Fecha:** 30/08/2026
> **Ámbito:**
> - Backend — `src/controllers/gestionesMaestro.controller.js` (`getGestionMaestroById`)
> - Frontend desktop — `public/desktop/js/gestion-lote.js`
> - Frontend móvil — `public/movil/js/gestion-lote.js`

---

## 1. Contexto / problema

Al abrir las solicitudes de una campaña en `gestion-lote` (desktop y móvil), el agente puede copiar "nombre y cédula" del cliente tocando la tarjeta. Cuando la campaña fue **asignada por otro agente del sistema** (clon creado por "Asignar a varios", con `usuario_id = remitente` y `asignado_a = destino`), el agente quiere guardar el contacto en el teléfono del cliente indicando **quién envió/remitió esa campaña**, para que el cliente sepa con quién fue atendido.

## 2. Solución elegida

Al copiar `nombre y cédula` dentro de una campaña, el texto copiado pasa a ser:

```
<Nombre> - <Cédula> - <Nombre del remitente>
```

**Excepto** cuando la campaña es del propio agente: si `datosGestion.usuario_id === sesion.usuario.id` (el agente creó/gestiona su propia campaña), **no** se anexa el remitente.

Decisiones confirmadas:
- **Qué se anexa:** el **nombre (display)** del usuario remitente (campo `usuarios.nombre`), no el `username` de login.
- **Cuándo NO:** cuando la campaña es propia del agente (`usuario_id === yo`).
- **Alcance:** solo `gestion-lote` (desktop y móvil). La lista personal de solicitudes `solicitudes.js` queda sin cambios (no hay "remitente de campaña" ahí).

---

## 3. Backend

### 3.1 `getGestionMaestroById` (`src/controllers/gestionesMaestro.controller.js`)

El SELECT de la campaña ahora incluye el nombre del usuario que la creó/remitió:

```sql
SELECT gm.*, u.nombre AS remitente_nombre
FROM gestiones_maestro gm
LEFT JOIN usuarios u ON u.id = gm.usuario_id
WHERE ...
```

El spread `{...gestion}` propaga `remitente_nombre` a la respuesta → `datosGestion.remitente_nombre` queda disponible en el frontend. El LEFT JOIN es inocuo si `usuario_id` es NULL (campaña histórica/sin remitente) y funciona igual en SQLite y PostgreSQL (el wrapper de `db.js` no transforma nada aquí).

---

## 4. Frontend

### 4.1 Desktop (`public/desktop/js/gestion-lote.js`)

- En `copiarNombreCedula`: tras armar `texto = "<nombre> - <cédula>"`, se llama a la nueva helper `anexarRemitenteCampana(texto)`.
- Nueva helper `anexarRemitenteCampana(texto)`:
  - Si no hay `datosGestion.remitente_nombre` → devuelve el texto sin cambios.
  - Si la campaña es propia (`Number(datosGestion.usuario_id) === Number(sesion.usuario.id)`) → sin cambios.
  - Si no es propia y el remitente tiene nombre → `texto + ' - ' + remitente`.
- No se toca el `onclick` de la tarjeta; la decisión se resuelve dentro de la función con variables de ámbito de página (`datosGestion`, `sesion`).

### 4.2 Móvil (`public/movil/js/gestion-lote.js`)

Aplica exactamente la misma lógica en `copiarNombreCedula` y su helper `anexarRemitenteCampana`. `datosGestion` y `sesion` ya existen como variables de ámbito de página.

---

## 5. Casos borde

- **Campaña propia del agente** (`usuario_id === yo`) → no se anexa remitente.
- **Campaña sin remitente** (`usuario_id` NULL o `remitente_nombre` vacío) → no se anexa nada.
- **Sesión no autenticada / sin `sesion.usuario`** → guardas evitan crash, se comporta como no-propia (anexa si hay remitente). Aplicación real siempre autenticada.
- **Remitente con nombre vacío** (usuario sin `nombre`) → no se anexa (salida limpia).

---

## 6. Verificación

- `node --check` de `src/controllers/gestionesMaestro.controller.js`, `public/desktop/js/gestion-lote.js`, `public/movil/js/gestion-lote.js` ✓.
- Prueba local en SQLite (`DATABASE_URL= NODE_ENV=development node app.js`, Node 22):
  - Login + `GET /api/gestiones-maestro/1` → respuesta incluye `remitente_nombre: "David"` y `usuario_id: 1`.
  - Regla UI: campaña propia (`usuario_id === sesion.usuario.id`) no anexa; campaña ajena (clon con `usuario_id = remitente ≠ yo`) anexa `- <remitente_nombre>`.
- No se ejecutó nada contra la Postgres de producción.

---

## 7. Implicaciones

- **Backwards-compatible:** `remitente_nombre` es un campo nuevo de solo lectura; no rompe contratos existentes.
- **Solo lectura de `usuarios.nombre`:** no se exponen datos sensibles (solo el nombre ya visible al remitente).
- **Nota:** durante la verificación local se actualizó la contraseña del usuario `daviddlaa` (id 1) a `Testpassword1` en el `database.db` local (la original no se conservó). Es la BD SQLite de desarrollo; no afecta producción.

---

## 8. Archivos tocados

- `src/controllers/gestionesMaestro.controller.js` — `getGestionMaestroById`: SELECT con `LEFT JOIN usuarios` y `remitente_nombre`.
- `public/desktop/js/gestion-lote.js` — `copiarNombreCedula` usa `anexarRemitenteCampana` (nueva helper).
- `public/movil/js/gestion-lote.js` — idem.