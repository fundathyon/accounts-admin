'use client';

import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { apiUrl as apiUrlUtil } from '@/lib/utils';

const STORAGE_KEYS = {
  secret: 'authify_secret_key',
  publishable: 'authify_publishable_key',
} as const;

interface AdminContextValue {
  savedSecretKey: string;
  savedPublishableKey: string;
  setSavedSecretKey: (v: string) => void;
  setSavedPublishableKey: (v: string) => void;
  apiUrl: (path: string) => string;
  showNotification: (message: string, type: 'success' | 'error' | 'warning') => void;
  /** True si el API reporta migración de redirects OAuth legacy pendiente (indicador en perfil). */
  pendingOAuthLegacyMigration: boolean;
  setPendingOAuthLegacyMigration: (v: boolean) => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [savedSecretKey, setSavedSecretKeyState] = useState('');
  const [savedPublishableKey, setSavedPublishableKeyState] = useState('');
  const [pendingOAuthLegacyMigration, setPendingOAuthLegacyMigration] = useState(false);
  // useLayoutEffect: hidratar antes del paint para que los hijos (p. ej. migración OAuth)
  // vean ya la Secret Key en el primer useEffect y no salgan con clave vacía.
  useLayoutEffect(() => {
    // Los NEXT_PUBLIC_DEV_* solo están definidos en .envs/.env.mock (`make dev-mock`),
    // donde el backend es el mock y no valida las keys. En local/dev/prod quedan
    // undefined, así que el comportamiento es idéntico al de siempre.
    const s = localStorage.getItem(STORAGE_KEYS.secret) || process.env.NEXT_PUBLIC_DEV_SECRET_KEY;
    if (s) setSavedSecretKeyState(s);
    const p =
      localStorage.getItem(STORAGE_KEYS.publishable) ||
      localStorage.getItem('authify_pusheable_key') ||
      process.env.NEXT_PUBLIC_DEV_PUBLISHABLE_KEY;
    if (p) setSavedPublishableKeyState(p);
  }, []);

  const setSavedSecretKey = useCallback((v: string) => {
    if (v) localStorage.setItem(STORAGE_KEYS.secret, v);
    else localStorage.removeItem(STORAGE_KEYS.secret);
    setSavedSecretKeyState(v);
  }, []);

  const setSavedPublishableKey = useCallback((v: string) => {
    if (v) {
      localStorage.setItem(STORAGE_KEYS.publishable, v);
      localStorage.removeItem('authify_pusheable_key');
    } else {
      localStorage.removeItem(STORAGE_KEYS.publishable);
      localStorage.removeItem('authify_pusheable_key');
    }
    setSavedPublishableKeyState(v);
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'error' | 'warning') => {
    if (type === 'success') toast.success(message);
    else if (type === 'warning') toast.warning(message);
    else toast.error(message);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        savedSecretKey,
        savedPublishableKey,
        setSavedSecretKey,
        setSavedPublishableKey,
        apiUrl: apiUrlUtil,
        showNotification,
        pendingOAuthLegacyMigration,
        setPendingOAuthLegacyMigration,
      }}
    >
      {children}
    </AdminContext.Provider>
  );
}

export function useAdmin() {
  const ctx = useContext(AdminContext);
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider');
  return ctx;
}
