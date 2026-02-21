# Authify Admin (Next.js Edition)

Este es un panel de administración moderno construido con **Next.js 15**, **Tailwind CSS** y **Framer Motion**.

## Características
- **Route Handlers**: Peticiones protegidas hacia la API real de Authify.
- **Framer Motion**: Animaciones fluidas y modales interactivos.
- **Tailwind CSS**: Diseño premium y modo oscuro nativo.
- **TypeScript**: Tipado estricto para mayor seguridad.

## Cómo ejecutar

1. Instala las dependencias (si no lo has hecho):
   ```bash
   npm install
   ```

2. Inicia el servidor de desarrollo:
   ```bash
   npm run dev
   ```

3. El panel estará disponible en [http://localhost:3000](http://localhost:3000).

## Configuración de API
El panel utiliza un proxy interno (`/src/app/api/apps/route.ts`) para comunicarse con la API de Go.
Puedes configurar las variables en `src/lib/utils.ts` o mediante variables de entorno:
- `INTERNAL_API_URL`: URL base de la API de Authify (Default: `http://localhost:8000/accounts`).
- `ADMIN_API_KEY`: Tu Admin API Key (Default: `secret`).
