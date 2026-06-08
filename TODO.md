# TODO - Sistema de Usuarios y Login

## [x] 1. Instalar dependencias
- [x] instalar bcryptjs para hashear contraseñas
- [x] instalar express-session para sesiones

## [x] 2. Base de datos
- [x] Modificar src/config/initDb.js - crear tabla usuarios
- [x] Modificar src/config/initDb.js - agregar columna usuario_id a solicitudes

## [x] 3. Backend - Autenticación
- [x] Crear src/controllers/auth.controller.js
- [x] Crear src/routes/auth.routes.js
- [x] Modificar app.js - agregar rutas de auth y middleware de sesión

## [x] 4. Frontend - Login
- [x] Crear public/css/login.css
- [x] Crear public/desktop/login.html
- [x] Crear public/movil/login.html

## [x] 5. Proteger acceso
- [x] Modificar app.js - redirigir a login si no hay sesión
- [x] Páginas protegidas con requiresAuth

## [✓] 6. Testing completdo
- [✓] Servidor corriendo en puerto 3000
- [✓] Probar en navegador: http://localhost:3000/login
