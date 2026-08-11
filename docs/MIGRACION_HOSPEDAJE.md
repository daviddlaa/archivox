# Migración de Hosting: Render → Hetzner + Coolify

**Fecha:** 2026-08-11
**Destino:** VPS Hetzner CX22 + Coolify self-hosted
**Tipo de migración:** Completa (app + base de datos)

---

## 1. Situación actual (verificado en el repo)

| Componente | Hoy | Detalle |
|---|---|---|
| App | Render Web Service | Node + Express. Arranca con `node app.js`. No existe `index.js`, script `start`, `Procfile` ni `Dockerfile` → en Render se usa comando de arranque personalizado (`node app.js`) |
| Base de datos | Render Postgres 17 (plan Basic ~$11/mes) | Conexión vía `DATABASE_URL`. El esquema se **auto-crea** en `src/config/initDb.pg.js` si las tablas no existen |
| Pool de BD | `src/config/db.js` | Interfaz unificada SQLite/Postgres. `ssl: { rejectUnauthorized: false }`, `PG_POOL_MAX` (default 6, máx 10) |
| Archivos | `uploads/` (≈10 MB, 9 archivos) | Se guardan en `uploads/` relativo a la raíz (`src/config/multer.config.js:6`). **No están en Git** |
| Scheduler | `recordatorioScheduler` | `setInterval` dentro del mismo proceso → **1 sola instancia**, siempre activa |
| Sesiones | Memoria (`MemoryStore`) | Se pierden al reiniciar; depende de `SESSION_SECRET` estable |
| Health check | `/healthz` (`app.js:40`) | Para el health check del nuevo hosting |
| Variables de entorno | `PORT`, `NODE_ENV`, `SESSION_SECRET`, `DATABASE_URL` | Mínimas → migración simple |

**Conclusión:** la app es ligera (~512 MB RAM suficientes). Migrar = apuntar `DATABASE_URL` a la nueva BD + copiar `uploads/`.

---

## 2. Arquitectura destino

```
[Usuario] → DNS/dominio → Coolify proxy (SSL Let's Encrypt)
                          → Contenedor App (node app.js, nodo único)
                          → Contenedor PostgreSQL (volumen persistente)
                          → Volumen persistente: /app/uploads
```

Todo en un **CX22 de Hetzner**: 2 vCPU, 4 GB RAM, 40 GB NVMe, 20 TB tráfico ≈ **€4.49/mes** (~$5 USD).

### Comparativa de costos

| Concepto | Render hoy | Hetzner + Coolify |
|---|---|---|
| App (Web Service Pro) | $25/mes | — (incluido) |
| BD Postgres Basic | ~$11/mes | — (Docker en el VPS) |
| **Total** | **~$36/mes** | **~$5/mes** |

---

## 3. Fases de la migración

### Fase 0 — Backups en Render (ANTES de tocar nada)

**Importante:** el proyecto ya incluye un botón de backup automático en el panel SuperAdmin
(`Base de Datos → Descargar Dump`). Genera un `.sql` con esquema + datos (PostgreSQL o SQLite).
Úsalo como respaldo adicional, pero el respaldo **oficial y completo** sigue siendo `pg_dump`:

```bash
# Dump oficial desde tu máquina local
pg_dump "postgresql://archivox:PASS@dpg-...-a.virginia-postgres.render.com/archivox" | gzip > archivox_backup_2026-08-11.sql.gz
```

1. Además del dump CLI: crear un **backup manual** en el dashboard de Render Postgres (*Backups*).
2. Copiar `uploads/` localmente:
   ```bash
   rsync -av uploads/ respaldo_uploads/
   # verificar integridad
   sha256sum uploads/* > respaldo_uploads.sha256
   ```
3. Anotar las variables de entorno del Web Service (sobre todo `SESSION_SECRET`).

### Fase 1 — Servidor Hetzner (Ubuntu 24.04)

1. Crear el VPS **CX22** en Hetzner Cloud Console. Elegir región **cercana a la BD de Render**
   (si la BD está en Virginia, usar la región *Ashburn/North America* de Hetzner) para minimizar latencia.
2. Añadir una clave SSH para el acceso.
3. Instalar Docker + Coolify:
   ```bash
   curl -fsSL https://coolify.io/install > install.sh && bash install.sh
   ```
4. En Coolify: **Add resource → PostgreSQL** (con volumen persistente).
   Anotar host/puerto/usuario/contraseña del nuevo Postgres.

### Fase 2 — Migrar la base de datos

```bash
# Desde tu máquina local, apuntando al nuevo Postgres:
gunzip -c archivox_backup_2026-08-11.sql.gz | psql "postgresql://usuario:pass@IP_VPS:5432/archivox"
```

- El dump trae el esquema completo (tablas, datos, secuencias y claves foráneas).
  No es necesario correr migraciones.
- Verificar la restauración:
  ```sql
  \dt                                  -- listar tablas
  SELECT COUNT(*) FROM usuarios;       -- conteos de referencia
  ```
- Si el restore falla por un esquema previo: usar `pg_dump ... --clean --if-exists` y repetir.

> Alternativa con el botón del panel: descargar `archivox_dump_*.sql` desde
> `Base de Datos → Descargar Dump` y restaurarlo igualmente con `psql`.

### Fase 3 — Desplegar la app en Coolify

1. Subir el repo a GitHub/GitLab (rama `main`).
2. Coolify: **Add resource → Application** → repo → rama `main`.
   - **Build command:** `npm install`
   - **Start command:** `node app.js` (NO `npm start` — no existe el script)
   - **Runtime:** Node 22 LTS (estable; el dev local usa 24)
   - **Health check:** `/healthz`
3. **Variables de entorno** (iguales a Render):
   ```
   PORT=3000
   NODE_ENV=production
   SESSION_SECRET=<el mismo de Render>
   DATABASE_URL=postgresql://usuario:pass@IP_VPS:5432/archivox
   PG_POOL_MAX=6
   ```
4. **Volumen persistente** montado sobre el directorio de trabajo (`/app`) para conservar `uploads/`
   (la ruta de multer es relativa a la raíz del proyecto).
5. **⚠️ Nodo único (no escalar):** el `recordatorioScheduler` corre dentro del proceso.
   Con más de una instancia se duplicarían los recordatorios.

### Fase 4 — Copiar los archivos de producción

```bash
rsync -av uploads/ usuario@IP_VPS:/ruta/del/deploy/uploads/
# o si Coolify con volumen:
docker cp uploads/* contenedor:/app/uploads/
```

### Fase 5 — DNS y SSL

1. En el panel del dominio: registrar un subdominio (p. ej. `app.midominio.com`) como **A → IP del VPS**.
2. Coolify: **Domains** → añadir el dominio → activar **SSL automático (Let's Encrypt)**.

### Fase 6 — Validación (checklist)

- [ ] Login, dashboard, solicitudes, gestiones, semáforos
- [ ] Importar/exportar Excel
- [ ] Subir y borrar imagen en una gestión (usa `uploads/`)
- [ ] Equipos y permisos (multi-equipo)
- [ ] Revisar logs: `recordatorioScheduler` activo
- [ ] Health check `/healthz` responde 200

### Fase 7 — Bajada de Render

1. Apagar el **Web Service** de Render (no borrar todavía).
2. Mantener el Postgres de Render **~2 semanas** como respaldo.
3. Confirmada la estabilidad → cancelar el plan Pro de Render y el Postgres Basic.

---

## 4. Rollback

- Conservar la URL y credenciales del Postgres de Render hasta pasado el periodo de estabilidad.
- Si algo falla: revertir el DNS y re-encender el Web Service de Render (la BD original sigue intacta).

---

## 5. Riesgos y mitigación

| Riesgo | Mitigación |
|---|---|
| Perder `uploads/` (no está en Git) | `rsync` + verificación `sha256sum` ANTES de apagar Render |
| Pérdida de datos en el dump | Backup manual de Render + probar el restore en un Postgres temporal antes |
| Sesiones activas perdidas al cortar | Esperado (sesiones en memoria); los usuarios vuelven a iniciar sesión |
| Scheduler duplicado durante la transición | Apagar Render ANTES de encender la nueva instancia |
| 4 GB RAM insuficientes | Coolify (~800 MB) + app (~300 MB) + Postgres (~300 MB) ≈ 1.4 GB → sobra |
| Latencia si el VPS está lejos de la BD | Elegir el VPS en la región de la BD de Render (p. ej. Ashburn) |

---

## 6. Notas técnicas útiles

- **Punto de entrada:** `node app.js`. Si algún hosting exige `npm start`, agregar a `package.json`:
  `"start": "node app.js"`.
- **Auto-provisión del esquema:** si la BD de destino está vacía, `initDb.pg` crea las tablas al arrancar.
  El dump restaura datos y esquema; el arranque simplemente detecta que las tablas ya existen.
- **Backup con un clic:** el panel SuperAdmin → `🗄️ Base de Datos → Descargar Dump` genera
  `archivox_dump_<fecha>.sql` (endpoint `GET /api/admin/dump`, solo superadmin, auditado).
  Sirve como respaldo adicional de datos y esquema para PostgreSQL y SQLite.
