# 📋 Informe ejecutivo — Auditoría de gestión de `daviddlaa` (Archivox)

> **Fecha de auditoría:** 17 de agosto de 2026
> **Fuente de datos:** Dump real de producción `archivox_dump_2026-08-11-19-06-24.sql` (PostgreSQL de `archivox.onrender.com`, instantánea del **11/08/2026 19:06 UTC**).
> **Método:** Importación del dump en un Postgres local temporal (Docker) y análisis **100% en solo lectura**. Nada se modificó en producción; el contenedor con la copia fue eliminado al terminar.
> **Alcance temporal:** 15/06/2026 → 11/08/2026 (56 días calendario).

---

## 📊 1. Actividad de `daviddlaa` (id 1, "DAVID GONZALEZ", rol `lider`)

| Métrica | Valor |
|---|---|
| Gestiones registradas | **411** (de 634 del sistema = 65%) |
| Solicitudes únicas gestionadas | **195** (de 2.010 totales) |
| Días con actividad | **32** |
| Periodo | 15 jun → 11 ago (56 días) |
| Segmentos trabajados | RESCATE (114), DESCUBRIMIENTO (41), RECUPERACIÓN (18), ORO (12), PLATA (5), BRONCE (4) |
| Sesión típica | Tarde-noche: picos 16:00–17:00 (161) y 20:00–21:00 (125) |

Por tipo: Seguimiento 260 · WhatsApp 124 · Llamada 11 · Recordatorio 9 · Completada 7. También hay 3 gestiones en la tabla legacy `gestines` y 1 gestión de relaciones.

## ☎️ 2. Llamadas

- **Gestiones con tipo "Llamada": 11** (17:31–22:40, horario nocturno).
- **57 observaciones mencionan llamada/llamar** (muchas llamadas se registraron como Seguimiento/WhatsApp: ej. "no contesta la llamada se deja promociones").
- **No existe duración de llamadas en el sistema** (ningún campo de duración en `gestiones`). Por lo tanto **no se puede calcular tiempo hablado, promedio, mínimo, máximo ni mediana de llamadas**. No se inventa ese dato.

## ⏱️ 3. Productividad

| Métrica | Valor real |
|---|---|
| Promedio por día activo | **12,8** gestiones (mediana: 7; máx: **95** el 29/06) |
| Brecha mediana entre gestiones consecutivas | **2,4 min** (en ráfagas: 1,3 min) |
| Ritmo en ráfagas densas (campaña WhatsApp) | **~40–46 gestiones/hora** |
| Ritmo sostenido estimado (con 1–3 min por gestión + brechas) | **~13–24 gestiones/hora** |
| Mejores días (volumen) | 29/06 (95), 24/07 (46), 05/08 (37), 07/08 (27), 06/08 (24) |
| Días con más avances | 29/06 (13), 24/07 (18 contactados), 05/08 (17) |
| Días con ventas registradas | 02–03/07, 11/07, 05–06/08, 10/08 (2 cada uno) |

El 29/06 coincide con el lanzamiento de la campaña **"Rescates permanentes"** (163 gestiones). Días con más contacto: lunes (119), viernes (101), miércoles (95). **No hay tendencia clara de mejora**; el volumen es irregular (semanas de 7–167 gestiones).

## 🎯 4. Embudo comercial (datos reales, clasificados del texto de las 411 gestiones)

Por **gestiones** (una gestión = un bucket por prioridad):

```
411 gestiones (intentos)
 ├─ 142 mensaje WhatsApp enviado (sin respuesta registrada)
 ├─ 55 no contesta
 ├─ 21 número inválido / teléfono inaccesible
 ├─ 16 descalificado (sin cupo / boletín / rechazado / no aplica crédito)
 ├─ 27 no interesado
 ├─ 55 interesado
 ├─ 59 derivado a vendedor
 ├─ 20 registro de venta (15 solicitudes)
 └─ 7 recordatorio + 9 otro
```

Por **solicitudes únicas (195)**:

| Etapa | Solicitudes | % de gestionadas |
|---|---|---|
| Gestionadas | 195 | 100 % |
| Contactadas (hubo conversación) | 98 | **50,3 %** |
| Con interés / avance | 80 | **41,0 %** |
| Con venta confirmada | 15 | **7,7 %** |

## 💰 5. Ventas atribuibles

El sistema **no tiene un módulo de ventas vinculado a gestiones** (no hay tabla `ventas`/`facturas` ni FK gestión→venta). La única tabla de ventas (`ventas_vendedores`, 23 filas) es un **control manual mensual por vendedor sin vínculo con solicitudes ni gestiones**.

**A. Atribución fuerte — 15 ventas:** solicitudes donde el propio daviddlaa registró la compra en su gestión: 497479, 655510, 359490, 467120, 640027, 624695, 374726, 324380, 588405, 423874, 301582, 517001, 559139, 337078, 293868. Nota: 7 están marcadas con tipo **"Completada"** (consistencia verificada); las otras 8 quedaron como Seguimiento con texto de compra. Únicos montos registrados en texto: **$531,13** (sol 359490) y **$1.537,52** (sol 655510).

**B. Atribución probable — 3:** intención de compra fechada sin confirmación posterior en datos: 644821 (18/07), 687480 (fin de julio), 257825 (quincena de agosto).

**C. No atribuible:** los totales mensuales de `ventas_vendedores` del vendedor "David" (enero–julio 2026: $2.614 → $11.161; ≈ **$69.270 en 7 meses**) son contexto de ventas del equipo, **sin relación demostrable con gestiones específicas**.

## 📈 6. Tasas de conversión (por cada 100 solicitudes gestionadas)

- Contactadas: **~50** (50,3 %)
- Interés/avance: **~41** (41,0 %)
- Ventas: **~8** (7,7 %)
- De las 15 ventas: derivación explícita registrada en 10; cerradas por vendedores del equipo (Rosita, Cindy, Luis, Dagne, Valeska…) tras la gestión de daviddlaa.

## ⚡ 7. Capacidad operativa (¿cuánto puede gestionar un operador?)

Basado en el comportamiento real: ráfagas observadas de **40+ gestiones/hora** (WhatsApp masivo), ritmo sostenido **13–24/h** mezclando llamadas y seguimiento, y **máximo real de 95 gestiones/día**.

→ **Un operador puede gestionar de forma sostenible ~15–20 solicitudes/hora y 100–150 solicitudes por jornada de 8 h**, con picos de hasta 200 en campañas puramente de WhatsApp.

## 🧮 8. Costo/tiempo aproximado por gestión

No existe duración registrada, así que es una estimación con supuestos explícitos (brechas medidas: 638 min en total; 2,1 min promedio entre gestiones cortas):
- **1–3 min por gestión** → **3,6–7,5 min por solicitud gestionada** (incluye el hueco entre gestiones).
- Tiempo desde primera gestión hasta venta: **promedio 10,4 días / mediana 3 días** (muchas ventas en ≤3 días).
- Con ~8 ventas por 100 solicitudes y ~10 días de ciclo medio, el "costo en tiempo por venta" ≈ **150–220 min de trabajo** (2,5–3,7 h).

## 🔎 9. Datos faltantes (crítico para medir el negocio)

**Ya existen:** gestión por solicitud con fecha/usuario/tipo, texto de observación, estado de solicitud, historial de cambios de estado (parcial), campañas y semáforos (sin uso real), recordatorios, logins (audit_log desde 11/07).

**Incompletos:** resultado de contacto en texto libre (no categorías), derivaciones solo en texto (sin fecha/vendedor estructurado), `asignaciones_solicitudes` vacía (asignación no estructurada), `gestiones_maestro_solicitudes` (895 filas de semáforo) sin gestión operativa real.

**No existen:** ⏱️ duración de llamadas · 📞 registro estructurado de llamadas · 🏷️ resultado de llamada (no contesta/interesado…) · 💵 tabla de ventas con monto, fecha de cierre, comisión y vendedor · 📄 facturas · 📥 origen del lead · ❌ motivo de no interés · 🔗 vínculo gestión→venta. Sin esto, el embudo depende de clasificar texto libre.

## 💡 10. Conclusión para el modelo de negocio de Archivox

Los datos propios demuestran capacidad real de reactivación: **~50 % de contacto, ~41 % con interés/avance y ~8 ventas por cada 100 solicitudes gestionadas, con ciclo medio de ~3 días (mediana) a ~10 días (promedio) hasta el cierre**. El cuello de botella para comercializar el servicio no es la ejecución (validada), sino la **instrumentación**: sin duración de llamadas ni ventas vinculadas a gestiones, hoy no se puede probar el ROI por cliente ante terceros.

---

**Conclusión concreta:** "Con base en los datos reales de producción de `daviddlaa` (411 gestiones sobre 195 solicitudes entre el 15/06 y el 11/08/2026), un operador puede gestionar aproximadamente **15–20 solicitudes por hora y 100–150 solicitudes por jornada de 8 horas**, obteniendo aproximadamente **41 solicitudes con interés/avance y 8 ventas por cada 100 solicitudes gestionadas** (7,7 % con atribución fuerte; +3 probables no confirmadas). Las métricas de tiempo por llamada y de monto/venta no pueden calcularse porque el sistema no las registra."

*Nota: el análisis se realizó sobre la instantánea del dump del 11/08/2026. Para repetirlo con datos al día, regenerar el dump con el botón "Descargar Dump" del panel SuperAdmin (`GET /api/admin/dump`) y volver a ejecutar la metodología (importar en Postgres local y consultar en solo lectura).*
