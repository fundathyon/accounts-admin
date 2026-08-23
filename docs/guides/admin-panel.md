# Guía del panel de administración

Este documento describe **qué puedes ver y hacer en cada zona** del admin (aplicación Next.js bajo el grupo `(admin)`). La interfaz está traducida (i18n); los textos concretos pueden variar según el idioma.

---

## Acceso y sesión

### `/login`

Pantalla de **inicio de sesión del administrador** (usuario y contraseña). Tras un login correcto redirige al panel (o a la ruta indicada en `from`). No forma parte del layout con barra lateral.

---

## Navegación global (barra lateral y pie)

- **Cabecera de la app**: nombre e imagen de la aplicación (si la API devuelve datos de `/api/apps`). Desde el menú desplegable puedes **editar el branding** (nombre e imagen URL del logo) si tienes configurada la API Key secreta.
- **Menú principal**: enlaces a cada sección del admin (véase abajo). Algunas entradas muestran un **indicador** si falta la API Key secreta en ajustes.
- **Notas de versión**: enlace a la página de release notes (pie del sidebar).
- **Menú del usuario** (abajo): acceso rápido a **Ajustes**, **Notificaciones**, selector de **idioma**, **tema** (claro/oscuro), enlace a **documentación** externa y **cerrar sesión**. Si hay migración OAuth pendiente, aparece un **punto de aviso** en el avatar.

El área central muestra el contenido de cada ruta con padding y ancho máximo.

---

## `/` — Panel (Dashboard)

Vista resumen con **conteos** (requieren API Key secreta): usuarios, webhooks, comportamientos, API keys, roles y configuraciones OAuth. Cada tarjeta es un enlace a la sección correspondiente.

---

## `/users` — Usuarios

Con API Key secreta:

- **Lista de usuarios** en tabla: identificador, email/username, métodos de login (iconos OAuth, email con verificado/no verificado), rol, fechas de creación y última actividad.
- **Filtros**: búsqueda por texto, filtro por rol, tipo de login (email, OAuth genérico, Google, Apple, Microsoft), orden reciente/antiguo, opción de **agrupar por rol**.
- **Acciones**: registrar usuario (signup con email/contraseña, rol opcional, verificación por código si aplica), **probar login** (signin y ver tokens), exportar **CSV** o **JSON**, **revocar refresh token** (por JWT o por ID), ver **clave pública JWT** en un modal.
- Menú por fila: **ver detalle** y **eliminar cuenta**.

Sin API Key secreta: mensaje para ir a Ajustes y configurarla.

---

## `/users/[id]` — Detalle de usuario

- **Cabecera** con nombre, ID y rol.
- **Información general**: ID, nombre, nombre de usuario, app ID, **selector de rol** (si hay roles cargados), fechas.
- **Métodos de login**: lista con proveedor, verificación, datos (email copiable, etc.).

---

## `/roles-policies` — Roles

La ruta se llama “roles-policies” en el menú; la pantalla gestiona **roles** de la aplicación.

Con API Key secreta:

- Tabla: nombre, descripción, número de usuarios, app ID, fecha de creación.
- **Crear rol** y, al hacer clic en una fila, **detalle** del rol (ID, metadatos) con opción de **editar**.

Sin clave: aviso para configurar la API Key secreta.

> En esta versión del admin **no hay una pantalla separada para “policies”**; el foco es la gestión de roles.

---

## `/webhooks` — Webhooks

Con API Key secreta:

- Lista de webhooks en **acordeón**: nombre, URL, estado activo/inactivo, número de eventos suscritos, reintentos, fecha.
- Al expandir: descripción, secreto (mascarado), ID, eventos suscritos, botones **editar**, **eliminar**, **activar/desactivar** y **enviar evento de prueba** (navega a la subruta de test).
- **Nuevo webhook**: formulario (nombre, URL, secreto, reintentos, activo) o edición en **JSON**; selección de eventos por categorías (incluye eventos “comunes” fijos arriba).

Sin clave: flujo guiado hacia Ajustes.

---

## `/webhooks/[id]/test` — Prueba de webhook

Página para un webhook concreto: carga el webhook, permite **elegir un tipo de evento** de prueba (con payload por defecto editable en JSON) y **enviar** el test al endpoint de pruebas de la API.

---

## `/api-keys` — API Keys

- Lista de **claves de API** (publishable, entorno, etc.) con búsqueda, filtro por entorno y orden.
- **Generar** nuevas claves asociadas a una app (modal con app, nombre, descripción); tras generar se muestran las claves.
- Acciones sobre una clave seleccionada (p. ej. desactivar), según implementación del resto del archivo.

La generación de pares publishable/secret suele requerir flujos del backend; consultar la UI concreta.

---

## `/oauth-providers` — Proveedores OAuth

Con API Key secreta:

- Tabla de configuraciones OAuth: proveedor, nombre, client ID, estado, callback URI.
- **Nuevo proveedor** / edición: Google, Microsoft, Apple, GitHub; client ID/secret; **callback** generado automáticamente o regenerado; **scopes**; lista de **redirects** por plataforma (web, Android, iOS, desktop); interruptor activado/desactivado.
- **Detalle** al hacer clic en fila: IDs, URIs copiables, **obtener enlace OAuth** (plataforma, rol, URL de redirect), opciones para editar, deshabilitar/habilitar o eliminar.
- **Banner de migración** si el backend indica redirects legacy pendientes; acción para **aplicar migración**.

Sin clave o sin publishable donde aplique: avisos y enlaces a Ajustes.

---

## `/behaviors` — Comportamientos

Lista en **tarjetas** de comportamientos de la app (`behavior_code`), estado activo/inactivo, fechas. Cada tarjeta enlaza al detalle `/behaviors/[id]`.

---

## `/behaviors/[id]` — Detalle de comportamiento

Muestra la configuración del comportamiento según su tipo. Para **`email_auth`** incluye vista de configuración de autenticación por email, posibilidad de **activar/desactivar verificación por email** y **editar** la configuración (formulario dedicado).

---

## `/email-templates` — Plantillas de email

- Lista de plantillas desde la API del sistema.
- Selector de plantilla, **variables** editables por plantilla, **vista previa HTML** en iframe (actualización con debounce).
- Opción de **enviar email de prueba** (diálogo con dirección).

No depende de la API Key del admin en el mismo sentido que otras secciones; usa endpoints de sistema (`/api/system/email-templates`).

---

## `/tokens` — Tokens (JWT)

Herramientas para **trabajar con tokens** sin listar usuarios:

- Pestañas **Access** y **Refresh**: pegar JWT, **validar** contra el backend, ver **decodificación** de header y payload (JSON o tabla de claims, con ayuda en `exp`).
- Botón **Obtener access token**: diálogo donde pegas un **refresh token** y obtienes un nuevo JWT de acceso (y copiar).

---

## `/settings` — Ajustes

- **API Key secreta**: guardar o borrar (se usa en el cliente para llamadas administrativas; no se rellena sola por seguridad).
- **API Key publishable**: guardar o borrar (signup/signin OAuth desde el admin, etc.).
- **Variables de entorno**: botón para cargar lista desde el servidor; valores sensibles enmascarados con opción de revelar según política del backend.
- **Notas de seguridad** (texto fijo traducido).

---

## `/notifications` — Notificaciones

Centro de **avisos pendientes** del sistema. Actualmente destacan:

- **Migración OAuth** (redirects legacy): lista de proveedores afectados y botón para **ejecutar la migración**, más enlace a Proveedores OAuth.
- Sección de **recientes** (placeholder si no hay historial en UI).

Requiere API Key secreta configurada (también intenta leer de almacenamiento local si aplica).

---

## `/release-notes` — Notas de versión

Página estática de **historial de versiones** del producto (contenido desde i18n): secciones por versión con listas de cambios (OAuth, redirects, admin, usuarios, etc.).

---

## Dependencias entre secciones

| Necesidad | Dónde configurarla |
|-----------|-------------------|
| La mayoría de listados y acciones de administración | **Ajustes** → API Key secreta |
| Registro/login de prueba de usuarios, enlaces OAuth | **Ajustes** → API Key publishable |
| Primera vez / onboarding | El asistente de **Onboarding** puede pedirte las claves antes de usar el resto del panel |

---

*Versión del admin en sidebar al momento de escribir esta guía: referencia en `admin-sidebar.tsx` (p. ej. `0.2.0`).*
