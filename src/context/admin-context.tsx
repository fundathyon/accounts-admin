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
  publishable: 'authify_publishable_key',
} as const;

interface AdminContextValue {
  savedSecretKey: string;
  savedPublishableKey: string;
  setSavedSecretKey: (v: string) => void;
  setSavedPublishableKey: (v: string) => void;
  apiUrl: (path: string) => string;
  showNotification: (message: string, type: 'success' | 'error') => void;
}

const AdminContext = createContext<AdminContextValue | null>(null);

export function AdminProvider({ children }: { children: ReactNode }) {
  const [savedSecretKey, setSavedSecretKeyState] = useState('');
  const [savedPublishableKey, setSavedPublishableKeyState] = useState('');
  useEffect(() => {
    const s = localStorage.getItem(STORAGE_KEYS.secret);
    if (s) setSavedSecretKeyState(s);
    const p = localStorage.getItem(STORAGE_KEYS.publishable) || localStorage.getItem('authify_pusheable_key');
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

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    if (type === 'success') toast.success(message);
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
