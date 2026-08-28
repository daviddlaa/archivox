# Fix: Filtros del selector "Enviar a" (`agentes-con-lider`) — ruido, líder inactivo y 500 en PostgreSQL

> **Estado:** ✅ Implementada
> **Fecha:** 28/08/2026
> **Ámbito:** Backend — `src/controllers/equipos.controller.js`, `src/controllers/gestionesMaestro.controller.js`

---

## 1. Problema

El endpoint `GET /api/equipos/agentes-con-lider` (selector "Enviar a") presentaba **tres** fallos, detectados al comparar contra la BD de producción (usuario `daviddlaa`) y presenciados en el navegador como un `500`:

### 1.1 500 en PostgreSQL por comparación de tipos (boolean vs entero)

La consulta filtraba usuarios activos con `u.is_active = 1`. En **SQLite** la columna `is_active` es `INTEGER` y funciona; en **PostgreSQL** es `BOOLEAN` (`initDb.pg.js:46`), por lo que `is_active = 1` lanza:

```
operator does not exist: boolean = integer
→ 500 Error al cargar agentes
```

La convención del repo para PG es `is_active = TRUE` (ver `admin.controller.js:94`). Este fix por sí solo devolvía `200`, pero aún traía ruido.

### 1.2 Ruido: usuarios del equipo "Sistema" y otros roles

La consulta definía "el agente tiene líder" como *"su equipo tiene algún líder"* (`EXISTS`). El equipo **"Sistema"** (por defecto) contiene a casi todos los usuarios y tiene al `superadmin` como líder, por lo que **cualquier usuario suelto en Sistema "tenía líder" (Super Administrador)**. Para `daviddlaa` devolvía **14** usuarios, muchos "nada que ver":

- Sueltos de "Sistema" (Angelica, Andres, Arsenio, Judith, mayi, mayitagarcia) con "líder: Super Administrador".
- Agentes de otros líderes (VENTAS ×5, Orvemall ×1) — correctos para un selector de toda la organización.

Faltaban los filtros de **rol `agente`** y de **excluir el equipo "Sistema"**.

### 1.3 Líder inactivo no ocultaba su grupo

Ni el `EXISTS` ni el subquery `lider_nombre` comprobaban si el líder estaba activo (`usuarios.is_active`). Al inactivar a un líder, su fila `equipo_usuarios` (`es_lider=1`, sin `fecha_salida`) persiste, y además ninguna desactivación (`toggleActivoAgente` en `equipos.controller.js`, `admin/usuarios/:id/toggle-active`) toca `fecha_salida`, por lo que **el grupo seguía apareciendo** con su líder inactivo.

### 1.4 403 en el remitente: usuario sin líder bloqueado por el equipo "Sistema"

El chequeo del remitente en `enviar-solicitudes` (`remTieneLider`) usaba el mismo `EXISTS` de equipo-con-líder **sin excluir "Sistema"**. Un usuario suelto en "Sistema" (que solo tiene al `superadmin` como líder del equipo por defecto) era tratado como "tiene líder" y se le negaba el envío con `403 Solo los agentes sin líder pueden enviar solicitudes`. Caso real: **Andres** (rol `user`, único equipo = "Sistema") no podía enviar pese a no tener ningún líder real.

---

## 2. Solución

Se endurecieron los filtros en `agentesConLider` (`src/controllers/equipos.controller.js`, consulta 583-603):

1. `u.is_active = 1` → **`u.is_active = TRUE`** (cross-DB, corrige el 500 en PG).
2. **`u.rol = 'agente'`** — solo operativos gestionados (excluye `user`/`lider`/`superadmin`/`admin`).
3. **`e.nombre != 'Sistema'`** — excluye el equipo por defecto (convención del repo, ver `auth.controller.js:268`).
4. **Líder activo** en ambos subqueries:
   - `lider_nombre`: `AND u2.is_active = TRUE`.
   - `EXISTS`: unir con `usuarios ul` y exigir `AND ul.is_active = TRUE`.

Además, para consistencia, en `enviar-solicitudes` (`src/controllers/gestionesMaestro.controller.js`):

- **Destino** (~consulta 1968): el subquery `lider_id` ahora exige **líder activo**, y el destino filtra `rol='agente'` y `e.nombre != 'Sistema'`. Así el backend no acepta enviar dentro de un grupo cuyo líder esté inactivo.
- **Remitente** (`remTieneLider`, ~1953): el `EXISTS` ahora exige que el líder sea de un equipo **`e4.nombre != 'Sistema'`** y **activo** (`ul.is_active = TRUE`). Un usuario suelto en "Sistema" deja de contarse como "tiene líder" y **puede enviar**.

---

## 3. Resultado / Verificación

Consulta validada contra la BD de producción (PostgreSQL) para el usuario `daviddlaa` (id 1):

| Líder | Agentes |
|---|---|
| DAVID GONZALEZ | `prueba`, `usuariogrupo1` |
| VENTAS | ANGEL, DANIEL, DIEGO, EDISON, NICOLE |
| Edison vaca | 0921971107 |

**TOTAL: 8** (antes 14). Los sueltos de "Sistema" ya no aparecen y, si un líder se inactiva, su grupo deja de listarse.

**Validación del remitente** (probada contra producción PostgreSQL):
- `Andres` (id 5, solo "Sistema") → **no tiene líder real → PUEDE enviar** ✓ (antes 403).
- `prueba` (19) y `usuariogrupo1` (11), del equipo de daviddlaa → tienen líder real → **bloqueados** ✓.

Chequeos:
- `node --check` en `equipos.controller.js` y `gestionesMaestro.controller.js` ✅
- Boot local SQLite (`DATABASE_URL= NODE_ENV=development node app.js`) → `GET /api/equipos/agentes-con-lider` responde `200` sin errores ✅
- SQL probado directo en SQLite (3.49) y en PostgreSQL: cláusulas `rol='agente'`, `e.nombre != 'Sistema'`, `is_active = TRUE` y líder activo válidas en ambos motores ✅

---

## 4. Archivos tocados

- `src/controllers/equipos.controller.js` — filtros de `agentesConLider`.
- `src/controllers/gestionesMaestro.controller.js` — validación de destino y de remitente en `enviarSolicitudes`.
- `docs/feature-enviar-solicitud-agentes.md` — nota sobre filtros del selector.
- `docs/ESTADO-PROYECTO.md`, `docs/README.md` — documentación.

---

## 5. UX: ocultar el botón "Enviar a" para quien no puede enviar

**Problema:** el botón "Enviar a" (barra de selección + panel flotante en `solicitudes.html`, desktop y móvil) era **siempre visible** para todos. Un usuario que el backend bloquea (superadmin, o agente con líder real activo) veía el botón y al hacer submit obtenía `403`.

**Contexto insuficiente:** el flag `es_lider`/`rol` de la sesión NO alcanza para saber con certeza si un agente (rol `agente`, `es_lider=false`) tiene líder real — p.ej. `prueba` tiene líder (DAVID) pero `es_lider=false`. Ocultar solo por `es_lider`/`rol` dejaría el botón visible a un agente gestionado que luego recibiría `403`. Haría falta consultar a la BD igual que el backend.

**Solución (flag `puede_enviar`):**
1. `src/controllers/auth.controller.js` — `verificarSesion` (ahora async) computa `puede_enviar` con la **misma** lógica de `remTieneLider`:
   - `false` si el usuario es `superadmin`/`is_superadmin`.
   - `false` si pertenece a un equipo no-"Sistema" con un **líder activo** (`EXISTS` con `e4.nombre != 'Sistema'` y `ul.is_active = TRUE`).
   - en otro caso `true`.
   - Devuelve `usuario: { ...req.session.usuario, puede_enviar }`.
2. Frontend desktop y móvil — nueva variable `_puedeEnviar` + helper `aplicarVisibilidadEnviarA()` que pone `display:none` a los elementos `.btn-enviar`; se setea en `init()` al cargar `/api/auth/sesion`.

**Verificación de la query `puede_enviar` contra producción PostgreSQL (solo lectura):**
- `Andres` (5, solo "Sistema") → `puede_enviar=true` (botón visible) ✓
- `prueba` (19) y `usuariogrupo1` (11) → `false` (oculto) ✓
- `daviddlaa` (1, líder) → `false` (oculto) ✓

Chequeos: `node --check` en `auth.controller.js`, `solicitudes.js` (desktop y móvil) ✅; boot local SQLite + `GET /api/auth/sesion` (401 por guard de auth, sin crash) ✅; query válidad en SQLite y PostgreSQL ✅.

**Archivos:** `src/controllers/auth.controller.js`, `public/desktop/js/solicitudes.js`, `public/movil/js/solicitudes.js`. (Los botones `.btn-enviar` ya existen en `public/desktop/solicitudes.html` y `public/movil/solicitudes.html`; no requieren cambios.)
