# 🐛 ARCHIVOX — CORRECCIÓN DE LÓGICA DEL SISTEMA DE LÍDERES Y EQUIPO "SISTEMA"

**Fecha:** 12 de Julio de 2026
**Estado:** ✅ COMPLETADO
**Objetivo:** Corregir la lógica del equipo "Sistema" (técnico/de migración) para que no se comporte como un equipo operativo, y arreglar el flujo de promoción de Líderes.

---

## 🔍 PROBLEMAS DETECTADOS

| # | Problema | Gravedad |
|---|----------|:--------:|
| 1 | El equipo "Sistema" aparece como equipo operativo del Líder | 🔴 Crítico |
| 2 | Un nuevo Líder ve todos los agentes del sistema | 🔴 Crítico |
| 3 | El Dashboard muestra información del equipo "Sistema" (global) | 🔴 Crítico |
| 4 | Un usuario promovido a Líder desaparece del panel de Gestión del Equipo | 🟡 Alto |
| 5 | El panel del Líder consulta información global sin filtrar | 🔴 Crítico |

---

## 🔬 ANÁLISIS DE CAUSAS RAÍZ

### Causa Raíz 1 — `promoverALider()` reutiliza "Sistema"

En `src/controllers/admin.controller.js`:

```
❌ ANTES:
   Buscar equipo activo → encuentra "Sistema" (migración)
                        → hace líder de "Sistema"
                        → Líder ve TODOS los usuarios como sus agentes
                        → Dashboard muestra datos globales

✅ DESPUÉS:
   Buscar equipo activo (EXCLUYENDO "Sistema")
   ├── ¿Tiene equipo real? → hacerlo líder de ese equipo
   └── ¿Solo tiene "Sistema"? → CREAR equipo nuevo "Equipo de {username}"
                                → Líder ve 0 agentes, 0 campañas, 0 gestiones
```

### Causa Raíz 2 — `login()` carga "Sistema" en la sesión

En `src/controllers/auth.controller.js`:

```
❌ ANTES:  SELECT ... WHERE usuario_id = $1 LIMIT 1
          → Devuelve "Sistema" (primer equipo encontrado)
          → session.equipo_id = "Sistema"
          → Todas las queries usan equipo_id = "Sistema" → datos globales

✅ DESPUÉS: SELECT ... WHERE usuario_id = $1 AND nombre != 'Sistema'
            ORDER BY es_lider DESC, nombre ASC LIMIT 1
            ├── ¿Tiene equipo propio? → lo usa
            ├── ¿Es líder pero solo tiene "Sistema"? → AUTO-CREA equipo propio
            └── ¿Usuario normal? → mantiene "Sistema" (compatibilidad)
```

### Causa Raíz 3 — `miEquipo()` prioriza orden incorrecto

En `src/controllers/equipos.controller.js`:

```
❌ ANTES:  SELECT ... WHERE usuario_id = $1 LIMIT 1
          → Devuelve "Sistema" aunque el usuario sea líder de otro equipo

✅ DESPUÉS: ORDER BY es_lider DESC, nombre ASC
           → Prioriza el equipo donde el usuario es líder
           → Si es líder en varios, prioriza alfabéticamente ("Equipo de X" < "Sistema")
```

---

## ✅ CAMBIOS REALIZADOS

### 1. `src/controllers/admin.controller.js` — Fix `promoverALider()`

| Detalle | Valor |
|---------|-------|
| **Líneas modificadas** | ~400-420 |
| **Cambio** | La búsqueda de equipo activo ahora excluye `e.nombre != 'Sistema'`. Si el usuario solo tiene membresía en "Sistema", se crea un equipo nuevo en lugar de reusarlo. |
| **Membresía "Sistema"** | Se conserva por compatibilidad histórica (no se elimina) |
| **Nombre del equipo** | `"Equipo de {username}"` (consistente con el diseño original) |

### 2. `src/controllers/auth.controller.js` — Fix `login()` + Auto-migración

| Detalle | Valor |
|---------|-------|
| **Líneas modificadas** | ~220-280 |
| **Cambio** | La carga del equipo en login ahora: (1) busca equipos excluyendo "Sistema", (2) si el usuario es líder y no tiene equipo propio, auto-crea uno (3) para no-líderes, mantiene "Sistema" como fallback |
| **Auto-migración** | Líderes existentes (promovidos antes de esta corrección) obtienen su equipo propio automáticamente al iniciar sesión |
| **Rollback** | Si falla la creación, se usa "Sistema" como fallback (nunca se bloquea el login) |

### 3. `src/controllers/equipos.controller.js` — Fix `miEquipo()`

| Detalle | Valor |
|---------|-------|
| **Líneas modificadas** | ~520-530 |
| **Cambio** | Añadido `ORDER BY eu.es_lider DESC, e.nombre ASC` para priorizar el equipo donde el usuario es líder |
| **Compatibilidad** | Usuarios sin equipo propio o sin liderazgo siguen viendo "Sistema" |

---

## 📊 MAPA PROBLEMA → SOLUCIÓN

| # | Problema | Causa | Fix | Archivo |
|---|----------|-------|-----|---------|
| 1 | "Sistema" como equipo operativo | `promoverALider` reusaba membresía "Sistema" | Excluir "Sistema", crear equipo nuevo | `admin.controller.js` |
| 2 | Líder ve todos los agentes | `equipo_id = Sistema` en sesión | Login busca equipos excluyendo "Sistema" | `auth.controller.js` |
| 3 | Dashboard muestra datos globales | `miEquipo` retornaba "Sistema" | `ORDER BY es_lider DESC` prioriza equipo propio | `equipos.controller.js` |
| 4 | Usuario promovido desaparece | Estado inconsistente heredado de "Sistema" | Equipo nuevo no hereda estados previos | `admin.controller.js` |
| 5 | Consultas SQL globales | `equipo_id` apuntaba a "Sistema" | Sesión ahora recibe el `equipo_id` correcto | `auth.controller.js` |

---

## 🔄 FLUJO CORREGIDO

```
SuperAdmin
  ├── ⬆️ Promover a Líder → CREA "Equipo de [username]" (NUNCA reusa "Sistema")
  ├── 👑 Revocar Líder → quita es_lider, pasa a Agente
  ├── Gestionar equipos → ve todos los equipos (incluyendo "Sistema")
  └── Ver estadísticas → globales del sistema

NUEVO Líder (promovido después del fix)
  ├── Dashboard → 0 agentes, 0 campañas, 0 solicitudes, 0 gestiones ✅
  ├── Gestión del Equipo → su equipo vacío "Equipo de [username]"
  ├── Crear Agentes → se asignan a su equipo
  └── Solo ve datos de SU equipo

LÍDER EXISTENTE (promovido antes del fix)
  ├── Al iniciar sesión → MIGRACIÓN AUTOMÁTICA
  ├── Se crea "Equipo de [username]" con él como líder
  ├── Dashboard → ahora muestra SOLO sus datos (no los globales)
  └── Conserva membresía en "Sistema" (compatibilidad)

Usuario normal (agente/user)
  ├── Sin cambios → sigue viendo "Sistema" como antes
  └── Compatibilidad total mantenida
```

---

## 📝 NOTAS TÉCNICAS

- **0 nuevas migraciones** — solo cambios de lógica en controladores
- **Backward compatible** — todos los endpoints existentes siguen funcionando
- **SuperAdmin no afectado** — sigue viendo todos los equipos incluyendo "Sistema"
- **Equipo "Sistema" permanece en BD** — solo para compatibilidad histórica, excluido de toda lógica funcional del Líder
- **Auto-migración transparente** — los líderes existentes se migran automáticamente al iniciar sesión, sin intervención manual

---

*Documento generado automáticamente por Buffy (AI Agent)*
*Proyecto: ARCHIVOX v3.0 — Corrección de Lógica de Líderes y Equipo Sistema*
