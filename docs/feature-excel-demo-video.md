# Excel de datos demo para el video (importación segura)

**Fecha:** Agosto 2026
**Archivo:** `docs/demo/archivox-datos-demo.xlsx`
**Propósito:** Datos de ejemplo para grabar un video de venta de la app usando el módulo
**Importar Excel** (`/importar` o `/m/importar`), sin exponer ni arriesgar datos reales.

---

## 1. Qué contiene

**28 solicitudes ficticias** (nombres, cédulas y celulares 100% inventados) listas para
importar:

| Columna | Ejemplo | Nota |
|---------|---------|------|
| `IDSOLICITUD` | *(vacía)* | Se deja **vacía** → el sistema genera el ID automáticamente al importar |
| `ESTADO` | ACTIVADA | Mezcla: ACTIVADA (13), PENDIENTE (5), RECHAZADA (4), APROBADA PARA LIBERACIÓN (3), DEVUELTA (3) |
| `CEDULA` | 1712345601 | Texto de 10 dígitos con formato válido (provincias variadas), **ficticias** |
| `NOMBRE` | Marco Antonio Salazar | Nombres inventados |
| `CELULAR` | 0991234001 | Formato `09xxxxxxxx` |
| `SEGMENTO` | GENERAL | GENERAL (11), VIP (6), PREMIUM (6), CORRIENTE (5) |
| `PRODUCTO` | Crédito Personal | Crédito Personal, Consumo, Microcrédito, Vehicular, Libre Inversión |
| `FECHASOLICITUD` | 2026-08-03 | Formato ISO `YYYY-MM-DD`, repartidas entre junio y agosto 2026 |
| `VENDEDOR` | Ana Beltrán | 3 vendedores ficticios (Ana Beltrán 10, Carlos Mendoza 9, Sofía León 9) |

La distribución de estados/segmentos/vendedores está pensada para que el dashboard, los
filtros y el semáforo de campañas se vean "llenos" y realistas en el video.

> ⚠️ **Importante:** todos los datos son ficticios. No usar con datos reales de clientes.

---

## 2. Cómo usarlo en el video

### Paso a paso seguro

1. **Crear un usuario demo** desde el Panel de Administración (o pedir al admin que lo cree),
   ej. `demo_video` / `DemoVideo2026!`.
2. Iniciar sesión con el **usuario demo** (la sesión de un usuario NO ve datos de otro).
3. Ir a **Importar Excel** (`/importar` escritorio o `/m/importar` móvil).
4. Seleccionar `docs/demo/archivox-datos-demo.xlsx` y subirlo.
5. El sistema insertará **28 solicitudes nuevas** con IDs auto-generados (1, 2, 3…).
6. Navegar por Solicitudes, Dashboard, filtros por estado/segmento/vendedor y crear una
   campaña con estos datos para mostrar el semáforo.

### Por qué es seguro (no toca tus datos reales)

- **Cédulas ficticias:** nunca coinciden con clientes reales, por lo que el dedupe por cédula
  del importador no afecta ningún registro tuyo.
- **IDs vacíos (auto-generados):** los IDs se generan con `MAX(id_solicitud) + 1`, así que
  nunca colisionan ni sobrescriben solicitudes existentes (ni las de tu usuario real).
- **Aislamiento por usuario:** el sistema separa los datos por `usuario_id`; lo que se importa
  con el usuario demo queda en el usuario demo. Si además subes el mismo Excel con un **ID
  lleno** ajeno, el fix de importación lo **omite y avisa** en lugar de robarlo
  (ver `docs/fix-importacion-proteccion-datos-usuarios.md`).

### Consejos para el guion del video

- Mostrar el informe de importación: `28 registros nuevos` (con IDs auto-generados).
- En el Dashboard se ven KPIs con estados (ACTIVADA 13, etc.) y el gráfico de segmentos.
- En Solicitudes, filtrar por `Vendedor` (como líder) o por estado para demostrar los filtros.
- Crear una campaña con las solicitudes importadas y mostrar el semáforo de progreso.

---

## 3. Estructura del archivo

- Formato: `.xlsx` (OpenXML), generado con **exceljs** (la misma librería que usa el servidor).
- Hoja única llamada `Solicitudes` (el importador lee la primera hoja).
- Fila 1 = encabezados exactos (`IDSOLICITUD, ESTADO, CEDULA, NOMBRE, CELULAR, SEGMENTO,
  PRODUCTO, FECHASOLICITUD, VENDEDOR`) tal como espera `src/services/excel.service.js`.
- Filas 2 a 29 = datos.

**Validación realizada:** el archivo se leyó con exceljs replicando la lógica de
`excel.service.js` (encabezados crudos, `extraerValorCelda`, `convertirFecha`, defaults de
estado e ID auto-generado): ✅ 28 filas válidas, encabezados correctos, cédulas/celulares con
formato válido, fechas ISO, estados dentro del catálogo del sistema.

---

## Documentación relacionada

- `docs/README.md` — módulo Importación Excel (§11.3) y estructura del proyecto (§4).
- `docs/fix-importacion-proteccion-datos-usuarios.md` — fix de importación (nunca toca
  registros de otros usuarios).
- `README.md` — tabla de Features Recientes.
