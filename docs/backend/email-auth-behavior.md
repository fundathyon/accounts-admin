# Guía de Actualización del Behavior email_auth

Esta documentación explica cómo actualizar la configuración del behavior `email_auth`. Tras explorar el endpoint de creación, se ha determinado la estructura completa que este comportamiento utiliza y las vías para su modificación.

## Estructura de Configuración

El behavior `email_auth` centraliza la lógica de identificación, seguridad de contraseñas, acceso sin contraseña (magic link) y validación de identidad. Todo esto reside en el campo `config` del objeto behavior.

### Esquema Detallado de `config`

A continuación se muestra un ejemplo de la configuración completa que puede enviarse:

```json
{
  "identifier": "email",
  "email": {
    "enabled": true,
    "allow_plus_alias": true,
    "normalize": {
      "trim": true,
      "lowercase": true
    }
  },
  "password": {
    "enabled": true,
    "policy": {
      "min_length": 8,
      "max_length": 72,
      "min_uppercase": 1,
      "min_lowercase": 1,
      "min_digits": 1,
      "min_special_char": 1,
      "special_chars": ["*", "&", "$", "!", "@", "#"],
      "deny_common_passwords": true
    }
  },
  "magic_link": {
    "enabled": true,
    "ttl_seconds": 900,
    "window_seconds": 900,
    "max_attempts_per_window": 5,
    "single_use": true,
    "bind_to_ip": false,
    "bind_to_user_agent": true
  },
  "verification": {
    "enabled": false,
    "mode": "email_code",
    "code_type": "numeric",
    "code_size": 6,
    "ttl_seconds": 900
  }
}
```

## Mecanismos de Actualización

### 1. Vía Endpoints Especializados
Para cambios comunes y riesgosos (como la verificación de cuenta), el sistema ofrece endpoints atómicos:

*   **Activar Verificación**: `POST /api/v1/app-behaviors/email/verification/activate`
    *   Este endpoint realiza un *merge* inteligente. Si el nodo `verification` no existe, lo crea. Si existe, actualiza solo los campos enviados en el body.
*   **Desactivar Verificación**: `POST /api/v1/app-behaviors/email/verification/deactivate`
    *   Cambia específicamente el flag `enabled` a `false` dentro del nodo `verification`.

### 2. Vía Re-creación (Upsert)
Aunque el endpoint estándar `POST /api/v1/app-behaviors` bloquea la creación si ya existe un behavior activo (`409 Conflict`), la lógica interna de los *use cases* está diseñada para manejar entidades basadas en su código único por aplicación.

Para una actualización completa de otros módulos (como `password` o `email`), se debe seguir el patrón de:
1. Buscar el behavior existente por `app_id` y `behavior_code`.
2. Realizar un merge de la `config` actual con los nuevos valores.
3. Guardar utilizando el método `UpdateByFields` del repositorio para persistir solo el cambio en el campo `config`.

## Validaciones Críticas
Al actualizar el comportamiento, el sistema debe validar:
*   **Consistencia de Identificador**: Para `email_auth`, el campo `identifier` debe ser siempre `"email"`.
*   **Políticas de Contraseña**: Asegurar que los valores mínimos y máximos sean coherentes.
*   **Contexto de App**: Siempre filtrar por `app_id` para evitar cruces de configuración entre distintas aplicaciones.
