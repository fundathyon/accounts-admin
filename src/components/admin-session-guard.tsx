'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl, BASE_PATH } from '@/lib/utils';

const CHECK_INTERVAL_MS = 4 * 60 * 1000; // 4 minutes (before 5 min expiry)

export function AdminSessionGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const res = await fetch(apiUrl('/api/admin/session'), { credentials: 'include' });
        const data = await res.json();
        if (!data.ok) {
          const loginPath = `${BASE_PATH}/login`.replace(/\/+/g, '/') || '/login';
          router.push(loginPath);
          router.refresh();
        }
      } catch {
        const loginPath = `${BASE_PATH}/login`.replace(/\/+/g, '/') || '/login';
        router.push(loginPath);
        router.refresh();
      }
    };

    intervalRef.current = setInterval(checkSession, CHECK_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  return <>{children}</>;
}
