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

---

## 2. Solución

Se endurecieron los filtros en `agentesConLider` (`src/controllers/equipos.controller.js`, consulta 583-603):

1. `u.is_active = 1` → **`u.is_active = TRUE`** (cross-DB, corrige el 500 en PG).
2. **`u.rol = 'agente'`** — solo operativos gestionados (excluye `user`/`lider`/`superadmin`/`admin`).
3. **`e.nombre != 'Sistema'`** — excluye el equipo por defecto (convención del repo, ver `auth.controller.js:268`).
4. **Líder activo** en ambos subqueries:
   - `lider_nombre`: `AND u2.is_active = TRUE`.
   - `EXISTS`: unir con `usuarios ul` y exigir `AND ul.is_active = TRUE`.

Además, para consistencia, la validación del destino en `enviar-solicitudes` (`src/controllers/gestionesMaestro.controller.js`, consulta del destino ~1968) ahora también exige **líder activo** en su subquery `lider_id` y filtra destino `rol='agente'` y `e.nombre != 'Sistema'`. Así el backend no acepta enviar dentro de un grupo cuyo líder esté inactivo.

---

## 3. Resultado / Verificación

Consulta validada contra la BD de producción (PostgreSQL) para el usuario `daviddlaa` (id 1):

| Líder | Agentes |
|---|---|
| DAVID GONZALEZ | `prueba`, `usuariogrupo1` |
| VENTAS | ANGEL, DANIEL, DIEGO, EDISON, NICOLE |
| Edison vaca | 0921971107 |

**TOTAL: 8** (antes 14). Los sueltos de "Sistema" ya no aparecen y, si un líder se inactiva, su grupo deja de listarse.

Chequeos:
- `node --check` en `equipos.controller.js` y `gestionesMaestro.controller.js` ✅
- Boot local SQLite (`DATABASE_URL= NODE_ENV=development node app.js`) → `GET /api/equipos/agentes-con-lider` responde `200` sin errores ✅
- SQL probado directo en SQLite (3.49) y en PostgreSQL: cláusulas `rol='agente'`, `e.nombre != 'Sistema'`, `is_active = TRUE` y líder activo válidas en ambos motores ✅

---

## 4. Archivos tocados

- `src/controllers/equipos.controller.js` — filtros de `agentesConLider`.
- `src/controllers/gestionesMaestro.controller.js` — validación de destino en `enviarSolicitudes`.
- `docs/feature-enviar-solicitud-agentes.md` — nota sobre filtros del selector.
- `docs/ESTADO-PROYECTO.md`, `docs/README.md` — documentación.
