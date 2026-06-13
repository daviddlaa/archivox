# Plan de Acción: Función de Bloqueo de Base de Datos de Solicitudes de Usuario

## 1. Información Recopilada

### Estructura Actual de la Base de Datos:
- **Tabla `usuarios`**: id, username, password, nombre, rol, created_at, ultimo_login
- **Tabla `solicitudes`**: id, id_solicitud, estado, cedula, nombre, celular, segmento, producto, codigo_plus, fecha_solicitud, usuario_id, fecha_importacion, fecha_actualizacion (FOREIGN KEY → usuarios.id)
- **Tabla `gestines`**: solicitud_id, usuario_id, tipo_gestion, observacion, fecha_gestion
- **Tabla `ventas_vendedores`**: usuario_id, mes, vendedor, periodo1, periodo2
- **Tabla `config_bonos`**: usuario_id, mes, bono1-bono6, meta_equipo

### Sistema de Autenticación Actual:
- Sesiones Express para mantener al usuario conectado
- Cada solicitud tiene `usuario_id` que la vincula al usuario propietario
- Las consultas filtran por `usuario_id = $1` para mantener aislada la información

### Lo que implica "bloquear la base de datos de solicitudes de un usuario":
1. **Bloqueo de acceso al sistema**: El usuario no puede iniciar sesión
2. **Aislamiento de datos**: Las solicitudes del usuario quedan inaccessibles
3. **Historial preservado**: Los datos no se borran, solo se bloquean
4. **Reversible**: El administrador puede desbloquear cuando sea necesario

---

## 2. Plan Detallado

### 2.1 Modificaciones en Base de Datos

#### Opción A: Agregar campo `bloqueado` a la tabla `usuarios`
```sql
-- Agregar columna bloqueado
ALTER TABLE usuarios ADD COLUMN bloqueado BOOLEAN DEFAULT FALSE;

-- Agregar columna motivo_bloqueo (opcional)
ALTER TABLE usuarios ADD COLUMN motivo_bloqueo TEXT;

-- Agregar columna bloqueado_at (fecha de bloqueo)
ALTER TABLE usuarios ADD COLUMN bloqueado_at DATETIME;
```

#### Crear tabla `bloqueos_log` para auditoría
```sql
CREATE TABLE IF NOT EXISTS bloqueos_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id INTEGER,
    tipo_accion TEXT, -- 'BLOQUEO' o 'DESBLOQUEO'
    motivo TEXT,
    realizado_por INTEGER, -- admin que realizo la accion
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (realizado_por) REFERENCES usuarios(id)
);
```

### 2.2 Modificaciones en Backend (src/controllers/auth.controller.js)

#### Agregar función para verificar estado de bloqueo en login
Modificar `login` para verificar si el usuario está bloqueado antes de permitir acceso:
```javascript
// Verificar si usuario esta bloqueado
if (usuario.bloqueado) {
    return res.status(403).json({
        error: 'Usuario bloqueado. Contacte al administrador.',
        bloqueado: true,
        motivo: usuario.motivo_bloqueo
    });
}
```

#### Agregar nuevas rutas API
1. `POST /api/auth/bloquear/:usuarioId` - Bloquear un usuario
2. `POST /api/auth/desbloquear/:usuarioId` - Desbloquear un usuario
3. `GET /api/auth/usuarios` - Listar todos los usuarios (para admin)
4. `GET /api/auth/usuario/:id` - Obtener info de un usuario específico

### 2.3 Modificaciones en Frontend Desktop

#### Agregar página de gestión de usuarios (admin)
- `public/desktop/admin/usuarios.html` - Panel de administración de usuarios
- `public/desktop/js/admin/usuarios.js` - Lógica del panel

#### Features:
1. **Tabla de usuarios**: Ver todos los usuarios con estado de bloqueo
2. **Botón bloquear/desbloquear**: Cambio rápido de estado
3. **Motivo de bloqueo**: Campo de texto para especificar razón
4. **Historial de bloqueos**: Ver log de bloquear/desbloquear

### 2.4 Modificaciones en Frontend Móvil

#### Agregar sección de administración en móvil
- `public/movil/admin/usuarios.html` - Panel admin móvil
- `public/movil/js/admin/usuarios.js` - Lógica del panel móvil

#### Features:
1. **Cards de usuarios**: Ver usuarios con estado
2. **Acciones rápidas**: Botones para bloquear/desbloquear
3. **Diseño responsive**: Adaptado a pantalla móvil

---

## 3. Archivos a Modificar

### Backend:
- [ ] `src/config/initDb.js` - Agregar nuevas columnas y tabla
- [ ] `src/controllers/auth.controller.js` - Nuevas funciones y modificación de login
- [ ] `src/routes/auth.routes.js` - Nuevas rutas

### Frontend Desktop:
- [ ] `public/desktop/index.html` - Agregar link al panel de admin
- [ ] `public/desktop/admin/usuarios.html` - Nueva página (crear)
- [ ] `public/desktop/js/admin/usuarios.js` - Nuevo archivo (crear)
- [ ] `public/desktop/css/admin.css` -Nuevo archivo (crear)

### Frontend Móvil:
- [ ] `public/movil/index.html` - Agregar link al panel de admin
- [ ] `public/movil/admin/usuarios.html` - Nueva página (crear)
- [ ] `public/movil/js/admin/usuarios.js` - Nuevo archivo (crear)
- [ ] `public/movil/css/admin.css` - Nuevo archivo (crear)

---

## 4. Flujo de Uso

### Para el Administrador:
1. Iniciar sesión como admin
2. Ir a "Gestión de Usuarios" 
3. Ver lista de usuarios
4. Faire clic en "Bloquear" para un usuario
5. Ingresar motivo (opcional)
6. Confirmar → Usuario queda bloqueado

### Para el Usuario Bloqueado:
1. Intentar iniciar sesión
2. Ver mensaje: "Usuario bloqueado. Contacte al administrador."
3. No puede acceder al sistema

### Para Desbloquear:
1. Admin va a "Gestión de Usuarios"
2. Faire clic en "Desbloquear" 
3. Usuario puede volver a iniciar sesión

---

## 5. Pasos de Implementación (Order de Ejecución)

### Paso 1: Modificar Base de Datos
- Actualizar initDb.js para agregar campos

### Paso 2: Actualizar Backend
- Modificar auth.controller.js
- Agregar rutas en auth.routes.js

### Paso 3: Crear Frontend Desktop
- Crear página de admin
- Agregar enlace en menú

### Paso 4: Crear Frontend Móvil
- Crear página de admin móvil
- Agregar enlace en menú

### Paso 5: Pruebas
- Probar bloqueo de usuario
- Probar login de usuario bloqueado
- Probar desbloqueo
- Verificar que datosdel usuario bloqueado permanecen intactos

---

## 6. Notas Adicionales

- **Seguridad**: Solo usuarios con `rol = 'admin'` pueden acceder al panel de usuarios
- **Auditoría**: Se crea log de cada bloqueo/desbloqueo con fecha y motivo
- **Datos**: Los datos del usuario bloqueado NO se borran, solo queda inaccesible
- **Reversibilidad**: El administrador puede desbloquear en cualquier momento
