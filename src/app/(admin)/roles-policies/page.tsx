'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Key,
  Shield,
  ShieldCheck,
  FileCheck,
  Plus,
  Link2,
  Loader2,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Role, Policy } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

export default function RolesPoliciesPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const [roles, setRoles] = useState<Role[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [rolePoliciesInfo, setRolePoliciesInfo] = useState<{ role: Role; policies: Policy[] } | null>(null);
  const [selectedRoleForPolicies, setSelectedRoleForPolicies] = useState<string | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isRolePoliciesModalOpen, setIsRolePoliciesModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [policyForm, setPolicyForm] = useState({ name: '', description: '', resource: '', action: '', effect: 'allow' as string });
  const [assignForm, setAssignForm] = useState({ role_id: '', policy_id: '' });
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [isPolicySubmitting, setIsPolicySubmitting] = useState(false);
  const [isAssignSubmitting, setIsAssignSubmitting] = useState(false);

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const fetchRoles = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setRoles(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar roles', 'error');
    } catch {
      showNotification('Error al conectar con la API de Roles', 'error');
    }
  };

  const fetchPolicies = async () => {
    if (!savedSecretKey) return;
    try {
      const res = await fetch(apiUrl('/api/policies'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setPolicies(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar políticas', 'error');
    } catch {
      showNotification('Error al conectar con la API de Políticas', 'error');
    }
  };

  const fetchRolePolicies = async (roleId: string) => {
    if (!savedSecretKey) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/role-policies/${roleId}`), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) {
        setRolePoliciesInfo(data.data);
        setSelectedRoleForPolicies(roleId);
        setAssignForm((prev) => ({ ...prev, role_id: roleId }));
        setIsRolePoliciesModalOpen(true);
      } else showNotification(data.error?.message || 'Error al cargar políticas del rol', 'error');
    } catch {
      showNotification('Error al conectar con el servidor', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRoleSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/roles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification('Rol creado con éxito', 'success');
        setIsRoleModalOpen(false);
        setRoleForm({ name: '', description: '' });
        fetchRoles();
      } else showNotification(data.error?.message || 'Error al crear rol', 'error');
    } catch {
      showNotification('Error al contactar el servidor', 'error');
    } finally {
      setIsRoleSubmitting(false);
    }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPolicySubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/policies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(policyForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification('Política creada con éxito', 'success');
        setIsPolicyModalOpen(false);
        setPolicyForm({ name: '', description: '', resource: '', action: '', effect: 'allow' });
        fetchPolicies();
      } else showNotification(data.error?.message || 'Error al crear política', 'error');
    } catch {
      showNotification('Error al contactar el servidor', 'error');
    } finally {
      setIsPolicySubmitting(false);
    }
  };

  const handleAssignPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.role_id || !assignForm.policy_id) {
      showNotification('Selecciona rol y política', 'error');
      return;
    }
    setIsAssignSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/role-policies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(assignForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification('Política asignada al rol correctamente', 'success');
        setAssignForm((prev) => ({ ...prev, policy_id: '' }));
        if (selectedRoleForPolicies) fetchRolePolicies(selectedRoleForPolicies);
      } else showNotification(data.error?.message || 'Error al asignar política', 'error');
    } catch {
      showNotification('Error al contactar el servidor', 'error');
    } finally {
      setIsAssignSubmitting(false);
    }
  };

  useEffect(() => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([
      fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
      fetch(apiUrl('/api/policies'), { headers: { 'X-Secret-API-Key': savedSecretKey } }),
    ])
      .then(([rRes, pRes]) =>
        Promise.all([rRes.json(), pRes.json()])
      )
      .then(([rData, pData]) => {
        if (rData.data && (rData.status === 200 || rData.success)) setRoles(rData.data || []);
        if (pData.data && (pData.status === 200 || pData.success)) setPolicies(pData.data || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [savedSecretKey]);

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Roles y Políticas</h1>
            <p className="text-muted-foreground text-sm mt-1">Gestiona roles, políticas de autorización y su asignación.</p>
          </div>
          {!savedSecretKey ? (
            <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
              <Link href={settingsHref}>
                <Key className="w-4 h-4" /> Configura tu Secret API Key
              </Link>
            </Button>
          ) : (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setIsRoleModalOpen(true)} className="gap-2">
                <Shield className="w-4 h-4" /> Nuevo Rol
              </Button>
              <Button variant="outline" onClick={() => setIsPolicyModalOpen(true)} className="gap-2">
                <FileCheck className="w-4 h-4" /> Nueva Política
              </Button>
            </div>
          )}
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
            <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración para gestionar roles y políticas.</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>Ir a Configuración</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-8">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5 text-primary" />
                    Roles
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setIsRoleModalOpen(true)} className="gap-1">
                    <Plus className="w-4 h-4" /> Crear
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="py-12 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : roles.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No hay roles. Crea uno para empezar.</div>
                  ) : (
                    <div className="space-y-2">
                      {roles.map((role) => (
                        <div key={role.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div>
                            <div className="font-semibold">{role.name}</div>
                            {role.description && <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>}
                          </div>
                          <Button variant="ghost" size="sm" className="gap-1" onClick={() => fetchRolePolicies(role.id)}>
                            <Link2 className="w-4 h-4" /> Políticas
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <FileCheck className="w-5 h-5 text-primary" />
                    Políticas
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={() => setIsPolicyModalOpen(true)} className="gap-1">
                    <Plus className="w-4 h-4" /> Crear
                  </Button>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="py-12 flex justify-center">
                      <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                    </div>
                  ) : policies.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground text-sm">No hay políticas. Crea una para empezar.</div>
                  ) : (
                    <div className="space-y-2">
                      {policies.map((policy) => (
                        <div key={policy.id} className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between">
                            <div className="font-semibold text-sm">{policy.name}</div>
                            <Badge variant={policy.effect === 'allow' ? 'secondary' : 'destructive'} className="text-xs">
                              {policy.effect}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 font-mono">
                            {policy.resource} → {policy.action}
                          </div>
                          {policy.description && <div className="text-xs text-muted-foreground mt-0.5">{policy.description}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </motion.div>

      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Nuevo Rol
            </DialogTitle>
            <DialogDescription>Los roles agrupan permisos que puedes asignar a los usuarios.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-5">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input required placeholder="admin" value={roleForm.name} onChange={(e) => setRoleForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Rol con permisos de administración" value={roleForm.description} onChange={(e) => setRoleForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRoleModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isRoleSubmitting} className="gap-2">
                {isRoleSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRoleSubmitting ? 'Creando…' : 'Crear Rol'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Nueva Política
            </DialogTitle>
            <DialogDescription>Define permisos (recurso + acción + efecto) para control de acceso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePolicy} className="space-y-5">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input required placeholder="read_users" value={policyForm.name} onChange={(e) => setPolicyForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Permite leer información de usuarios" value={policyForm.description} onChange={(e) => setPolicyForm((p) => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recurso *</Label>
                <Input required placeholder="users" value={policyForm.resource} onChange={(e) => setPolicyForm((p) => ({ ...p, resource: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Acción *</Label>
                <Input required placeholder="read" value={policyForm.action} onChange={(e) => setPolicyForm((p) => ({ ...p, action: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Efecto *</Label>
              <select
                value={policyForm.effect}
                onChange={(e) => setPolicyForm((p) => ({ ...p, effect: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPolicyModalOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPolicySubmitting} className="gap-2">
                {isPolicySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPolicySubmitting ? 'Creando…' : 'Crear Política'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={isRolePoliciesModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsRolePoliciesModalOpen(false);
            setRolePoliciesInfo(null);
            setSelectedRoleForPolicies(null);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Políticas del rol
              {rolePoliciesInfo && <span className="text-muted-foreground font-normal">— {rolePoliciesInfo.role.name}</span>}
            </DialogTitle>
            {rolePoliciesInfo?.role.description && <DialogDescription>{rolePoliciesInfo.role.description}</DialogDescription>}
          </DialogHeader>

          {rolePoliciesInfo && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">Políticas asignadas</h4>
                {rolePoliciesInfo.policies.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No hay políticas asignadas. Añade una abajo.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rolePoliciesInfo.policies.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <span className="font-medium text-sm">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">
                            {p.resource} → {p.action}
                          </span>
                        </div>
                        <Badge variant={p.effect === 'allow' ? 'secondary' : 'destructive'}>{p.effect}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <form onSubmit={handleAssignPolicy} className="space-y-4">
                <h4 className="text-sm font-semibold">Asignar nueva política</h4>
                <div className="space-y-2">
                  <Label>Política</Label>
                  <select
                    value={assignForm.policy_id}
                    onChange={(e) => setAssignForm((p) => ({ ...p, policy_id: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecciona una política</option>
                    {policies
                      .filter((p) => !rolePoliciesInfo.policies.some((rp) => rp.id === p.id))
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.resource} → {p.action})
                        </option>
                      ))}
                  </select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsRolePoliciesModalOpen(false)}>
                    Cerrar
                  </Button>
                  <Button type="submit" disabled={isAssignSubmitting || !assignForm.policy_id} className="gap-2">
                    {isAssignSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isAssignSubmitting ? 'Asignando…' : 'Asignar Política'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
