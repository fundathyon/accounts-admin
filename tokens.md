# Validación de tokens y renovación de access token

Esta guía describe cómo **validar** un access token o un refresh token y cómo **obtener un nuevo access token** a partir de un refresh token.

---

## Base URL

Si en tu entorno está configurado `ROOT_PATH` (por ejemplo `/accounts`), antepón ese valor a las rutas. Ejemplos:

- Sin `ROOT_PATH`: `http://localhost:8080/api/v1/validate-access` o `http://localhost:8080/api/v1/validate-refresh`
- Con `ROOT_PATH=/accounts`: `http://localhost:8080/accounts/api/v1/validate-access` o `.../api/v1/validate-refresh`

En los ejemplos se usa la ruta relativa `/api/v1/...`. Sustituye el host y el puerto por los de tu API.

---

## 1. Validar tokens

Hay dos endpoints para validar si un JWT es válido (firma correcta y no expirado):

- **`GET /api/v1/validate-access`** — para el **access token**.
- **`GET /api/v1/validate-refresh`** — para el **refresh token**.

### Request (ambos)

- **Método:** `GET`
- **Header:** `Authorization: Bearer <token>`

### Ejemplos con cURL

**Validar access token:**

```bash
curl -X GET "http://localhost:8080/api/v1/validate-access" \
  -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

**Validar refresh token:**

```bash
curl -X GET "http://localhost:8080/api/v1/validate-refresh" \
  -H "Authorization: Bearer TU_REFRESH_TOKEN"
```

### Respuesta exitosa (200)

```json
{
  "data": {
    "is_valid": true,
    "entity_type": "oauth"
  },
  "success": true,
  "status_code": 200
}
```

### Respuesta cuando el token es inválido o expirado (401)

El cuerpo incluirá un mensaje de error indicando que el token no es válido o ha expirado.

---

## 2. Obtener un nuevo access token a partir del refresh token

El endpoint **`GET /api/v1/refresh-jwt`** intercambia un **refresh token** válido por un nuevo **access token** (JWT). El refresh token que envías se mantiene válido; la respuesta devuelve el mismo refresh token y el nuevo access token.

### Request

- **Método:** `GET`
- **URL:** `/api/v1/refresh-jwt`
- **Header:** `Authorization: Bearer <refresh_token>`

### Ejemplo con cURL

```bash
curl -X GET "http://localhost:8080/api/v1/refresh-jwt" \
  -H "Authorization: Bearer TU_REFRESH_TOKEN"
```

### Respuesta exitosa (201)

```json
{
  "data": {
    "jwt": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9..."
  },
  "success": true,
  "status_code": 201
}
```

- **`jwt`**: nuevo access token para usar en llamadas protegidas (`Authorization: Bearer <jwt>`).
- **`refresh_token`**: mismo refresh token que enviaste; úsalo de nuevo cuando necesites renovar el access token.

### Errores habituales

- **401**: Refresh token inválido o expirado. El usuario debe volver a iniciar sesión (login o OAuth).
- **404**: Refresh token no encontrado en base de datos (revocado o eliminado).

---

## 3. Información del usuario a partir del token (opcional)

**`GET /api/v1/jwt/info`** devuelve información del usuario asociada al token (normalmente se usa con el refresh token).

```bash
curl -X GET "http://localhost:8080/api/v1/jwt/info" \
  -H "Authorization: Bearer TU_REFRESH_TOKEN"
```

---

## Resumen de endpoints

| Acción                         | Método | Endpoint            | Header                  |
|--------------------------------|--------|---------------------|-------------------------|
| Validar access token  | GET    | `/api/v1/validate-access`  | `Authorization: Bearer <access_token>`  |
| Validar refresh token | GET    | `/api/v1/validate-refresh` | `Authorization: Bearer <refresh_token>` |
| Obtener nuevo access token | GET | `/api/v1/refresh-jwt`  | `Authorization: Bearer <refresh_token>` |
| Info del usuario      | GET    | `/api/v1/jwt/info`     | `Authorization: Bearer <refresh_token>` |

Todos los endpoints esperan el token en el header **Authorization** con el prefijo **Bearer** y un espacio antes del token.

---

## Comportamiento en la UI (tabs y botón Copiar)

Si en tu app muestras los tokens en **pestañas** (por ejemplo "Access Token" y "Refresh Token") con un **botón de copiar**:

- **Siempre** deja visibles las pestañas y el botón de copiar.
- Cuando **no haya JWT** (valor vacío en la pestaña activa), el botón de copiar debe seguir visible pero **desactivado** (`disabled`), para que la disposición no cambie y el usuario entienda que puede copiar cuando haya token.

### Ejemplo mínimo (HTML + JS)

```html
<div class="token-block">
  <!-- Tabs siempre visibles -->
  <div class="tabs">
    <button type="button" class="tab active" data-tab="access">Access Token</button>
    <button type="button" class="tab" data-tab="refresh">Refresh Token</button>
  </div>
  <div class="content-row">
    <pre class="token-content" id="token-content"></pre>
    <!-- Botón Copiar siempre visible; desactivado si no hay JWT -->
    <button type="button" id="copy-btn" disabled title="Sin token para copiar">Copiar</button>
  </div>
</div>

<script>
  const accessToken = '';   // o el JWT cuando lo tengas
  const refreshToken = '';  // o el JWT cuando lo tengas
  const tabs = document.querySelectorAll('.tab');
  const content = document.getElementById('token-content');
  const copyBtn = document.getElementById('copy-btn');

  let activeTab = 'access';
  const values = { access: accessToken, refresh: refreshToken };

  function updateUI() {
    const text = values[activeTab] || '';
    content.textContent = text || '(no hay token)';
    copyBtn.disabled = !text.trim();
    copyBtn.title = copyBtn.disabled ? 'Sin token para copiar' : 'Copiar al portapapeles';
  }

  tabs.forEach(t => {
    t.addEventListener('click', () => {
      tabs.forEach(x => x.classList.remove('active'));
      t.classList.add('active');
      activeTab = t.dataset.tab;
      updateUI();
    });
  });

  copyBtn.addEventListener('click', () => {
    const text = values[activeTab];
    if (text && navigator.clipboard) navigator.clipboard.writeText(text);
  });

  updateUI();
</script>
```

En frameworks (React, Vue, etc.): renderiza siempre las pestañas y el botón; pasa `disabled={!accessToken}` (o la variable del token activo) al botón de copiar.
