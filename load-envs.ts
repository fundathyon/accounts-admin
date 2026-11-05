/**
 * Load environment variables from .envs/ folder, following the same logic as the Go project
 * (apis/accounts/internal/core/settings/base.go).
 *
 * Order:
 * 1. Load .envs/.env.base if it exists (defines ENVIRONMENT; without it and
 *    without ENVIRONMENT in the process, the environment is "local")
 * 2. Load environment-specific file based on ENVIRONMENT:
 *    - "" (empty) -> .envs/.env
 *    - "local" -> .envs/.env.local
 *    - "development" -> .envs/.env.dev
 *    - "production" -> .envs/.env.prod
 *    - "staging" -> .envs/.env.staging
 *    - "mock" -> .envs/.env.mock (points INTERNAL_API_URL at mock-server/, see `make dev-mock`)
 */

import { config } from 'dotenv';
import path from 'path';

const EnvDir = '.envs';
const cwd = process.cwd();

const envFiles: Record<string, string> = {
  '': path.join(cwd, EnvDir, '.env'),
  local: path.join(cwd, EnvDir, '.env.local'),
  development: path.join(cwd, EnvDir, '.env.dev'),
  production: path.join(cwd, EnvDir, '.env.prod'),
  staging: path.join(cwd, EnvDir, '.env.staging'),
  mock: path.join(cwd, EnvDir, '.env.mock'),
};

export function loadDotEnv(): void {
  // 1. Load .env.base first (sets ENVIRONMENT). It is optional: a fresh clone
  // only has the per-environment file, and `make dev-mock` sets ENVIRONMENT itself.
  const basePath = path.join(cwd, EnvDir, '.env.base');
  const hasBase = !config({ path: basePath }).error;

  const environment = process.env.ENVIRONMENT || (hasBase ? '' : 'local');
  const envFile = envFiles[environment] ?? path.join(cwd, EnvDir, '.env.local');

  // 2. Load environment-specific file (override: true to take precedence)
  config({ path: envFile, override: true });
}

// Run on import so next.config.ts can just import this file
loadDotEnv();
