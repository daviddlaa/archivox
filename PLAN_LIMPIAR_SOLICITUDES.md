# Plan de Acción: Botón para Limpiar Solicitudes del Usuario

## 1. Descripción de la Funcionalidad

**Objetivo:** Agregar un botón en el dashboard que permita al usuario eliminar todas sus solicitudes importadas.

**Lo que implica:**
- Eliminar todos los registros de la tabla `solicitudes` del usuario actual
- Las solicitudes asociadas serão eliminadas permanentemente
- El usuario puede confirmar antes de proceder
- Es función del usuario sobre SUS propi datos (no de otros usuarios)

---

## 2. Plan Detallado

### 2.1 Modificaciones en Backend

#### Agregar nueva ruta API en excel.controller.js
```javascript
// Limpiar todas las solicitudes del usuario actual
exports.limpiarSolicitudes = async (req, res) => {
    const usuarioId = req.session.usuario?.id;
    if (!usuarioId) {
        return res.status(401).json({
            error: 'No autenticado'
        });
    }

    try {
        // Contar solicitudes antes de eliminar
        const countResult = await pool.query(
            'SELECT COUNT(*) as total FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );
        
        const total = parseInt(countResult.rows[0]?.total) || 0;
        
        if (total === 0) {
            return res.json({
                mensaje: 'No hay solicitudes para eliminar',
                eliminadas: 0
            });
        }

        // Eliminar gestines asociadas primero
        await pool.query(
            'DELETE FROM gestines WHERE usuario_id = $1',
            [usuarioId]
        );

        // Eliminar solicitudes
        const result = await pool.query(
            'DELETE FROM solicitudes WHERE usuario_id = $1',
            [usuarioId]
        );

        res.json({
            mensaje: 'Solicitudes eliminadas correctamente',
            eliminadas: result.rowCount
        });

    } catch (err) {
        console.error('Error limpiarSolicitudes:', err);
        res.status(500).json({
            error: err.message
        });
    }
};
```

#### Agregar ruta en excel.routes.js
```javascript
// Limpiar todas las solicitudes del usuario
router.delete(
    '/solicitudes',
    requiresAuth,
    excelController.limpiarSolicitudes
);
```

### 2.2 Modificaciones en Frontend Desktop

#### Modificar public/desktop/js/dashboard.js
Agregar botón "Limpiar Solicitudes" con funcionalidad:
- Botón con icono de 🗑️ o 🧹
- Al hacer clic, mostrar confirmación (SweetAlert o confirm())
- Si confirma, ejecutar DELETE a `/api/excel/solicitudes`
- Mostrar resultado y recargar dashboard
- También limpiar el localStorage si hay datos guardados

### 2.3 Modificaciones en Frontend Móvil

#### Modificar public/movil/js/dashboard.js
Agregar mismo botón en versión móvil:
- Diseño adaptado a pantalla pequeña
- Misma funcionalidad
- Ubicación en actions floating o en botón de opciones

---

## 3. Archivos a Modificar

### Backend:
- [ ] `src/controllers/excel.controller.js` - Agregar función limpiarSolicitudes
- [ ] `src/routes/excel.routes.js` - Agregar ruta DELETE

### Frontend Desktop:
- [ ] `public/desktop/js/dashboard.js` - Agregar botón y funcionalidad
- [ ] `public/desktop/dashboard.html` - Agregar botón en HTML (si es necesario)

### Frontend Móvil:
- [ ] `public/movil/js/dashboard.js` - Agregar botón y funcionalidad
- [ ] `public/movil/dashboard.html` - Agregar botón en HTML (si es necesario)

---

## 4. Diseño del Botón

### Desktop:
```
┌─────────────────────────────────────────┐
│  DASHBOARD                              │
│  ─────────────────────                  │
│  Total: 150  Activadas: 45  ...        │
│                                         │
│  [Importar] [Exportar] [🧹 Limpiar]    │
└─────────────────────────────────────────┘
```

### Móvil:
```
┌─────────────────┐
│ DASHBOARD       │
│ Total: 150      │
│ ─────────────   │
│ [🧹 Limpiar]    │
└─────────────────┘
```

### Estilo sugerido:
- Color: Rojo (#dc2626) o Naranja (#f59e0b)
- Icono: 🧹 (escoba) o 🗑️ (papelera)
- Texto: "Limpiar Todo" o "Eliminar Mis Solicitudes"
- Posición: Near del botón Exportar

---

## 5. Flujo de Uso

1. Usuario está en dashboard
2. Hace clic en "Limpiar Solicitudes"
3. Sistema muestra mensaje de confirmación:
   > "¿Estás seguro de eliminar todas tus solicitudes? 
   > Esta acción no se puede deshacer. 
   > Total de solicitudes a eliminar: 150"
4. Usuario hace clic en "Confirmar" o "Cancelar"
5. Si confirma:
   - Sistema elimina todas las solicitudes
   - Muestra mensaje: "Se eliminaron 150 solicitudes"
   - Recarga el dashboard (total = 0)
6. Si cancela:
   - No happens nada

---

## 6. Consideraciones de Seguridad

- **Solo elimina las solicitudes del usuario actual** (filtrado por usuario_id de la sesión)
- **No puede eliminar solicitudes de otros usuarios** (gracias al filtro WHERE usuario_id = $1)
- **Primero elimina gestines asociadas** (para integridad referencial)
- **Requiere autenticación** (middleware requiresAuth)

---

## 7. Pasos de Implementación

### Paso 1: Backend
- Agregar función en excel.controller.js
- Agregar ruta en excel.routes.js

### Paso 2: Frontend Desktop
- Agregar botón en dashboard.js
- Agregar funcionalidad de confirmación
- Llamar API y recargar datos

### Paso 3: Frontend Móvil
- Agregar botón en dashboard.js móvil
- Misma funcionalidad

### Paso 4: Pruebas
- Probar en desktop
- Probar en móvil
- Verificar que solo elimina del usuario actual
