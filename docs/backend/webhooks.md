# Webhooks

Guía para gestionar webhooks: listar eventos disponibles, crear, listar, **actualizar** y **eliminar** configuraciones de webhooks, y cómo responde la API.

---

## Base URL

Si está configurado `ROOT_PATH` (por ejemplo `/accounts`), antepón ese valor a las rutas:

- Sin `ROOT_PATH`: `http://localhost:8080/api/v1/webhooks`
- Con `ROOT_PATH=/accounts`: `http://localhost:8080/accounts/api/v1/webhooks`

Los endpoints protegidos requieren **API Key secreta** en el header:

```http
X-API-KEY: sk_tu_api_key_secreta
```

El endpoint **GET /api/v1/webhooks/events** es público (no requiere autenticación).

---

## Listar eventos disponibles (GET events)

Obtiene la lista de todos los eventos que puedes suscribir en un webhook, organizados por categoría. **No requiere autenticación.**

### Request

- **Método:** `GET`
- **URL:** `/api/v1/webhooks/events`

### Ejemplo cURL

```bash
curl "http://localhost:8080/api/v1/webhooks/events"
```

### Respuesta exitosa (200)

```json
{
  "success": true,
  "status_code": 200,
  "data": {
    "User": [
      { "code": "accounts.user.signup", "description": "Triggered when a new user signs up", "category": "User" }
    ],
    "Auth": [
      { "code": "accounts.auth.login", "description": "Triggered when a user successfully logs in", "category": "Auth" }
    ]
  }
}
```

---

## Listar webhooks (GET)

Obtiene todos los webhooks configurados para la aplicación.

### Request

- **Método:** `GET`
- **URL:** `/api/v1/webhooks`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)

### Ejemplo cURL

```bash
curl -X GET "http://localhost:8080/api/v1/webhooks" \
  -H "X-API-KEY: sk_tu_api_key_secreta"
```

---

## Crear webhook (POST)

Crea un nuevo webhook para recibir notificaciones de eventos en la URL indicada.

### Request

- **Método:** `POST`
- **URL:** `/api/v1/webhooks`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)
- **Header:** `Content-Type: application/json`
- **Body:** JSON con los datos del webhook.

### Campos del body

| Campo         | Tipo     | Obligatorio | Descripción |
|---------------|----------|-------------|-------------|
| `name`        | string   | Sí          | Nombre del webhook |
| `description` | string   | No          | Descripción |
| `url`         | string   | Sí          | URL que recibirá los eventos (debe ser URL válida) |
| `secret`      | string   | Sí          | Secreto para firmar/verificar las peticiones |
| `events`      | []string | Sí (mín. 1) | Códigos de eventos (consultar GET /webhooks/events) |
| `active`      | boolean  | No          | Si está activo (por defecto `true`) |
| `retries`     | integer  | No          | Reintentos (0–10, por defecto 3) |

### Ejemplo cURL

```bash
curl -X POST "http://localhost:8080/api/v1/webhooks" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "User Events Webhook",
    "description": "Eventos de usuario",
    "url": "https://api.myapp.com/webhooks/users",
    "secret": "mi-secreto-webhook",
    "events": ["accounts.user.signup", "accounts.user.updated"],
    "active": true,
    "retries": 3
  }'
```

---

## Actualizar webhook (PATCH)

Permite modificar un webhook existente por ID. Solo se actualizan los campos que envíes en el body (PATCH parcial). También puedes usar este endpoint para activar o desactivar el webhook enviando solo `"active": true` o `"active": false`.

### Request

- **Método:** `PATCH`
- **URL:** `/api/v1/webhooks/:id`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)
- **Header:** `Content-Type: application/json`
- **Body:** JSON con los campos a actualizar (al menos uno).

### Campos del body (todos opcionales)

| Campo         | Tipo     | Descripción |
|---------------|----------|-------------|
| `name`        | string   | Nombre del webhook |
| `description` | string   | Descripción |
| `url`         | string   | URL que recibirá los eventos |
| `secret`      | string   | Secreto para firmar las peticiones |
| `events`      | []string | Códigos de eventos (válidos según GET /webhooks/events) |
| `active`      | boolean  | Activar o desactivar el webhook |
| `retries`     | integer  | Número de reintentos (0–10) |

### Ejemplos cURL

**Solo activar/desactivar:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/webhooks/EL_ID_DEL_WEBHOOK" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{"active": false}'
```

**Actualizar nombre y URL:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/webhooks/EL_ID_DEL_WEBHOOK" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Webhook Producción",
    "url": "https://api.ejemplo.com/webhooks/v2"
  }'
```

**Actualizar eventos:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/webhooks/EL_ID_DEL_WEBHOOK" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{"events": ["accounts.user.signup", "accounts.auth.login"]}'
```

Sustituye `EL_ID_DEL_WEBHOOK` por el `id` que obtienes al listar (GET) o al crear (POST).

---

## Eliminar webhook (DELETE)

Elimina de forma permanente un webhook por ID. El webhook debe pertenecer a la aplicación del API Key.

### Request

- **Método:** `DELETE`
- **URL:** `/api/v1/webhooks/:id`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)

No se envía body.

### Ejemplo cURL

```bash
curl -X DELETE "http://localhost:8080/api/v1/webhooks/EL_ID_DEL_WEBHOOK" \
  -H "X-API-KEY: sk_tu_api_key_secreta"
```

### Respuestas

- **200:** Se devuelve el último estado del webhook eliminado en `data`.
- **400:** Falta `id` o no se proporcionó API Key.
- **401:** API Key inválida.
- **404:** Webhook no encontrado o no pertenece a la app.
- **500:** Error interno al eliminar.

---

## Cómo responde la API (endpoints protegidos)

Las respuestas siguen un formato común en los endpoints de webhooks que requieren autenticación.

### Respuesta exitosa (200 / 201)

```json
{
  "data": {
    "id": "uuid-del-webhook",
    "app_id": "uuid-de-la-app",
    "name": "User Events Webhook",
    "description": "Eventos de usuario",
    "url": "https://api.myapp.com/webhooks/users",
    "secret": "***",
    "events": ["accounts.user.signup", "accounts.user.updated"],
    "active": true,
    "retries": 3,
    "created_at": "2026-02-24T12:00:00Z",
    "updated_at": "2026-02-24T14:30:00Z",
    "is_removed": false
  },
  "success": true,
  "status_code": 200
}
```

En creación el `status_code` será 201.

### Error 400 – Bad Request

Cuando faltan campos obligatorios, no se envía ningún campo a actualizar (PATCH) o los datos no son válidos (por ejemplo eventos inválidos):

```json
{
  "error": {
    "code": 400,
    "message": "at least one field to update is required",
    "scope": "webhooks.update.fields_required"
  },
  "success": false,
  "status_code": 400
}
```

### Error 401 – Unauthorized

API Key ausente o inválida:

```json
{
  "error": {
    "code": 401,
    "message": "Invalid API Key provided",
    "scope": "oauths.invalid_api_key"
  },
  "success": false,
  "status_code": 401
}
```

### Error 404 – Not Found

El webhook no existe o no pertenece a la app del `X-API-KEY`:

```json
{
  "error": {
    "code": 404,
    "message": "Webhook not found",
    "scope": "webhooks.update.not_found"
  },
  "success": false,
  "status_code": 404
}
```

### Error 500 – Internal Server Error

Error interno (por ejemplo base de datos):

```json
{
  "error": {
    "code": 500,
    "message": "Error updating webhook: ...",
    "scope": "webhooks.update.error"
  },
  "success": false,
  "status_code": 500
}
```

---

## Resumen de endpoints

| Acción                  | Método | Ruta                      | Auth | Descripción |
|-------------------------|--------|---------------------------|------|-------------|
| Listar eventos          | GET    | `/api/v1/webhooks/events` | No   | Lista eventos disponibles para suscripción |
| Listar webhooks         | GET    | `/api/v1/webhooks`        | Sí   | Lista webhooks de la app |
| Crear webhook           | POST   | `/api/v1/webhooks`        | Sí   | Crea un nuevo webhook |
| Actualizar webhook      | PATCH  | `/api/v1/webhooks/:id`    | Sí   | Actualiza por ID (parcial, incl. active) |
| Eliminar webhook        | DELETE | `/api/v1/webhooks/:id`    | Sí   | Elimina el webhook por ID |

Los que indican **Auth: Sí** requieren el header `X-API-KEY` con API Key secreta (`sk_xxx`).
