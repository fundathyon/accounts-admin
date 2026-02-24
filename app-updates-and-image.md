# Cambios en la Entidad App y Nuevo Endpoint de Actualización

Este documento detalla los cambios realizados en el sistema para soportar el almacenamiento de imágenes de aplicación y permitir su actualización.

## Resumen de Cambios

### 1. Modelo de Datos y Entidades
Se ha añadido el campo `Image` (string) a los siguientes componentes:
- **Entidad de Dominio (`App` y `AppEntity`)**: Define la estructura lógica del negocio.
- **Modelo de Infraestructura (`AppModel`)**: Mapeo físico en la base de datos PostgreSQL.
- **Transformación JSON**: Se actualizó el método `ToJSON` para que la imagen se retorne en los listados y detalles de aplicaciones.

### 2. Nuevo Endpoint de Actualización
Se ha implementado un nuevo endpoint para permitir la modificación de los datos básicos de la aplicación.

*   **Ruta**: `PATCH /api/v1/apps`
*   **Autenticación**: Requiere `X-API-KEY` (Secret Key de la aplicación) en la cabecera.
*   **Cuerpo de la Petición (JSON)**:
    ```json
    {
      "name": "Nuevo Nombre de App",
      "image": "https://url-de-la-imagen.png"
    }
    ```
*   **Respuesta Exitosa (200 OK)**: Retorna el objeto de la aplicación actualizado.

### 3. Componentes Internos Creados
Para soportar esta funcionalidad se crearon los siguientes archivos:
- `internal/api/v1/apps/interface/dtos/update.go`: Estructura de datos de entrada con validación.
- `internal/context/v1/apps/app/use_cases/update.go`: Lógica de negocio para persistir los cambios.
- `internal/api/v1/apps/interface/controllers/update.go`: Manejador HTTP para procesar la petición.

## Impacto en la API
Cualquier llamada a `GET /v1/apps` ahora incluirá el campo `"image"` en cada objeto de aplicación retornado. Si la aplicación no tiene una imagen asignada, el campo retornará una cadena vacía.
