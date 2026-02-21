'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft, Shield, Mail, CheckCircle2, XCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { User } from '@/lib/admin-types';

export default function UserDetailPage() {
  const params = useParams();
  const { apiUrl, savedSecretKey } = useAdmin();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const id = params.id as string;

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    const load = async () => {
      setLoading(true);
      try {
        const res = await fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
        const data = await res.json();
        if (data.data && (data.status === 200 || data.success)) {
          const users: User[] = data.data || [];
          const found = users.find((u) => u.id === id);
          setUser(found || null);
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, savedSecretKey]);

  const usersHref = `${BASE_PATH}/users`.replace(/\/+/g, '/') || '/users';

  if (loading) {
    return (
      <div className="py-20 flex justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
          <Link href={usersHref}>
            <ChevronLeft className="w-4 h-4" /> Volver a usuarios
          </Link>
        </Button>
        <Card className="p-12 text-center">
          <p className="text-muted-foreground">Usuario no encontrado</p>
        </Card>
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Button variant="ghost" asChild className="mb-6 gap-2 -ml-2">
        <Link href={usersHref}>
          <ChevronLeft className="w-4 h-4" /> Volver a usuarios
        </Link>
      </Button>
      <div className="space-y-6">
        <Card className="overflow-hidden">
          <div className="p-6 flex items-start gap-6">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
              {(user.name || user.user_name || 'U').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold">{user.name || user.user_name || 'Sin nombre'}</h1>
              <p className="text-muted-foreground font-mono text-sm mt-1">{user.id}</p>
              {user.role_details && (
                <Badge variant="secondary" className="mt-2">
                  {user.role_details.name}
                </Badge>
              )}
            </div>
          </div>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="p-6">
            <CardTitle className="text-base mb-4 flex items-center gap-2">
              <Shield className="w-4 h-4" /> Información general
            </CardTitle>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">User ID</dt>
                <dd className="font-mono text-xs truncate max-w-[200px]" title={user.id}>
                  {user.id}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Nombre</dt>
                <dd>{user.name || '—'}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">User name</dt>
                <dd>{user.user_name || '—'}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">App ID</dt>
                <dd className="font-mono text-xs truncate max-w-[200px]" title={user.app_id}>
                  {user.app_id}
                </dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Rol</dt>
                <dd>{user.role_details?.name || '—'}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Creado</dt>
                <dd>{new Date(user.created_at).toLocaleString('es')}</dd>
              </div>
              <Separator />
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">Última actividad</dt>
                <dd>{new Date(user.updated_at).toLocaleString('es')}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-6">
            <CardTitle className="text-base mb-4 flex items-center gap-2">
              <Mail className="w-4 h-4" /> Métodos de login
            </CardTitle>
            {user.login_methods && user.login_methods.length > 0 ? (
              <div className="space-y-4">
                {user.login_methods.map((lm) => (
                  <div key={lm.id} className="p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          lm.entity_type === 'email' ? 'border-sky-500/40 text-sky-400' : 'border-orange-500/40 text-orange-400'
                        )}
                      >
                        {lm.entity_type}
                      </Badge>
                      {lm.is_verify ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      ) : (
                        <XCircle className="w-4 h-4 text-rose-400" />
                      )}
                    </div>
                    <dl className="space-y-1 text-xs">
                      <div className="flex gap-2">
                        <dt className="text-muted-foreground shrink-0">ID:</dt>
                        <dd className="font-mono truncate">{lm.entity_id}</dd>
                      </div>
                      {lm.details?.email && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground shrink-0">Email:</dt>
                          <dd className="truncate">{lm.details.email}</dd>
                        </div>
                      )}
                      {lm.details?.created_at && (
                        <div className="flex gap-2">
                          <dt className="text-muted-foreground shrink-0">Creado:</dt>
                          <dd>{new Date(lm.details.created_at).toLocaleString('es')}</dd>
                        </div>
                      )}
                    </dl>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No hay métodos de login registrados</p>
            )}
          </Card>
        </div>
      </div>
    </motion.div>
  );
}
