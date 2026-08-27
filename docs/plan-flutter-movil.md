# 📋 Plan de Migración a Flutter Móvil — Archivox

> **Objetivo:** Crear una app móvil nativa con Flutter que reemplace la versión web móvil actual (`/m/*`), conectándose a la misma API REST existente.
> **Estado:** 📋 Plan (sin código aún)
> **Fecha:** 27/08/2026
> **Versión del documento:** 1.0

---

## Índice

1. [Contexto y Justificación](#1--contexto-y-justificación)
2. [Alcance de la App](#2--alcance-de-la-app)
3. [Arquitectura Técnica Propuesta](#3--arquitectura-técnica-propuesta)
4. [Módulos y Funcionalidades por Fase](#4--módulos-y-funcionalidades-por-fase)
5. [Fases de Desarrollo (Roadmap)](#5--fases-de-desarrollo-roadmap)
6. [Equivalencia de Pantallas Web → Flutter](#6--equivalencia-de-pantallas-web--flutter)
7. [Consideraciones de UI/UX](#7--consideraciones-de-uiux)
8. [Decisiones Pendientes](#8--decisiones-pendientes)
9. [Riesgos y Mitigaciones](#9--riesgos-y-mitigaciones)
10. [Criterios de Éxito](#10--criterios-de-éxito)

---

## 1. Contexto y Justificación

### Situación actual
La versión móvil de Archivox es una app web con HTML/CSS/JS vanilla servida por Express en rutas `/m/*`. Funciona pero tiene limitaciones:

- **Sin acceso offline** — todo requiere conexión.
- **Sin notificaciones push** — solo SSE en tiempo real mientras la pestaña está abierta.
- **Sin cámara/galería** — no puede escanear cédulas ni adjuntar fotos.
- **Performance limitada** — JavaScript vanilla con DOM manipulation, sin virtual DOM.
- **UX nativa ausente** — no hay gestures nativos, transiciones fluidas ni haptic feedback.
- **Duplicación de código** — el mismo módulo existe dos veces (desktop + móvil) con lógica casi idéntica.

### Qué gana Flutter
- **Nativa:** rendimiento 60fps, animaciones fluidas, gestures nativos.
- **Offline-first:** caché local con SQLite (sqflite) para datos críticos.
- **Notificaciones push:** Firebase Cloud Messaging (FCM) para recordatorios reales.
- **Cámara/Galería:** potentials para escaneo de cédulas con ML Kit.
- **Mantenimiento separado:** el mobile deja de depender de actualizaciones del backend web.
- **Comparte la API:** misma REST API, sin duplicar backend.

---

## 2. Alcance de la App

### Pantallas a implementar (orden de prioridad)

| # | Pantalla | Web equiv. | Prioridad |
|---|----------|------------|-----------|
| 1 | Login | `/m/login` | 🔴 P0 |
| 2 | Dashboard (carousel KPIs) | `/m/` | 🔴 P0 |
| 3 | Solicitudes (listado + filtros) | `/m/solicitudes` | 🔴 P0 |
| 4 | Detalle de Solicitud | Panel lateral (nueva pantalla) | 🔴 P0 |
| 5 | Campañas (landing grid) | `/m/gestiones` | 🟠 P1 |
| 6 | Gestión por Lotes (detalle campaña) | `/m/gestion-lote` | 🟠 P1 |
| 7 | Equipo (panel líder) | `/m/equipo` | 🟠 P1 |
| 8 | Relaciones | `/m/relaciones` | 🟠 P1 |
| 9 | Historial | `/m/historial` | 🟡 P2 |
| 10 | Ventas | `/m/ventas` | 🟡 P2 |
| 11 | Plantillas de Mensajes | `/m/plantillas` | 🟡 P2 |
| 12 | Calendario de Recordatorios | `/m/calendario-recordatorios` | 🟡 P2 |
| 13 | Importar Excel | `/m/importar` | 🟢 P3 |
| 14 | Perfil de Usuario | `/perfil` | 🟢 P3 |
| 15 | Notificaciones (centro) | Panel notificaciones | 🟢 P3 |

### Funcionalidades transversales
- **Drawer de navegación** (menú lateral con roles).
- **Pull-to-refresh** en todos los listados.
- **Búsqueda local + remota** (con debounce).
- **Caché offline** para datos leídos con frecuencia.
- **Deep links** (notificaciones → pantalla específica).
- **Detección de rol** (agente, líder, superadmin) para UI condicional.

---

## 3. Arquitectura Técnica Propuesta

### 3.1 Stack

| Capa | Tecnología | Justificación |
|------|-----------|---------------|
| **Framework** | Flutter 3.x (Dart) | Cross-platform (iOS + Android), performance nativa |
| **State Management** | Riverpod 2.x | Escalable, testable, sin BuildContext issues |
| **Navegación** | GoRouter | Deep links, rutas declarativas, guards de auth |
| **HTTP Client** | Dio | Interceptors, retry, cache, cancelación |
| **Local DB** | sqflite + drift | SQLite offline con type-safe queries |
| **Caché** | flutter_cache_manager | Caché de imágenes y respuestas HTTP |
| **Notificaciones Push** | firebase_messaging | FCM para recordatorios y alertas |
| **UI Components** | Material Design 3 | Widgets nativos consistentes |
| **Gráficos** | fl_chart | KPIs y gráficos del dashboard |
| **Formularios** | form_builder_validators | Validación declarativa |
| **CSV/Excel** | syncfusion_flutter_xlsio / csv | Importación de archivos |
| **Storage seguro** | flutter_secure_storage | Tokens y credenciales |

### 3.2 Estructura del Proyecto

```
archivox_mobile/
├── lib/
│   ├── main.dart                    # Entry point
│   ├── app.dart                     # MaterialApp + GoRouter config
│   │
│   ├── core/                        # Infraestructura compartida
│   │   ├── api/                     # Capa de red
│   │   │   ├── api_client.dart      # Dio instance + interceptors
│   │   │   ├── api_exceptions.dart  # Manejo de errores HTTP
│   │   │   └── interceptors/
│   │   │       ├── auth_interceptor.dart    # Inyecta cookie/token
│   │   │       └── logging_interceptor.dart # Logs en debug
│   │   ├── db/                      # Base de datos local
│   │   │   ├── database.dart        # drift Database
│   │   │   ├── tables.dart          # Definición de tablas
│   │   │   └── daos/                # Data Access Objects
│   │   ├── cache/                   # Caché
│   │   │   └── cache_service.dart
│   │   ├── auth/                    # Autenticación
│   │   │   ├── auth_provider.dart   # Estado de sesión (Riverpod)
│   │   │   └── auth_repository.dart # Llamadas a /api/auth/*
│   │   ├── theme/                   # Tema visual
│   │   │   ├── app_theme.dart
│   │   │   └── app_colors.dart
│   │   ├── constants.dart           # URLs, timeouts, keys
│   │   └── utils.dart               # Helpers (escape HTML, fechas, etc.)
│   │
│   ├── features/                    # Módulos por pantalla
│   │   ├── auth/
│   │   │   ├── data/
│   │   │   │   └── auth_remote_source.dart
│   │   │   ├── domain/
│   │   │   │   └── auth_repository.dart
│   │   │   └── presentation/
│   │   │       ├── login_screen.dart
│   │   │       └── login_controller.dart
│   │   │
│   │   ├── dashboard/
│   │   │   ├── data/
│   │   │   │   └── dashboard_remote_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── dashboard_repository.dart
│   │   │   │   └── kpi_models.dart
│   │   │   └── presentation/
│   │   │       ├── dashboard_screen.dart
│   │   │       ├── widgets/
│   │   │       │   ├── kpi_card.dart
│   │   │       │   ├── chart_estado.dart
│   │   │       │   └── ultimas_gestiones.dart
│   │   │       └── dashboard_controller.dart
│   │   │
│   │   ├── solicitudes/
│   │   │   ├── data/
│   │   │   │   └── solicitudes_remote_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── solicitudes_repository.dart
│   │   │   │   └── solicitud_models.dart
│   │   │   └── presentation/
│   │   │       ├── solicitudes_screen.dart
│   │   │       ├── solicitud_detail_screen.dart
│   │   │       ├── widgets/
│   │   │       │   ├── solicitud_card.dart
│   │   │       │   ├── filtros_sheet.dart
│   │   │       │   └── nueva_solicitud_dialog.dart
│   │   │       └── solicitudes_controller.dart
│   │   │
│   │   ├── campanas/
│   │   │   ├── data/
│   │   │   │   └── campanas_remote_source.dart
│   │   │   ├── domain/
│   │   │   │   ├── campanas_repository.dart
│   │   │   │   └── campana_models.dart
│   │   │   └── presentation/
│   │   │       ├── campanas_landing_screen.dart
│   │   │       ├── gestion_lote_screen.dart
│   │   │       ├── widgets/
│   │   │       │   ├── campana_grid_card.dart
│   │   │       │   ├── semaforo_selector.dart
│   │   │       │   ├── tarjeta_campana.dart
│   │   │       │   └── historial_campana_sheet.dart
│   │   │       └── campanas_controller.dart
│   │   │
│   │   ├── relaciones/
│   │   │   ├── data/
│   │   │   │   └── relaciones_remote_source.dart
│   │   │   ├── domain/
│   │   │   │   └── relaciones_repository.dart
│   │   │   └── presentation/
│   │   │       ├── relaciones_screen.dart
│   │   │       └── widgets/
│   │   │
│   │   ├── equipo/
│   │   │   ├── data/
│   │   │   │   └── equipo_remote_source.dart
│   │   │   ├── domain/
│   │   │   │   └── equipo_repository.dart
│   │   │   └── presentation/
│   │   │       ├── equipo_screen.dart
│   │   │       ├── agente_detail_screen.dart
│   │   │       └── widgets/
│   │   │
│   │   ├── historial/
│   │   ├── ventas/
│   │   ├── plantillas/
│   │   ├── calendario_recordatorios/
│   │   ├── importar/
│   │   ├── perfil/
│   │   └── notificaciones/
│   │
│   ├── shared/                      # Widgets compartidos entre features
│   │   ├── widgets/
│   │   │   ├── app_drawer.dart      # Menú de navegación
│   │   │   ├── app_header.dart      # Header reutilizable
│   │   │   ├── empty_state.dart     # Estado vacío
│   │   │   ├── loading_overlay.dart
│   │   │   ├── confirm_dialog.dart
│   │   │   ├── search_bar.dart
│   │   │   └── badge_counter.dart
│   │   └── extensions/
│   │       ├── string_extensions.dart
│   │       └── date_extensions.dart
│   │
│   └── router/
│       ├── app_router.dart          # GoRouter config
│       └── auth_guard.dart          # Redirect si no autenticado
│
├── assets/
│   ├── images/
│   │   ├── logo/
│   │   └── icons/
│   └── fonts/
│
├── test/
│   ├── unit/
│   ├── widget/
│   └── integration/
│
├── pubspec.yaml
└── README.md
```

### 3.3 Comunicación con la API existente

La app Flutter se conecta a la **misma API REST** de Express. No hay cambios en el backend.

```
Flutter App  ──HTTP/HTTPS──►  Express Server (archivox.onrender.com)
                               │
                               ├── /api/auth/*        → Login, sesión, perfil
                               ├── /api/excel/*        → Solicitudes CRUD, gestiones
                               ├── /api/gestiones-maestro/* → Campañas
                               ├── /api/equipos/*      → Equipos, agentes
                               ├── /api/relaciones/*   → Relaciones
                               ├── /api/admin/*        → Admin (si superadmin)
                               └── /api/plantillas/*   → Plantillas
```

**Estrategia de sesión:**
- La API usa `express-session` con cookies httpOnly.
- Flutter guarda la cookie de sesión en `flutter_secure_storage`.
- El interceptor de Dio la inyecta en cada petición.
- Manejo de 401 → redirect a login.

**Notas sobre la API actual:**
- La API retorna HTML en algunas páginas (server-rendered). La app Flutter solo consume endpoints JSON (`/api/*`).
- Si algún endpoint no existe como JSON puro, se agrega al backend (mínimo).

---

## 4. Módulos y Funcionalidades por Fase

### Fase 0: Infraestructura (Semanas 1-2)

**Objetivo:** Proyecto funcional con login y navegación básica.

| Componente | Detalle |
|------------|---------|
| Proyecto Flutter | `flutter create archivox_mobile`, configuración iOS/Android |
| Tema visual | Colores Archivox, tipografía, modo claro/oscuro |
| API Client | Dio con interceptors (auth, logging, error handling) |
| Auth Provider | Riverpod provider de estado de autenticación |
| Login Screen | Formulario username/password, rate limit UI (5 intentos) |
| Sesión | Persistencia de cookie en secure storage, refresh automático |
| Router | GoRouter con redirect no-auth → login |
| Drawer | Menú lateral con logo, navegación, perfil, cerrar sesión |
| Health Check | Verificar conectividad al backend al abrir |

### Fase 1: Dashboard + Solicitudes (Semanas 3-5)

**Objetivo:** Pantallas principales de uso diario.

#### Dashboard
- KPIs en carousel horizontal (触摸 scroll) o grid vertical.
- Widgets: Herramientas rápidas, Últimas gestiones.
- Pull-to-refresh.
- Badges de notificaciones en header.

#### Solicitudes
- Listado con tarjetas (nombre, cédula, celular, estado, campaña).
- Filtros en bottom sheet: estado, segmento, campaña, fechas, vendedor.
- Búsqueda por nombre/cédula (con debounce).
- Pull-to-refresh + infinite scroll (paginación).
- Menú contextual por tarjeta: Editar, Eliminar, Agregar a Campaña.
- **Nueva Solicitud:** formulario modal/bottom sheet.
- **Detalle de Solicitud:** pantalla completa con:
  - Datos del cliente.
  - Historial de gestiones.
  - Botón de gestión rápida.
  - Botón WhatsApp (abrir chat).
  - Flag "Ya no aplica para crédito" (👍👎).

### Fase 2: Campañas por Lotes (Semanas 6-8)

**Objetivo:** Gestión de campañas, el módulo más usado.

#### Landing de Campañas
- Grid de tarjetas con semáforo (colores de estado).
- Selector de estados en hero.
- Búsqueda global de solicitudes en todas las campañas.
- Badge de prioridad (⏱️ tiempo sin seguimiento).

#### Detalle de Campaña (Gestión por Lotes)
- Header con nombre, progreso, asignado.
- Tarjetas de solicitudes con:
  - Selector de semáforo (tap → bottom sheet con opciones).
  - Texto de seguimiento (tap para expandir).
  - Menú ⋮: Historial, Recordatorio, No aplica crédito.
- **Gestión Rápida:** bottom sheet con:
  - Selector de resultado (no_contesta, interesado, etc.).
  - Campo de observación.
  - Temporizador de llamada (iniciar/detener).
  - Botón guardar.
- **Historial de Campaña:** bottom sheet con lista de gestiones.
- **Recordatorios:** crear, posponer, marcar hecho.
- Botón "Completar Campaña".

### Fase 3: Relaciones + Equipo (Semanas 9-11)

**Objetivo:** Módulos secundarios pero importantes.

#### Relaciones
- Listado de relaciones (ALTA/BAJA).
- Filtros por estado.
- Detalle de relación.
- Crear nueva relación.

#### Equipo (Panel del Líder)
- 3 tabs: Resumen, Agentes, Campañas.
- Detalle de agente (pantalla completa).
  - Estadísticas personales.
  - Campañas asignadas.
  - Actividad reciente.
- Campañas clicables.

### Fase 4: Módulos Restantes (Semanas 12-14)

**Objetivo:** Completar todas las pantallas.

- **Historial:** línea de tiempo de actualizaciones.
- **Ventas:** control de ventas por vendedor, bonos.
- **Plantillas:** CRUD de plantillas WhatsApp, variable `{nombre}`.
- **Calendario Recordatorios:** vista de mes + lista del día.
- **Importar Excel:** selección de archivo, preview, confirmación.
- **Perfil:** editar nombre, email, cambiar contraseña.
- **Notificaciones:** centro de notificaciones (lista, leer, archivar).

### Fase 5: Notificaciones Push + Offline (Semanas 15-16)

**Objetivo:** Funcionalidades nativas que la web no puede dar.

#### Notificaciones Push (FCM)
- Integrar Firebase para iOS + Android.
- Token FCM registrado al login.
- Manejo de notificación en foreground (in-app).
- Deep link: tap en notificación → pantalla específica.
- Recordatorios push reales (no solo SSE).

#### Offline
- Caché de datos leídos recientemente (solicitudes, campañas).
- Indicador de conectividad.
- Queue de acciones offline (gestiones programadas).

### Fase 6: Polish + Publicación (Semanas 17-18)

**Objetivo:** Preparar para producción.

- Testing completo (unit + widget + integration).
- Performance profiling.
- Animaciones y transiciones.
- Accessibility (VoiceOver/TalkBack).
- Screenshots para App Store / Play Store.
- Build y upload a TestFlight / Internal Track.
- Documentación de usuario.

---

## 5. Fases de Desarrollo (Roadmap)

```
Semanas  1─2   │ Fase 0: Infraestructura
                │ ✦ Proyecto Flutter + tema + routing
                │ ✦ Auth + login + sesión persistente
                │ ✦ API client + drawer + health check
                │
Semanas  3─5   │ Fase 1: Dashboard + Solicitudes
                │ ✦ Dashboard con KPIs + carousel
                │ ✦ Listado solicitudes + filtros + búsqueda
                │ ✦ Detalle solicitud + gestión rápida
                │
Semanas  6─8   │ Fase 2: Campañas por Lotes
                │ ✦ Landing campañas (grid + semáforo)
                │ ✦ Detalle campaña + tarjetas + seguimiento
                │ ✦ Temporizador llamadas + historial + recordatorios
                │
Semanas  9─11  │ Fase 3: Relaciones + Equipo
                │ ✦ Listado/detalle relaciones
                │ ✦ Panel líder (3 tabs + detalle agente)
                │
Semanas 12─14  │ Fase 4: Módulos Restantes
                │ ✦ Historial + Ventas + Plantillas
                │ ✦ Calendario + Importar + Perfil + Notificaciones
                │
Semanas 15─16  │ Fase 5: Push + Offline
                │ ✦ Firebase Cloud Messaging
                │ ✦ Caché offline + indicador de red
                │
Semanas 17─18  │ Fase 6: Polish + Publicación
                │ ✦ Testing + performance + accesibilidad
                │ ✦ Builds + upload stores
```

**Estimación total: ~18 semanas** (4.5 meses) para un solo desarrollador.

> **Nota:** El desarrollo puede acelerarse si se parallelizan fases o si se usa herramientas como `flutter_forge` o `very_good_cli` para boilerplate.

---

## 6. Equivalencia de Pantallas Web → Flutter

### Navegación

| Web (drawer) | Flutter (GoRouter) | Notas |
|---|---|---|
| `/m/` | `/dashboard` | Carousel de widgets |
| `/m/solicitudes` | `/solicitudes` | Listado + filtros |
| — | `/solicitudes/:id` | Detalle (nueva pantalla) |
| `/m/gestiones` | `/campanas` | Landing grid |
| `/m/gestion-lote` | `/campanas/:id` | Detalle campaña |
| `/m/equipo` | `/equipo` | Panel líder |
| `/m/equipo` → agente | `/equipo/agente/:id` | Detalle agente |
| `/m/relaciones` | `/relaciones` | Listado relaciones |
| `/m/historial` | `/historial` | Línea de tiempo |
| `/m/ventas` | `/ventas` | Ventas por vendedor |
| `/m/plantillas` | `/plantillas` | CRUD plantillas |
| `/m/calendario-recordatorios` | `/calendario` | Mes + lista día |
| `/m/importar` | `/importar` | Upload Excel |
| `/perfil` | `/perfil` | Datos + password |
| — | `/notificaciones` | Centro notificaciones |

### Colores y Tema

Se mantiene la paleta de colores actual del proyecto para consistencia visual entre web y móvil.

| Elemento | Color actual (CSS) | Uso en Flutter |
|----------|-------------------|----------------|
| Header/Primary | `#0057B8` (azul) | `ColorScheme.primary` |
| Accent | `#FFC107` (amarillo) | `ColorScheme.secondary` |
| Success/ALTA | `#28a745` (verde) | Badges y semáforo |
| Danger/BAJA | `#dc3545` (rojo) | Badges y alertas |
| Warning | `#ffc107` (amarillo) | Semáforo |
| Info | `#17a2b8` (celeste) | Info badges |
| Background | `#f5f5f5` | `Scaffold.backgroundColor` |
| Card | `#ffffff` | `Card.color` |

### Semáforo de Campañas

El sistema de semáforo actual (v6.1) se traduce a un widget reutilizable en Flutter:

| Estado | Color | Emoji |
|--------|-------|-------|
| Sin clasificar | Gris `#6c757d` | — |
| Seguimiento | Amarillo `#ffc107` | 📞 |
| Encaminadas | Verde `#28a745` | ✅ |
| En espera | Azul `#17a2b8` | ⏸️ |
| Completada | Oculto | — |

---

## 7. Consideraciones de UI/UX

### 7.1 Patrones de Interacción

| Acción Web | Equivalente Flutter | Justificación |
|---|---|---|
| Tap en ⋮ → menú | Long press → bottom sheet | Más nativo en móvil |
| Modal HTML | `showModalBottomSheet` | Patrón Material Design |
| Toast HTML | `SnackBar` con `ScaffoldMessenger` | Estándar Android/iOS |
| Drawer lateral | `NavigationDrawer` o `Drawer` | Estándar Material |
| Pull to refresh | `RefreshIndicator` | Nativo Flutter |
| Infinite scroll | `ListView.builder` + pagination | Nativo Flutter |
| Swipe actions | `Dismissible` | Nativo Flutter |
| Search debounce | `debounce(Duration(milliseconds: 300))` | UX óptima |

### 7.2 Patrones de Formulario

- **Login:** TextFormField con validación inline + loading button.
- **Nueva Solicitud:** Formulario en bottom sheet full-screen.
- **Gestión Rápida:** Bottom sheet con campos dinámicos según resultado.
- **Filtros:** Bottom sheet con chips/switches + botón "Aplicar".

### 7.3 Feedback Visual

- **Loading:** `CircularProgressIndicator` inline (no full-screen).
- **Empty State:** Illustración + texto descriptivo + botón de acción.
- **Error:** SnackBar con retry automático o botón manual.
- **Success:** SnackBar verde con checkmark.
- **Optimistic UI:** Actualizar la UI antes de la respuesta del servidor.

---

## 8. Decisiones Pendientes

| # | Decisión | Opciones | Recomendación |
|---|----------|----------|---------------|
| 1 | **State Management** | Riverpod / Bloc / GetX | **Riverpod** — más flexible, mejor testing |
| 2 | **Navegación** | GoRouter / auto_route / Beamer | **GoRouter** — oficial de Flutter, deep links |
| 3 | **Notificaciones Push** | Firebase / OneSignal / Huawei Push | **Firebase** — más maduro, iOS + Android |
| 4 | **Base de datos local** | sqflite / drift / Hive / Isar | **drift** (sobre sqflite) — type-safe, migraciones |
| 5 | **HTTP Client** | dio / http / Chopper | **Dio** — interceptors, cancelación, retry |
| 6 | **Gráficos** | fl_chart / syncfusion / charts_flutter | **fl_chart** — más ligero, open source |
| 7 | **Almacenamiento seguro** | flutter_secure_storage / shared_preferences | **secure_storage** — para cookies/tokens |
| 8 | **Testing** | mockito / mocktail / bloc_test | **mocktail** — más moderno, null-safe |
| 9 | **CI/CD** | GitHub Actions / Codemagic / Bitrise | **GitHub Actions** — ya tiene repo en GitHub |
| 10 | **Backend changes** | ¿Agregar endpoints JSON nuevos? | Solo si algún endpoint devuelve HTML |

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|-----------|
| API no expone todos los datos como JSON | Media | Alto | Auditar endpoints, agregar los que falten |
| Sesiones HTTP no funcionan igual en Flutter | Media | Alto | Test temprano de auth + cookies |
| Performance en dispositivos bajos | Baja | Medio | Lazy loading, caché, profiling temprano |
| Mantener paridad con web mobile | Alta | Medio | API compartida, mismos features |
| Tiempo de desarrollo subestimado | Media | Medio | Fases independientes, MVP primero |
| iOS App Store rejection | Baja | Alto | Seguir guidelines Apple desde el inicio |
| Firebase setup complejo (iOS certs) | Media | Bajo | Seguir docs oficiales paso a paso |

---

## 10. Criterios de Éxito

### MVP (Fase 0-2, Semanas 1-8)
- [ ] Login funcional con sesión persistente.
- [ ] Dashboard con KPIs visuales.
- [ ] Listado de solicitudes con filtros y búsqueda.
- [ ] Detalle de solicitud con historial.
- [ ] Landing de campañas con grid de tarjetas.
- [ ] Gestión por lotes con seguimiento y temporizador.
- [ ] Drawer de navegación según rol.

### Release 1.0 (Fase 0-4, Semanas 1-14)
- [ ] Todas las pantallas de la web móvil implementadas.
- [ ] Notificaciones in-app.
- [ ] Importar Excel desde el dispositivo.
- [ ] Plantillas de mensajes.
- [ ] Panel del líder completo.

### Release 2.0 (Fase 5-6, Semanas 15-18)
- [ ] Notificaciones push reales.
- [ ] Modo offline para datos críticos.
- [ ] Publicado en App Store + Play Store.
- [ ] Test coverage > 60%.
- [ ] Performance: < 2s carga inicial.

---

## Próximos Pasos

1. **Decidir las decisiones pendientes** (Sección 8) — especialmente state management y notificaciones push.
2. **Setup del proyecto Flutter** con la estructura propuesta.
3. **Auditar la API** — confirmar que todos los endpoints devuelven JSON puro (no HTML).
4. **Implementar Fase 0** — login + routing + drawer como POC.
5. **Evaluación después de Fase 0** — validar que la API funciona bien con Flutter antes de continuar.

---

*Documento de roadmap — Archivox Flutter Móvil — v1.0 — 27/08/2026*
