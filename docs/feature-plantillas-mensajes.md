# Feature: Plantillas de Mensajes Personalizadas

**Versión:** 1.3

**Fecha:** Agosto 2026

**Estado:** Implementado

> **v1.3 (Agosto 2026):** acceso desde la versión móvil de Campañas y blindaje total de modales.
> - En `/m/gestion-lote`, el icono **💬** de cada tarjeta ya no abre WhatsApp directo:
>   ahora abre el modal de WhatsApp Directo con las plantillas del usuario
>   (`abrirGestionWhatsApp`) para elegir qué plantilla enviar.
> - El escapado de seguridad se extendió a los modales `abrirGestion`, `verGestion` y
>   `verHistorial` (desktop y móvil): nombre, cédula, celular, tipo, fecha, observación y
>   vendedor se escapan con `escaparParaHTML()`.
>
> **v1.2 (Agosto 2026):** validación **atómica** del límite de plantillas.
> - `crearPlantilla()` ya no hace `COUNT(*)` + `INSERT` (con condición de carrera entre
>   ambas sentencias): ahora usa un único `INSERT ... SELECT ... WHERE (SELECT COUNT(*) ...) < 5`
>   que es atómico en SQLite y PostgreSQL (vía `db.js`). Si no se inserta ninguna fila
>   (`rowCount === 0`), responde `400` con el mensaje de límite alcanzado.
>
> **v1.1 (Agosto 2026):** corrección de seguridad y límite dinámico.
> - El modal de **WhatsApp Directo** (`gestion-lote.js`, desktop y móvil) ahora escapa
>   **toda** su salida dinámica: etiqueta de los botones de plantilla y mensaje precargado
>   (`escaparParaHTML`), nombre y celular del cliente en el bloque de información
>   (`escaparParaHTML`), y `solicitudId`/`celular` en el `onclick` de `enviarWhatsApp`
>   (`escaparParaAtributo`). Evita ruptura del modal o inyección HTML desde datos
>   importados (Excel) o plantillas editadas por el usuario.
> - El límite máximo de plantillas ya no está hardcodeado en la UI: el frontend lo lee del
>   campo `max` que devuelve `GET /api/plantillas` (el servidor sigue siendo autoritativo con `MAX_PLANTILLAS = 5`).

> **Módulo nuevo:** permite a cada usuario crear hasta **5 plantillas** de mensajes de
> WhatsApp reutilizables, con la variable `{nombre}` que se reemplaza automáticamente con el
> nombre del cliente de la solicitud. Las plantillas se consumen desde el modal de
> **WhatsApp Directo** de Gestión por Lotes (`/gestion-lote`), donde reemplazan los mensajes
> fijos que existían antes.

## Objetivo

Antes de este módulo, el modal de WhatsApp Directo ofrecía solo 4 mensajes fijos
("Mensaje predeterminado", "Aprobación rápida", "Seguimiento simple", "Consulta general")
escritos en el código. Esto obligaba a modificar el código para cambiar un texto y no
permitía personalizar mensajes por usuario.

El módulo Plantillas resuelve esto con:

- Una **pantalla propia** (desktop y móvil) para crear, editar y eliminar plantillas.
- Un **límite de 5 plantillas por usuario** con contador visual y barra de progreso.
- La **variable `{nombre}`**: se escribe en el mensaje y se reemplaza con el nombre del
  cliente al abrir WhatsApp Directo.
- **Integración con WhatsApp Directo**: los mensajes fijos se reemplazan por las plantillas
  del usuario autenticado (si tiene alguna).

## Alcance

| Vista | Ruta | Archivos |
|-------|------|----------|
| Desktop | `/plantillas` | `public/desktop/plantillas.html`, `public/desktop/js/plantillas.js`, `public/desktop/css/plantillas.css` |
| Móvil | `/m/plantillas` | `public/movil/plantillas.html`, `public/movil/js/plantillas.js`, `public/movil/css/plantillas.css` |
| API | `/api/plantillas` | `src/routes/plantillas.routes.js`, `src/controllers/plantillas.controller.js` |
| Datos | — | Tabla `plantillas` + índice `idx_plantillas_usuario` (SQLite y PostgreSQL) |

## Base de datos

### Tabla `plantillas`

| Columna | Tipo (PG / SQLite) | Descripción |
|---------|--------------------|-------------|
| `id` | SERIAL / INTEGER PK | ID único |
| `usuario_id` | INTEGER NOT NULL FK → `usuarios(id)` ON DELETE CASCADE | Propietario de la plantilla |
| `nombre` | TEXT NOT NULL | Nombre de la plantilla (≤ 100 caracteres) |
| `contenido` | TEXT NOT NULL | Cuerpo del mensaje (≤ 2000 caracteres) |
| `creada_en` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Fecha de creación |
| `actualizada_en` | TIMESTAMP DEFAULT CURRENT_TIMESTAMP | Fecha de última actualización |

**Índice:** `idx_plantillas_usuario` sobre `(usuario_id)` para listar por usuario.

**Creación automática:** la tabla se crea con `CREATE TABLE IF NOT EXISTS` al arrancar el
servidor tanto en SQLite (`src/config/initDb.js`) como en PostgreSQL (`src/config/initDb.pg.js`).

**Migración explícita (producción):** `migrations/011_create_plantillas.pg.sql` (PostgreSQL).
Ejecutar con:

```bash
psql -d tu_db -f migrations/011_create_plantillas.pg.sql
```

## API REST (`/api/plantillas`)

Todas las rutas requieren sesión (`requiresAuth`).

| Método | Ruta | Descripción | Respuestas |
|--------|------|-------------|------------|
| GET | `/api/plantillas` | Lista las plantillas del usuario autenticado (orden `creada_en ASC, id ASC`) | `{ data, total, max }` |
| POST | `/api/plantillas` | Crea una plantilla (valida nombre, contenido y límite de 5) | `201 { mensaje, plantilla }` |
| PUT | `/api/plantillas/:id` | Actualiza una plantilla propia | `{ mensaje, plantilla }` |
| DELETE | `/api/plantillas/:id` | Elimina una plantilla propia | `{ mensaje }` |

### Validaciones (controlador `plantillas.controller.js`)

| Campo | Regla |
|-------|-------|
| `nombre` | Obligatorio, máx. 100 caracteres |
| `contenido` | Obligatorio, máx. 2000 caracteres |
| Límite por usuario | Máximo `MAX_PLANTILLAS = 5`. Validado de forma **atómica** con un `INSERT ... SELECT ... WHERE (SELECT COUNT(*) ...) < 5` (una sola sentencia, sin condición de carrera) |

### Códigos de error

| Código | Caso |
|--------|------|
| `401` | No autenticado |
| `400` | Datos inválidos o límite de 5 plantillas alcanzado |
| `404` | Plantilla no encontrada o de otro usuario |
| `500` | Error interno (se responde con `error.message`) |

> **Seguridad:** todas las consultas verifican `usuario_id` del propietario (las operaciones
> sobre `:id` incluyen `AND usuario_id = ?`), por lo que un usuario nunca puede leer,
> modificar o eliminar plantillas ajenas.

## Frontend — Desktop (`/plantillas`)

Componentes de la pantalla:

- **Header:** título "💬 Plantillas de Mensajes" + campana de notificaciones (widget SSE).
- **Bloque de límite:** contador "X de 5 plantillas utilizadas", barra de progreso con
  gradiente y botón "✨ Nueva plantilla" (se deshabilita con "🚫 Límite alcanzado" al llegar a 5).
- **Ayuda de variable:** banner ámbar explicando `{nombre}` con ejemplo
  *"Hola {nombre}, tu crédito está aprobado..."*.
- **Grid de tarjetas:** `auto-fill minmax(320px, 1fr)`. Cada tarjeta muestra icono 💬,
  nombre, número `#N`, contenido con la variable `{nombre}` resaltada (`.nombre-var`),
  fecha de creación y acciones ✏️ Editar / 🗑️ Eliminar.
- **Empty state:** cuando no hay plantillas ("No tienes plantillas creadas").
- **Modal crear/editar:** nombre (`maxlength=100`), mensaje (`maxlength=2000`, contador de
  caracteres "N / 2000"), botón "➕ Insertar `{nombre}`" que inserta la variable en la
  posición del cursor, y validación con mensaje de error inline.
- **Toast:** confirmaciones ("✅ Plantilla creada", "🗑️ Plantilla eliminada").

Funciones principales (`public/desktop/js/plantillas.js`):

`cargarPlantillas()`, `actualizarContador()`, `renderizarPlantillas()`,
`abrirModalPlantilla(id)` (crear/editar), `insertarVariableNombre()`, `guardarPlantilla()`
(POST/PUT), `eliminarPlantilla(id, nombre)` (confirmación `Modal.confirmar` + DELETE),
helpers `escaparHTML()`, `escaparJS()`, `escaparAtributo()`, `escaparTextoArea()`,
`formatearFecha()` y `mostrarToast()`.

## Frontend — Móvil (`/m/plantillas`)

Misma funcionalidad en layout táctil:

- Header fijo + `nav-bottom` (Inicio / Plantillas / Menú).
- Bloque de límite compacto con botón "✨ Nueva".
- Lista vertical de tarjetas (`.plantillas-list`).
- Modal con los mismos campos y el helper de inserción de `{nombre}`.
- Toast centrado en la parte inferior (encima del `nav-bottom`).

## Integración con WhatsApp Directo (`/gestion-lote`)

El modal de **WhatsApp Directo** de una solicitud ahora carga las plantillas del usuario
autenticado antes de abrirse. Se accede a él desde:

- **Desktop:** botón "💬 Directo" en las tarjetas de campaña.
- **Móvil (`/m/gestion-lote`):** icono **💬** de cada tarjeta (antes abría WhatsApp directo
  con `abrirWhatsAppMovil()`; desde v1.3 abre el modal de plantillas).

El modal carga las plantillas de la siguiente forma:

```javascript
// abrirGestionWhatsApp() es ahora async
var resPlantillas = await fetch('/api/plantillas', { credentials: 'include' });
var dataPlantillas = await resPlantillas.json();
plantillasUsuario = (dataPlantillas && dataPlantillas.data) || [];
```

Comportamiento:

1. Se construye `opcionesMensajes` con cada plantilla del usuario aplicando
   `aplicarVariableNombre(contenido, sol.nombre)`.
2. **Si hay plantillas:** se muestran como botones `.btn-plantilla-whatsapp` (estilados en
   `public/css/gestion-lote.css`) y el textarea se precarga con la **primera plantilla**.
   Al hacer clic en un botón, `cambiarMensajeWhatsAppDesdeBoton()` rellena el textarea.
   Tanto la etiqueta de cada botón como el mensaje precargado se escapan con
   `escaparParaHTML()` antes de insertarse en el HTML del modal (v1.1).
3. **Si no hay plantillas:** se mantiene el mensaje predeterminado
   (`generarMensajeWhatsApp()`), es decir, el comportamiento legacy como *fallback*.

### Helpers nuevos (`gestion-lote.js` desktop y móvil)

| Función | Propósito |
|---------|-----------|
| `obtenerNombreParaMensaje(nombreCompleto)` | Normaliza el nombre del cliente (trim + colapsa espacios) |
| `aplicarVariableNombre(contenido, nombreCliente)` | Reemplaza todas las ocurrencias de `{nombre}` con el nombre del cliente |
| `cambiarMensajeWhatsAppDesdeBoton(boton)` | Lee `data-index`/`data-opciones` y rellena el textarea del modal |

> **Nota (v1.3):** en móvil, `abrirWhatsAppMovil()` sigue existiendo pero solo se usa como
> salida del botón "Enviar" del modal (opción "Abrir WhatsApp al enviar"), ya no desde el
> icono 💬 de las tarjetas.

> **Nota:** la variable `{nombre}` se reemplaza **al abrir el modal** (no al enviar), por lo
> que el usuario puede editar el texto resultante antes de enviarlo.

## Navegación

- **Rutas servidor (`app.js`):** `GET /plantillas` (desktop) y `GET /m/plantillas` (móvil),
  ambas con `requireAuthPage` + `redirectSuperAdmin`.
- **Drawer (`public/js/drawer.js`):** entrada "💬 Plantillas" en el menú móvil
  (`/m/plantillas`) y en el menú lateral desktop (`/plantillas`).
- **Deep Link Router (`public/js/deep-link-router.js`):** módulo `plantillas`
  (`/plantillas` / `/m/plantillas`) disponible para notificaciones con `accion_modulo`.

## Consideraciones de seguridad

- Toda la salida de datos del usuario se escapa en el renderizado de tarjetas
  (`escaparHTML`/`escaparAtributo`) y en los `onclick` (`escaparJS`).
- El contenido de la plantilla se renderiza como texto plano con `white-space: pre-wrap`
  (no se interpreta HTML).
- La variable `{nombre}` se resalta con un `<span>` solo después de escapar el contenido.
- En el modal de **WhatsApp Directo** (`gestion-lote.js`), toda la salida dinámica se
  escapa: etiqueta de botones y mensaje precargado con `escaparParaHTML()`; nombre y
  celular del cliente con `escaparParaHTML()`; y `solicitudId`/`celular` en el `onclick`
  de `enviarWhatsApp` con `escaparParaAtributo()` (v1.1).
- El límite por usuario se aplica en el backend (autoritativo, `MAX_PLANTILLAS = 5`) y el
  frontend lo lee dinámicamente del campo `max` que devuelve `GET /api/plantillas`
  (ya no está hardcodeado en la UI) (v1.1).
- La validación del límite es **atómica**: `crearPlantilla()` usa un `INSERT` condicional
  en una sola sentencia, eliminando la condición de carrera entre `COUNT(*)` e `INSERT`
  (v1.2).

## Archivos involucrados

```
migrations/011_create_plantillas.pg.sql      # Migración PostgreSQL (producción)
src/config/initDb.js                          # CREATE TABLE plantillas (SQLite)
src/config/initDb.pg.js                       # CREATE TABLE plantillas (PostgreSQL)
src/controllers/plantillas.controller.js      # Lógica CRUD + validaciones + límite
src/routes/plantillas.routes.js               # Router /api/plantillas (requiresAuth)
app.js                                        # Rutas /plantillas, /m/plantillas, /api/plantillas
public/desktop/plantillas.html                # Pantalla desktop
public/desktop/js/plantillas.js               # Lógica desktop
public/desktop/css/plantillas.css             # Estilos desktop
public/movil/plantillas.html                  # Pantalla móvil
public/movil/js/plantillas.js                 # Lógica móvil
public/movil/css/plantillas.css               # Estilos móvil
public/desktop/js/gestion-lote.js             # WhatsApp Directo: plantillas del usuario (desktop)
public/movil/js/gestion-lote.js               # WhatsApp Directo: plantillas del usuario (móvil)
public/css/gestion-lote.css                   # Estilos .btn-plantilla-whatsapp
public/js/drawer.js                           # Entradas de menú (💬 Plantillas)
public/js/deep-link-router.js                 # Módulo deep link 'plantillas'
```

## Verificación

1. Iniciar servidor (`node app.js`) — la tabla `plantillas` se crea automáticamente.
2. Entrar a `/plantillas` (desktop) o `/m/plantillas` (móvil).
3. Crear una plantilla con `{nombre}` en el mensaje → debe aparecer en el grid con la
   variable resaltada y el contador debe subir.
4. Abrir una campaña en `/gestion-lote`, clic en "💬 Directo" de una solicitud → el modal
   debe mostrar los botones de las plantillas y el textarea precargado con la primera
   (con el nombre del cliente reemplazado).
5. Crear 6 plantillas → la 6.ª debe rechazarse con el mensaje de límite.
6. Eliminar una plantilla → debe pedir confirmación y actualizar el contador.

## Evolución futura

- Más variables (p. ej. `{producto}`, `{cedula}`, `{celular}`).
- Variables por equipo/campaña (plantillas compartidas por líderes).
- Ordenar plantillas (arrastrar) y duplicar.
- Guardar la plantilla usada como gestión (ya existe la opción "Guardar gestión en el historial").
