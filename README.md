# Foundathyon Admin (Next.js Edition)

Este es un panel de administración moderno construido con **Next.js 15**, **Tailwind CSS** y **Framer Motion**.

## Características
- **Route Handlers**: Peticiones protegidas hacia la API real de Foundathyon.
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
Las variables se cargan desde la carpeta `.envs/` (igual que en el proyecto Go):

1. `.envs/.env.base` — define `ENVIRONMENT` (local, development, production, staging).
2. Archivo según entorno: `.env.local`, `.env.dev`, `.env.prod` o `.env.staging`.

Variables usadas:
- `INTERNAL_API_URL`: URL base de la API de Foundathyon (Default: `http://localhost:8000/accounts`).
- `ADMIN_API_KEY`: Tu Admin API Key (Default: `secret`).
- `BASE_PATH` / `NEXT_PUBLIC_BASE_PATH`: Ruta base de la aplicación (Default: vacío).
