# Configuración OAuth

Guía para gestionar las configuraciones OAuth de la aplicación (crear, listar, **actualizar**) y cómo responde la API.

---

## Base URL

Si está configurado `ROOT_PATH` (por ejemplo `/accounts`), antepón ese valor a las rutas:

- Sin `ROOT_PATH`: `http://localhost:8080/api/v1/oauth-configs`
- Con `ROOT_PATH=/accounts`: `http://localhost:8080/accounts/api/v1/oauth-configs`

Todos los endpoints de este módulo requieren **API Key secreta** en el header:

```http
X-API-KEY: sk_tu_api_key_secreta
```

---

## Actualizar una configuración OAuth (PATCH)

Permite modificar una configuración existente por ID. Solo se actualizan los campos que envíes en el body (PATCH parcial).

### Request

- **Método:** `PATCH`
- **URL:** `/api/v1/oauth-configs/:id`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)
- **Header:** `Content-Type: application/json`
- **Body:** JSON con los campos a actualizar (al menos uno).

### Campos del body (todos opcionales)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `provider` | string | `"google"` o `"microsoft"` |
| `name` | string | Etiqueta/nombre de la configuración |
| `client_id` | string | Client ID del proveedor OAuth |
| `client_secret` | string | Client Secret |
| `callback_key` | string | Clave usada en la URI de callback |
| `callback_uri` | string | URI completa de callback registrada en el proveedor |
| `scopes` | string | Scopes separados por espacios (ej. `"email profile openid"`) |
| `enabled` | boolean | `true` / `false` |
| `redirect_uri_web` | string | URI de redirección para web |
| `redirect_uri_android` | string | URI para Android |
| `redirect_uri_ios` | string | URI para iOS |
| `redirect_uri_desktop` | string | URI para desktop |

### Ejemplos cURL

**Actualizar nombre y URIs de redirección:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/oauth-configs/EL_ID_DE_LA_CONFIG" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Web App Producción",
    "enabled": true,
    "redirect_uri_web": "https://app.ejemplo.com/auth/callback",
    "redirect_uri_android": "com.yourapp://auth/callback",
    "redirect_uri_ios": "yourapp://auth/callback",
    "redirect_uri_desktop": "http://localhost:3000/auth/callback"
  }'
```

**Solo nombre y estado:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/oauth-configs/EL_ID_DE_LA_CONFIG" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{"name": "Mi Google OAuth", "enabled": true}'
```

**Actualizar credenciales (client_id / client_secret):**

```bash
curl -X PATCH "http://localhost:8080/api/v1/oauth-configs/EL_ID_DE_LA_CONFIG" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "nuevo-client-id.apps.googleusercontent.com",
    "client_secret": "nuevo-client-secret"
  }'
```

Sustituye `EL_ID_DE_LA_CONFIG` por el `id` que obtienes al listar (GET) o al crear (POST) una configuración.

---

## Eliminar una configuración OAuth (DELETE)

Elimina de forma permanente una configuración OAuth por ID. La configuración debe pertenecer a la aplicación del API Key.

### Request

- **Método:** `DELETE`
- **URL:** `/api/v1/oauth-configs/:id`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)

No se envía body.

### Ejemplo cURL

```bash
curl -X DELETE "http://localhost:8080/api/v1/oauth-configs/EL_ID_DE_LA_CONFIG" \
  -H "X-API-KEY: sk_tu_api_key_secreta"
```

### Respuestas

- **200:** Se devuelve el último estado de la configuración eliminada en `data`.
- **400:** Falta `id` o no se proporcionó API Key.
- **401:** API Key inválida.
- **404:** Configuración no encontrada o no pertenece a la app.
- **500:** Error interno al eliminar.

---

## Deshabilitar una configuración OAuth (POST disable)

Pone `enabled=false` en una configuración OAuth por ID. La configuración deja de usarse para login OAuth pero no se borra. La configuración debe pertenecer a la aplicación del API Key.

### Request

- **Método:** `POST`
- **URL:** `/api/v1/oauth-configs/:id/disable`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)

No se envía body.

### Ejemplo cURL

```bash
curl -X POST "http://localhost:8080/api/v1/oauth-configs/EL_ID_DE_LA_CONFIG/disable" \
  -H "X-API-KEY: sk_tu_api_key_secreta"
```

### Respuestas

- **200:** Se devuelve la configuración actualizada con `enabled: false` en `data`.
- **400:** Falta `id` o no se proporcionó API Key.
- **401:** API Key inválida.
- **404:** Configuración no encontrada o no pertenece a la app.
- **500:** Error interno al deshabilitar.

---

## Cómo responde la API

Las respuestas siguen el mismo formato en todos los endpoints de oauth-configs.

### Respuesta exitosa (200)

```json
{
  "data": {
    "id": "uuid-de-la-config",
    "app_id": "uuid-de-la-app",
    "provider": "google",
    "name": "Web App Producción",
    "client_id": "xxx.apps.googleusercontent.com",
    "client_secret": "***",
    "callback_key": "abc123",
    "callback_uri": "https://accounts.com/api/oauth/abc123",
    "scopes": "email profile openid",
    "enabled": true,
    "created_at": "2026-02-24T12:00:00Z",
    "updated_at": "2026-02-24T14:30:00Z",
    "redirect_uri_web": "https://app.ejemplo.com/auth/callback",
    "redirect_uri_android": "com.yourapp://auth/callback",
    "redirect_uri_ios": "yourapp://auth/callback",
    "redirect_uri_desktop": "http://localhost:3000/auth/callback"
  },
  "success": true,
  "status_code": 200
}
```

En algunos entornos la respuesta puede incluir también `trace_id`.

### Error 400 – Bad Request

Cuando falta `id`, no se envía ningún campo a actualizar o el body no es válido:

```json
{
  "error": {
    "code": 400,
    "message": "at least one field to update is required",
    "scope": "oauth_configs.update.fields_required"
  },
  "success": false,
  "status_code": 400
}
```

Otros ejemplos: `id is required`, `app_id is required (missing API key auth)`.

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

La configuración no existe o no pertenece a la app del `X-API-KEY`:

```json
{
  "error": {
    "code": 404,
    "message": "OAuth configuration not found for this application and provider",
    "scope": "oauths.config_not_found"
  },
  "success": false,
  "status_code": 404
}
```

### Error 500 – Internal Server Error

Error interno al actualizar (por ejemplo base de datos):

```json
{
  "error": {
    "code": 500,
    "message": "Error updating OAuth config: ...",
    "scope": "oauth_configs.update.error"
  },
  "success": false,
  "status_code": 500
}
```

---

## Otros endpoints del módulo

| Acción | Método | Ruta | Descripción |
|--------|--------|------|-------------|
| Listar configuraciones | GET | `/api/v1/oauth-configs` | Lista todas las configuraciones OAuth de la app |
| Crear configuración | POST | `/api/v1/oauth-configs` | Crea una nueva configuración (provider, client_id, client_secret, callback, redirect URIs, etc.) |
| Actualizar configuración | PATCH | `/api/v1/oauth-configs/:id` | Actualiza por ID (solo los campos enviados) |
| Eliminar configuración | DELETE | `/api/v1/oauth-configs/:id` | Elimina de forma permanente la configuración por ID |
| Deshabilitar configuración | POST | `/api/v1/oauth-configs/:id/disable` | Pone `enabled=false` en la configuración por ID |
| Obtener link de autorización | GET | `/api/v1/oauth-configs/link` | Devuelve la URL de autorización OAuth (query: `provider`, `platform`, `role`) |

Todos requieren header `X-API-KEY` con API Key secreta (`sk_xxx`).
