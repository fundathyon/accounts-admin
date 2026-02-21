'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Layers, Users, Webhook, Puzzle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BASE_PATH } from '@/lib/utils';
import { useAdmin } from '@/context/admin-context';
import type { App, User, WebhookItem, AppBehavior } from '@/lib/admin-types';

export default function DashboardPage() {
  const { apiUrl, savedSecretKey } = useAdmin();
  const [loading, setLoading] = useState(true);
  const [apps, setApps] = useState<App[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [behaviors, setBehaviors] = useState<AppBehavior[]>([]);

  const fetchApps = async () => {
    try {
      const res = await fetch(apiUrl('/api/apps'));
      const data = await res.json();
      if (data.success) setApps(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setUsers(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchWebhooks = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/webhooks'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setWebhooks(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  const fetchBehaviors = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/behaviors'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setBehaviors(data.data || []);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchApps();
    if (savedSecretKey) {
      Promise.all([
        fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
        fetch(apiUrl('/api/webhooks'), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
        fetch(apiUrl('/api/behaviors'), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
      ]).then(([ur, wr, br]) => {
        ur.json().then(d => { if (d.data && (d.status === 200 || d.success)) setUsers(d.data || []); });
        wr.json().then(d => { if (d.success) setWebhooks(d.data || []); });
        br.json().then(d => { if (d.success) setBehaviors(d.data || []); });
      }).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [savedSecretKey]);

  const appsLink = `${BASE_PATH}/apps`.replace(/\/+/g, '/') || '/apps';

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="flex items-center gap-3 mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
          API Accounts · Community
        </Badge>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {[
          { icon: Layers, label: 'Aplicaciones', value: apps.length },
          { icon: Users, label: 'Usuarios', value: users.length },
          { icon: Webhook, label: 'Webhooks', value: webhooks.length },
          { icon: Puzzle, label: 'Behaviors', value: behaviors.length },
        ].map((card) => (
          <Card key={card.label} className="p-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
              <card.icon className="w-6 h-6" />
            </div>
            <div className="text-muted-foreground text-sm font-medium">{card.label}</div>
            <div className="text-3xl font-bold mt-1">{loading ? '…' : card.value}</div>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle>Aplicaciones Recientes</CardTitle>
          <Link href={appsLink}>
            <Button variant="link" className="text-primary p-0 h-auto">
              Ver todas →
            </Button>
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {loading ? (
              <div className="py-16 flex justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : apps.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-sm">
                No hay aplicaciones aún
              </div>
            ) : (
              apps.slice(0, 5).map((app) => (
                <div
                  key={app.id}
                  className="px-6 py-4 hover:bg-muted/50 transition-colors flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-bold">
                      {app.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-semibold">{app.name}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">{app.id}</div>
                    </div>
                  </div>
                  <Badge variant="secondary">Activo</Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
