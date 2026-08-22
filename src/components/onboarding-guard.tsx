'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { useAdmin } from '@/context/admin-context';

// Dynamically imported so its community-ui stylesheet (which shares utility
// class names like `.rounded-md` with the shadcn styles the rest of the admin
// uses) never lands in the shared (admin) layout chunk — only fetched for the
// rare first-run screen itself.
const OnboardingScreen = dynamic(() => import('./onboarding-screen').then((m) => m.OnboardingScreen), {
  ssr: false,
});

export function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const { apiUrl: getApiUrl } = useAdmin();
  const [hasApps, setHasApps] = useState<boolean | null>(null);

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch(getApiUrl('/api/apps'));
        const data = await res.json();
        const apps = data.data ?? data;
        const list = Array.isArray(apps) ? apps : [];
        setHasApps(list.length > 0);
      } catch {
        setHasApps(true); // On error, allow normal flow
      }
    };
    check();
  }, [getApiUrl]);

  if (hasApps === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg">
        <Loader2 className="w-8 h-8 animate-spin text-muted" />
      </div>
    );
  }

  if (!hasApps) {
    return <OnboardingScreen />;
  }

  return <>{children}</>;
}
