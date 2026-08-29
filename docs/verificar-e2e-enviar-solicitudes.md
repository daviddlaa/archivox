# Verificación E2E del flujo "Enviar a" + reasignación del líder (agente sin líder → agente con líder)

> **Estado:** ✅ Ejecutada (entorno local SQLite)
> **Fecha:** 28/08/2026
> **Ámbito:** Backend + trazabilidad + notificaciones + auditoría del nuevo dominio de envíos entre agentes.

---

## 1. Objetivo

Validar de punta a punta (sin tocar producción ni exponer credenciales reales) el flujo:

1. Un **agente sin líder** envía una/más solicitudes a un **agente con líder** (campaña tripartita).
2. Las **tres partes** ven la campaña: remitente, agente destino y líder del destino.
3. El **líder** puede **reasignar** la campaña a otro agente de su mismo equipo (conservando la traza del destino original).

Este es el flujo implementado en `docs/feature-enviar-solicitud-agentes.md` y ajustado en
`docs/fix-agentes-con-lider-filtros.md` (selector de destino, `puede_enviar`).

---

## 2. Escenario montado (SQLite local `database.db`)

| Usuario | Rol | Equipo | Papel |
|---|---|---|---|
| `widgettest` | `user` (no superadmin) | Solo "Sistema" | **Remitente** (agente sin líder) → `puede_enviar=true` |
| `e2e_lider` | `lider` | `E2E Team` (id 4, es_lider=1) | **Líder** → `puede_enviar=false` |
| `e2e_agente` | `agente` | `E2E Team` (es_lider=0) | **Destino** original |
| `e2e_agente2` | `agente` | `E2E Team` (es_lider=0) | **Nuevo destino** (reasignación) |

- Solicitud de prueba: `id_solicitud = 605669`, `estado='nueva'`, `campana_id=NULL`, dueña: `widgettest`.
- Todos con contraseña de prueba `e2e12345` (solo local).

---

## 3. Pasos y resultados (curl contra `http://localhost:3998`, `DATABASE_URL= NODE_ENV=development`)

### 3.1 Login remitente
```
POST /api/auth/login {username:'widgettest', password:'e2e12345'}
```
→ `rol='user'`, `equipo_id=1` ("Sistema"), `es_lider=false`.

### 3.2 Flag `puede_enviar`
```
GET /api/auth/sesion
```
→ `"puede_enviar":true` → el **botón "Enviar a" se muestra** para `widgettest`. ✓

### 3.3 Selector de destino
```
GET /api/equipos/agentes-con-lider
```
→ devuelve `e2e_agente` (19) y `e2e_agente2` (20), ambos de `E2E Team` (id 4),
con `lider_nombre: "E2E Líder"`, métricas de velocidad y `es_recomendado`. ✓

### 3.4 Enviar → crear campaña tripartita
```
POST /api/gestiones-maestro/enviar-solicitudes
  { destino_id: 19, solicitudes_ids: [605669], comentario: "TEST E2E local" }
```
→ `{"id":19,"mensaje":"1 solicitud(es) enviada(s) a E2E Agente 1","total":1}` ✓
- Campaña `id=19`, `nombre="Envío de Widget Test → E2E Agente 1"`, `usuario_id=13` (remitente),
  `asignado_a=19` (destino), `equipo_id=4` (equipo del destino), `estado='activa'`.

### 3.5 Las tres vistas
- **Destino** (`e2e_agente`, rol `agente`): ve la campaña `asignado_a=19` (vía `gm.asignado_a`). ✓
- **Líder** (`e2e_lider`, rol `lider`): ve la campaña `equipo_id=4` (vía `gm.equipo_id`), y su sesión
  devuelve `"puede_enviar":false` → **botón "Enviar a" oculto** para el líder. ✓

### 3.6 Reasignación del líder
```
POST /api/gestiones-maestro/19/reasignar-agente { nuevo_agente_id: 20 }
```
→ `{"mensaje":"Solicitud reasignada a E2E Agente 2","nuevo_agente_id":20}` ✓

---

## 4. Verificación a nivel de datos (SQLite)

### 4.1 Trazabilidad `envios_solicitudes`
```sql
SELECT remitente_id, destino_id, equipo_id, campana_id, reasignada, nuevo_destino_id, reasignada_por
FROM envios_solicitudes WHERE campana_id = 19;
```
```
remitente_id=13 | destino_id=19 | equipo_id=4 | campana_id=19
reasignada=1 | nuevo_destino_id=20 | reasignada_por=18
```
→ Se **conserva** el destino original (19) y se registra la reasignación (20) en el mismo registro. ✓

### 4.2 Notificaciones generadas (4 correctas)
| Titulo | Destinatario |
|---|---|
| 📥 Recibiste 1 solicitud(es) | 19 (destino) — prioridad alta |
| 📋 Tu agente E2E Agente 1 recibió 1 solicitud(es) | 18 (líder) |
| 🔄 Tu solicitud fue reasignada | 13 (remitente) |
| 🔄 Solicitud reasignada | 19 (destino original) |
| 📥 Recibiste una solicitud reasignada | 20 (nuevo destino) |

### 4.3 Auditoría `audit_log`
```
solicitud.enviada     (widgettest 13, campaña 19)  detalle {destino_id:19, equipo_id:4, cantidad:1}
solicitud.reasignada  (e2e_lider 18, campaña 19)   detalle {anterior:19, nuevo:20}
```

---

## 5. Conclusión

El flujo completo funciona correctamente end-to-end:
- El **agente sin líder** envía (selector filtra a agentes con líder activo y excluye "Sistema").
- La **campaña tripartita** es visible por las tres partes.
- El **líder** reasigna a un agente de su equipo con **trazabilidad + notificaciones + auditoría**.
- El flag `puede_enviar` muestra/oculta el botón "Enviar a" coherentemente.

Pendiente (opcional): repetir el mismo ciclo **contra producción** (PostgreSQL) con usuarios y
datos reales, que requiere credenciales (afuera de este repo).

---

## 6. Archivos

- No se modificó código en esta verificación (solo datos locales + `curl`).
- Documentación de la feature: `docs/feature-enviar-solicitud-agentes.md`,
  `docs/fix-agentes-con-lider-filtros.md`.
