'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { apiUrl } from '@/lib/utils';
import type { Edition } from '@/lib/admin-types';

interface EditionContextValue {
  /** `null` while unknown: still loading, backend unreachable or no `edition` field. */
  edition: Edition | null;
  /** Only true when the backend says so — anything else is treated as Community. */
  isPro: boolean;
  loading: boolean;
}

const EditionContext = createContext<EditionContextValue | null>(null);

/** `data.edition` of `GET /health`, compared the way the backend does (trim + lowercase). */
function editionFrom(body: unknown): Edition | null {
  const data = (body as { data?: { edition?: unknown } } | null)?.data;
  const raw = typeof data?.edition === 'string' ? data.edition.trim().toLowerCase() : '';
  if (raw === 'pro') return 'pro';
  if (raw === 'community') return 'community';
  return null;
}

/**
 * Asks the backend's public `GET /health` once which edition it runs, so
 * Pro-only screens (Embedded Auth) can be shown or hidden. It never blocks
 * rendering, never retries and never toasts: while loading, on any failure or
 * without an `edition` field the admin behaves exactly as Community.
 */
export function EditionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ edition: Edition | null; loading: boolean }>({ edition: null, loading: true });

  useEffect(() => {
    let alive = true;
    fetch(apiUrl('/api/health'), { cache: 'no-store' })
      .then((res) => res.json())
      .then((body: unknown) => {
        if (alive) setState({ edition: editionFrom(body), loading: false });
      })
      .catch(() => {
        if (alive) setState({ edition: null, loading: false });
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <EditionContext.Provider value={{ edition: state.edition, isPro: state.edition === 'pro', loading: state.loading }}>
      {children}
    </EditionContext.Provider>
  );
}

export function useEdition(): EditionContextValue {
  const ctx = useContext(EditionContext);
  if (!ctx) throw new Error('useEdition must be used within EditionProvider');
  return ctx;
}
