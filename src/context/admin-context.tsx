'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { toast } from 'sonner';
import { apiUrl as apiUrlUtil } from '@/lib/utils';

const STORAGE_KEYS = {
  secret: 'authify_secret_key',
  admin: 'authify_admin_key',
  publishable: 'authify_publishable_key',
  pusheable: 'authify_pusheable_key',
} as const;

interface AdminContextValue {
  savedSecretKey: string;
  savedAdminKey: string;
  savedPublishableKey: string;
  savedPusheableKey: string;
  setSavedSecretKey: (v: string) => void;
  setSavedAdminKey: (v: string) => void;
  setSavedPublishableKey: (v: string) => void;
  setSavedPusheableKey: (v: string) => void;
  apiUrl: (path: string) => string;
  showNotification: (message: string, type: 'success' | 'error') => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [savedSecretKey, setSavedSecretKeyState] = useState('');
  const [savedAdminKey, setSavedAdminKeyState] = useState('');
  const [savedPublishableKey, setSavedPublishableKeyState] = useState('');
  const [savedPusheableKey, setSavedPusheableKeyState] = useState('');
  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEYS.secret);
    if (s) setSavedSecretKeyState(s);
    const a = localStorage.getItem(STORAGE_KEYS.admin);
    if (a) setSavedAdminKeyState(a);
    const p = localStorage.getItem(STORAGE_KEYS.publishable);
    if (p) setSavedPublishableKeyState(p);
    const pu = localStorage.getItem(STORAGE_KEYS.pusheable);
    if (pu) setSavedPusheableKeyState(pu);
  }, []);

  const setSavedSecretKey = useCallback((v: string) => {
    if (v) localStorage.setItem(STORAGE_KEYS.secret, v);
    else localStorage.removeItem(STORAGE_KEYS.secret);
    setSavedSecretKeyState(v);
  }, []);

  const setSavedAdminKey = useCallback((v: string) => {
    if (v) localStorage.setItem(STORAGE_KEYS.admin, v);
    else localStorage.removeItem(STORAGE_KEYS.admin);
    setSavedAdminKeyState(v);
  }, []);

  const setSavedPublishableKey = useCallback((v: string) => {
    if (v) localStorage.setItem(STORAGE_KEYS.publishable, v);
    else localStorage.removeItem(STORAGE_KEYS.publishable);
    setSavedPublishableKeyState(v);
  }, []);

  const setSavedPusheableKey = useCallback((v: string) => {
    if (v) localStorage.setItem(STORAGE_KEYS.pusheable, v);
    else localStorage.removeItem(STORAGE_KEYS.pusheable);
    setSavedPusheableKeyState(v);
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  }, []);

  return (
    <AdminContext.Provider
      value={{
        savedSecretKey,
        savedAdminKey,
        savedPublishableKey,
        savedPusheableKey,
        setSavedSecretKey,
        setSavedAdminKey,
        setSavedPublishableKey,
        setSavedPusheableKey,
        apiUrl: apiUrlUtil,
        showNotification,
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
