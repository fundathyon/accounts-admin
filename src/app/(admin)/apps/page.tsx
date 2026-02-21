'use client';

import { useState, useEffect } from 'react';
import { Info, Loader2, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { App } from '@/lib/admin-types';

export default function AppsPage() {
  const { apiUrl, showNotification, setSavedSecretKey } = useAdmin();
  const [apps, setApps] = useState<App[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', root_email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAppResponse, setCreatedAppResponse] = useState<Record<string, unknown> | null>(null);

  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/apps'));
      const data = await res.json();
      if (data.success) setApps(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar apps', 'error');
    } catch {
      showNotification('Error de conexión con la API de Apps', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApps();
  }, []);

  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreatedAppResponse(null);
    try {
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Aplicación creada con éxito', 'success');
        setCreatedAppResponse(data);
        fetchApps();
        const secretKey = data.data?.secret_key;
        if (secretKey && typeof secretKey === 'string') {
          setSavedSecretKey(secretKey.trim());
          showNotification('Secret API Key guardada automáticamente en Configuración', 'success');
        }
      } else {
        showNotification(data.error?.message || 'Error al crear', 'error');
      }
    } catch {
      showNotification('Error al contactar el servidor', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeAppModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', root_email: '' });
    setCreatedAppResponse(null);
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">Aplicaciones</h1>
          <Button onClick={() => setIsModalOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nueva Aplicación
          </Button>
        </div>
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="border-b">
                  <TableHead className="px-8 py-4">Nombre</TableHead>
                  <TableHead className="px-8 py-4">ID</TableHead>
                  <TableHead className="px-8 py-4">Creado</TableHead>
                  <TableHead className="px-8 py-4">Estado</TableHead>
                  <TableHead className="px-8 py-4 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-20 text-center">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" />
                    </TableCell>
                  </TableRow>
                ) : apps.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-16 text-center text-muted-foreground text-sm">
                      No hay aplicaciones registradas
                    </TableCell>
                  </TableRow>
                ) : (
                  apps.map((app) => (
                    <TableRow key={app.id} className="group">
                      <TableCell className="px-8 py-4 font-semibold">{app.name}</TableCell>
                      <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground">
                        {app.id}
                      </TableCell>
                      <TableCell className="px-8 py-4 text-muted-foreground text-sm">
                        {new Date(app.created_at).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="px-8 py-4">
                        <Badge variant="secondary">Activo</Badge>
                      </TableCell>
                      <TableCell className="px-8 py-4 text-right">
                        <Button variant="ghost" size="icon">
                          <Info className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </motion.div>

      <Dialog open={isModalOpen} onOpenChange={(open) => !open && closeAppModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{createdAppResponse ? 'Respuesta de Accounts' : 'Nueva Aplicación'}</DialogTitle>
          </DialogHeader>
          {createdAppResponse ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">JSON devuelto por la API al crear la aplicación:</p>
              <pre className="p-4 rounded-lg bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-[60vh] overflow-y-auto">
                {JSON.stringify(createdAppResponse, null, 2)}
              </pre>
              <DialogFooter>
                <Button onClick={closeAppModal}>Cerrar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateApp} className="space-y-5">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  required
                  placeholder="Mi Aplicación"
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Email Administrador</Label>
                <Input
                  required
                  type="email"
                  placeholder="admin@ejemplo.com"
                  value={formData.root_email}
                  onChange={(e) => setFormData((p) => ({ ...p, root_email: e.target.value }))}
                />
              </div>
              <DialogFooter className="gap-4 pt-4">
                <Button type="button" variant="outline" onClick={closeAppModal} className="flex-1">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  {isSubmitting ? 'Creando…' : 'Crear Aplicación'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
