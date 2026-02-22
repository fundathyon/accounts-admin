'use client';

import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { OnboardingScreen } from './onboarding-screen';
import { useAdmin } from '@/context/admin-context';

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
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasApps) {
    return <OnboardingScreen />;
  }

  return <>{children}</>;
}
