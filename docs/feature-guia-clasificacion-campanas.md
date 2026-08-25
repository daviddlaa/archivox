# Feature: Guía didáctica de clasificación en campañas (una sola vez)

**Fecha:** Agosto 2026
**Ámbito:** `public/js/guia-campana.js` (nuevo), `public/desktop/gestion-lote.html`,
`public/movil/gestion-lote.html`, `public/desktop/js/gestion-lote.js`,
`public/movil/js/gestion-lote.js`, `public/css/gestion-lote.css`,
`public/movil/css/gestion-lote.css`
**Solicitud:** Al crear una campaña (y al entrar a una campaña), mostrar **una sola vez**
un modal didáctico estilo sweet alert que enseña cómo clasificar a los clientes en el
semáforo (Seguimiento = aún no responden, Encaminadas = tienen interés, En espera = no
quieren nada), que se priorice llamar antes que enviar mensajes y que se recomiende
guardar el contacto en el teléfono. Móvil + escritorio.

---

## 1. Resumen

Se añadió una **guía didáctica** que se muestra **una sola vez por usuario** (persistida en
`localStorage` con llave por usuario `campana_guia_v1_<usuarioId>`) al **entrar a una
campaña** en `gestion-lote` (desktop y móvil). Como ambos flujos de creación de campaña
desde Solicitudes redirigen a `gestion-lote`, la guía se ve tanto al crear como al entrar.

El modal replica visualmente lo que el agente verá en las tarjetas:

1. **Tarjeta del semáforo** — las 4 opciones del selector segmentado con su significado:
   - ⚪ **Sin clasificar** → por revisar.
   - 🟡 **Seguimiento** → aún no responden: retómalos más tarde.
   - 🟢 **Encaminadas** → tienen interés: continúa la gestión.
   - 🔴 **En espera** → no quieren nada: respeta su tiempo.
2. **Segmento de prioridad** — `1️⃣ 📞 Llama primero` → `2️⃣ 💬 Luego mensaje`.
3. **Recomendación** — guarda el contacto en tu teléfono, con botón **"📋 Copiar nombre y
   cédula"** (copia los datos de la primera solicitud de la lista).
4. Botón **"👍 ¡Entendido!"** que marca la guía como vista y la cierra.

---

## 2. Detalle de la implementación

### 2.1 `public/js/guia-campana.js` (nuevo, compartido desktop/móvil)

- `window.mostrarGuiaCampanaSiPrimeraVez({ usuarioId, nombre, cedula })` → devuelve `true`
  si mostró la guía (primera vez) o `false` si ya se vio.
- Flag por usuario en `localStorage`: `campana_guia_v1_<usuarioId>` (o `_anon` si no hay id).
  Si `localStorage` no está disponible, no insiste (devuelve `true`).
- El contenido se escapa con `escapar()` antes de inyectarse (sin XSS).
- Reutiliza `crearModal(html)` (global de `modal.js` en desktop; definición local en móvil);
  si no hay modal disponible, marca como vista y no muestra nada.
- Botón de copiar: `navigator.clipboard` con fallback a `document.execCommand('copy')`.
  El botón cambia a "✅ Copiado" por 2 s.

### 2.2 Disparo (desktop y móvil)

Nueva función local `intentarMostrarGuiaCampana()` en cada `gestion-lote.js`:

1. Se ejecuta **una vez por carga de página** (flag `guiaCampanaIntentada`), al final de
   `cargarDatosGestion()` / `cargarDatosGestionMovil()`.
2. Consulta `GET /api/auth/sesion` → `ses.usuario.id` (llave del flag).
3. Toma la primera solicitud de la campaña (`solicitudes[0]`) para `nombre` y `cedula`
   (botón de copiar). Si la campaña está vacía, la guía igual se muestra sin el botón.
4. Llama a `window.mostrarGuiaCampanaSiPrimeraVez(...)`.

Así, al **crear** una campaña (que redirige a `gestion-lote`) y al **entrar** a cualquier
campaña la guía aparece, pero solo la primera vez.

### 2.3 HTML

`<script src="/js/guia-campana.js"></script>` se carga antes de `gestion-lote.js` en:
- `public/desktop/gestion-lote.html`
- `public/movil/gestion-lote.html`

### 2.4 CSS

| Archivo | Selector | Estilo |
|---------|----------|--------|
| `public/css/gestion-lote.css` | `.guia-campana*` | tarjeta didáctica: header con icono 🎓, filas del semáforo con colores reales (`.guia-sin_clasificar`, `.guia-amarillo`, `.guia-verde`, `.guia-rojo`), segmento de prioridad, tip con botón copiar, CTA "¡Entendido!" |
| `public/movil/css/gestion-lote.css` | `.guia-campana*` | igual pero compacto para pantallas táctiles (botón copiar a ancho completo) |

---

## 3. Qué NO cambió

| Elemento | Estado |
|----------|--------|
| Backend / API / migraciones | Sin cambios |
| Comportamiento del semáforo, filtros u orden de la lista | Sin cambios |
| Flujo de creación de campaña | Sin cambios (solo se añade la guía tras el redirect) |
| La guía nunca bloquea el uso | Se puede cerrar con "¡Entendido!" o el cierre del modal |

---

## Verificación

- ✅ `node --check` en `public/js/guia-campana.js`, `public/desktop/js/gestion-lote.js` y
  `public/movil/js/gestion-lote.js` (móvil conserva CRLF).
- ✅ Presentes: `mostrarGuiaCampanaSiPrimeraVez`, `intentarMostrarGuiaCampana` (×2) y el
  `<script>` en ambos HTML.
- ⏳ Prueba visual: entrar a una campaña → debe aparecer la guía; cerrar → no debe volver a
  aparecer ni al recargar ni al entrar a otra campaña (mismo navegador/usuario).

## Documentación relacionada

- `docs/README.md` — estructura del proyecto (§12.6 Campañas v2).
- `docs/feature-prioridad-tiempo-sin-seguimiento.md` — orden por tiempo sin seguimiento
  (misma vista `gestion-lote`).
- `docs/feature-historial-campana.md` — historial de gestiones de campaña.
- `README.md` — tabla de Features Recientes.
