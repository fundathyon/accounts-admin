# Roles

Guía para gestionar roles: listar, crear, **actualizar** y **eliminar** roles de la aplicación, y cómo responde la API.

---

## Base URL

Si está configurado `ROOT_PATH` (por ejemplo `/accounts`), antepón ese valor a las rutas:

- Sin `ROOT_PATH`: `http://localhost:8080/api/v1/roles`
- Con `ROOT_PATH=/accounts`: `http://localhost:8080/accounts/api/v1/roles`

Todos los endpoints requieren **API Key secreta** en el header:

```http
X-API-KEY: sk_tu_api_key_secreta
```

---

## Listar roles (GET)

Obtiene la lista de roles de la aplicación con paginación.

### Request

- **Método:** `GET`
- **URL:** `/api/v1/roles`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)
- **Query (opcionales):**
  - `page` – Número de página (desde 0). Por defecto: `0`
  - `size` – Tamaño de página. Por defecto: `10` (máximo 100)
  - `offset` – Elementos a saltar. Por defecto: `0`

### Ejemplo cURL

```bash
curl -X GET "http://localhost:8080/api/v1/roles?page=0&size=10" \
  -H "X-API-KEY: sk_tu_api_key_secreta"
```

### Respuesta exitosa (200)

La respuesta incluye los roles y metadatos de paginación (total, enlaces, etc.).

```json
{
  "data": [...],
  "success": true,
  "status_code": 200
}
```

---

## Crear rol (POST)

Crea un nuevo rol en la aplicación.

### Request

- **Método:** `POST`
- **URL:** `/api/v1/roles`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)
- **Header:** `Content-Type: application/json`
- **Body:** JSON con los datos del rol.

### Campos del body

| Campo         | Tipo   | Obligatorio | Descripción |
|---------------|--------|-------------|-------------|
| `name`        | string | Sí          | Nombre del rol (único por aplicación) |
| `description` | string | No          | Descripción del rol |

### Ejemplo cURL

```bash
curl -X POST "http://localhost:8080/api/v1/roles" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "admin",
    "description": "Rol con permisos de administración"
  }'
```

---

## Actualizar rol (PATCH)

Permite modificar un rol existente por ID. Solo se actualizan los campos que envíes en el body (PATCH parcial).

### Request

- **Método:** `PATCH`
- **URL:** `/api/v1/roles/:id`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)
- **Header:** `Content-Type: application/json`
- **Body:** JSON con los campos a actualizar (al menos uno).

### Campos del body (todos opcionales)

| Campo         | Tipo   | Descripción |
|---------------|--------|-------------|
| `name`        | string | Nombre del rol |
| `description` | string | Descripción del rol |

### Ejemplos cURL

**Solo descripción:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/roles/EL_ID_DEL_ROL" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{"description": "Administrador del sistema"}'
```

**Nombre y descripción:**

```bash
curl -X PATCH "http://localhost:8080/api/v1/roles/EL_ID_DEL_ROL" \
  -H "X-API-KEY: sk_tu_api_key_secreta" \
  -H "Content-Type: application/json" \
  -d '{"name": "superadmin", "description": "Rol con todos los permisos"}'
```

Sustituye `EL_ID_DEL_ROL` por el `id` que obtienes al listar (GET) o al crear (POST).

---

## Eliminar rol (DELETE)

Elimina de forma permanente un rol por ID. El rol debe pertenecer a la aplicación del API Key.

### Request

- **Método:** `DELETE`
- **URL:** `/api/v1/roles/:id`
- **Header:** `X-API-KEY: sk_xxx` (obligatorio)

No se envía body.

### Ejemplo cURL

```bash
curl -X DELETE "http://localhost:8080/api/v1/roles/EL_ID_DEL_ROL" \
  -H "X-API-KEY: sk_tu_api_key_secreta"
```

### Respuestas

- **200:** Se devuelve el último estado del rol eliminado en `data`.
- **400:** Falta `id` o no se proporcionó API Key.
- **401:** API Key inválida.
- **404:** Rol no encontrado o no pertenece a la app.
- **500:** Error interno al eliminar.

---

## Cómo responde la API

### Respuesta exitosa (200 / 201)

```json
{
  "data": {
    "id": "uuid-del-rol",
    "app_id": "uuid-de-la-app",
    "name": "admin",
    "description": "Rol con permisos de administración",
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

Cuando faltan campos obligatorios o no se envía ningún campo a actualizar (PATCH):

```json
{
  "error": {
    "code": 400,
    "message": "at least one field to update is required",
    "scope": "roles.update.fields_required"
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

El rol no existe o no pertenece a la app del `X-API-KEY`:

```json
{
  "error": {
    "code": 404,
    "message": "Role not found",
    "scope": "roles.update.not_found"
  },
  "success": false,
  "status_code": 404
}
```

### Error 409 – Conflict

Al crear, si el nombre del rol ya existe para la aplicación:

```json
{
  "error": { ... },
  "success": false,
  "status_code": 409
}
```

### Error 500 – Internal Server Error

Error interno (por ejemplo base de datos):

```json
{
  "error": {
    "code": 500,
    "message": "Error updating role: ...",
    "scope": "roles.update.error"
  },
  "success": false,
  "status_code": 500
}
```

---

## Resumen de endpoints

| Acción           | Método | Ruta                | Descripción |
|------------------|--------|---------------------|-------------|
| Listar roles     | GET    | `/api/v1/roles`     | Lista roles con paginación (page, size, offset) |
| Crear rol        | POST   | `/api/v1/roles`     | Crea un nuevo rol |
| Actualizar rol   | PATCH  | `/api/v1/roles/:id` | Actualiza por ID (parcial) |
| Eliminar rol     | DELETE | `/api/v1/roles/:id` | Elimina el rol por ID |

Todos requieren el header `X-API-KEY` con API Key secreta (`sk_xxx`).
