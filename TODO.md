# TODO - Agregar Vista de Ventas Mensuales

## Plan de Implementación

### 1. Información Recopilada
- **Estructura del Proyecto:** Express.js con PostgreSQL, versiones móvil y desktop
- **Sidebar actual (Desktop):** `public/desktop/index.html` - enlaces: Dashboard, Importar, Solicitudes, Cerrar Sesión
- **Footer actual (Mobile):** `public/movil/index.html` - clase `nav-bottom` con 4 enlaces
- **API existente:** `/api/excel/dashboard/promedio/mes` - calcula promedio de últimos 3 meses
- **Base de datos:** Tabla `solicitudes` con campo `fecha_solicitud` y `estado`

### 2. Plan de Implementación

#### 2.1 Agregar nueva ruta en app.js
- Agregar ruta `/ventas` y `/m/ventas` (protegidas con requiresAuth)

#### 2.2 Agregar API endpoint
- Agregar ruta `/api/excel/dashboard/ventas-mensuales` en excel.routes.js
- Agregar controller `dashboardVentasMensuales` en excel.controller.js
- Query: obtener total de solicitudes ACTIVADAS por mes (últimos 12 meses)

#### 2.3 Crear nuevas pages HTML
- Crear `public/desktop/ventas.html` (similar a dashboard con gráfico de ventas)
- Crear `public/movil/ventas.html` (versión móvil)

#### 2.4 Actualizar sidebar (Desktop)
- Agregar enlace en `public/desktop/index.html`
-Nuevo enlace: `<a href="/ventas">💰 Ventas Mensuales</a>`

#### 2.5 Actualizar footer (Mobile)
- Agregar enlace en `public/movil/index.html`
- Nuevo enlace: `<a href="/m/ventas"><span>💰</span>Ventas</a>`

#### 2.6 Crear archivos JavaScript
- Crear `public/desktop/js/ventas.js` (cargar datos y gráfico)
- Crear `public/movil/js/ventas.js` (versión móvil)

#### 2.7 Agregar estilos CSS
- Agregar estilos en `public/css/main.css` para la vista de ventas

### 3. Archivos Dependientes a Editar
- `app.js` - agregar rutas
- `src/routes/excel.routes.js` - agregar ruta API
- `src/controllers/excel.controller.js` - agregar controller
- `public/desktop/index.html` - agregar sidebar link
- `public/movil/index.html` - agregar footer link
- `public/css/main.css` - agregar estilos (opcional)

### 4. Archivos a Crear
- `public/desktop/ventas.html`
- `public/movil/ventas.html`
- `public/desktop/js/ventas.js`
- `public/movil/js/ventas.js`

### 5. Pasos de Prueba
1. Ejecutar `npm start` para iniciar el servidor
2. Iniciar sesión en desktop y navegar aVentas Mensuales
3. Verificar que el gráfico muestre datos
4. Probar versión móvil en dispositivo o con ?movil=1
5. Verificar que el enlace aparezca en el footer
