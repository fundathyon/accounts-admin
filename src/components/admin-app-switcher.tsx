'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, Image as ImageIcon, Palette } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuGroupLabel,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  FormField,
  Input,
  Tooltip,
} from '@foundathyon/community-ui';
import { Button } from '@/components/fdn/button';
import { useAdmin } from '@/context/admin-context';
import { useEdition } from '@/context/edition-context';
import { useI18n } from '@/context/i18n-context';
import { cn } from '@/lib/utils';

interface AppInfo {
  id: string;
  name: string;
  image?: string;
}

/**
 * The app chip at the start of the header, the place the organization switcher
 * has in the Foundathyon admin. It only opens the app's branding editor.
 */
export function AdminAppSwitcher() {
  const { savedSecretKey, apiUrl, showNotification } = useAdmin();
  const { t } = useI18n();
  const { name: editionName } = useEdition();
  const [app, setApp] = useState<AppInfo | null>(null);

  useEffect(() => {
    const fetchApps = async () => {
      try {
        const res = await fetch(apiUrl('/api/apps'));
        const data = await res.json();
        const apps = data.data ?? data;
        const list = Array.isArray(apps) ? apps : [];
        if (list.length > 0) {
          setApp({ id: list[0].id, name: list[0].name, image: list[0].image });
        }
      } catch {
        /* ignore */
      }
    };
    fetchApps();
  }, [apiUrl]);

  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState({ name: '', image: '' });
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!savedSecretKey || !app) return;
    setIsUpdating(true);
    try {
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Secret-API-Key': savedSecretKey,
        },
        body: JSON.stringify(updateForm),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('sidebar.appUpdated'), 'success');
        setApp({ ...app, name: updateForm.name, image: updateForm.image });
        setIsUpdateModalOpen(false);
      } else {
        showNotification(data.error?.message || t('sidebar.appUpdateError'), 'error');
      }
    } catch {
      showNotification(t('sidebar.appUpdateError'), 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const openUpdateModal = () => {
    if (!app) return;
    setUpdateForm({ name: app.name, image: app.image || '' });
    setIsUpdateModalOpen(true);
  };

  return (
    <>
      <DropdownMenu>
        <Tooltip content={t('tooltips.editApp')} side="bottom">
          <DropdownMenuTrigger
            className="flex h-10 min-w-0 max-w-64 items-center gap-2.5 rounded-lg border border-border bg-surface px-2 text-left transition-colors duration-150 hover:bg-surface-hover data-[popup-open]:bg-surface-hover"
          >
            <div
              className={cn(
                'flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-semibold',
                !app?.image && 'bg-accent-solid text-accent-on-solid'
              )}
            >
              {app?.image ? (
                <img src={app.image} alt={app.name} className="size-full object-cover" />
              ) : (
                (app?.name || 'A').charAt(0).toUpperCase()
              )}
            </div>
            <div className="grid min-w-0 text-left">
              <span className="truncate text-body-sm font-medium text-text">
                {app?.name ?? 'Accounts Admin'}
              </span>
              <span className="truncate text-caption text-text-muted">
                {app ? t('sidebar.app') : t('sidebar.apiAccounts')}
              </span>
            </div>
            <ChevronDown className="ml-1 size-4 shrink-0 text-text-muted" />
          </DropdownMenuTrigger>
        </Tooltip>
        <DropdownMenuContent className="min-w-56" align="start" side="bottom" sideOffset={4}>
          {app && (
            <>
              <DropdownMenuGroup>
                <DropdownMenuGroupLabel>{t('sidebar.app')}</DropdownMenuGroupLabel>
                <DropdownMenuItem
                  className="px-3 py-2"
                  onClick={openUpdateModal}
                  disabled={!savedSecretKey}
                >
                  <span className="flex items-center gap-2">
                    <Palette className="size-4 shrink-0 text-accent" />
                    <span className="font-medium">{t('sidebar.editApp')}</span>
                  </span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuItem disabled className="px-3 text-caption text-text-muted">
            {editionName ? t('dashboard.badge', { edition: editionName }) : 'API Accounts'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen}>
        <DialogContent size="sm">
          <form onSubmit={handleUpdateApp} className="flex min-w-0 flex-col gap-3">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-accent" />
                {t('sidebar.editApp')}
              </DialogTitle>
              <DialogDescription>
                Actualiza el branding visual de tu aplicación para el panel administrativo.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6">
              <FormField label={t('sidebar.appName')}>
                <Input
                  value={updateForm.name}
                  onChange={(e) => setUpdateForm({ ...updateForm, name: e.target.value })}
                  placeholder="Mi Aplicación"
                  required
                />
              </FormField>
              <FormField
                label={t('sidebar.appImage')}
                description="Ingresa una URL directa a la imagen del logo (PNG, JPG, SVG)."
              >
                {/* Icon box and Input are both DS-sized to h-control-md (32px)
                    so their top and bottom edges align pixel-for-pixel. Using
                    `size-10` on the box (40px) against the Input's 32px height
                    was the reported misalignment. */}
                <div className="flex gap-2 items-center">
                  <div className={cn(
                    "h-control-md w-control-md shrink-0 rounded-md flex items-center justify-center overflow-hidden border border-border",
                    !updateForm.image && "bg-bg-subtle"
                  )}>
                    {updateForm.image ? (
                      <img src={updateForm.image} alt="Preview" className="size-full object-cover" />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-text-muted" />
                    )}
                  </div>
                  <Input
                    value={updateForm.image}
                    onChange={(e) => setUpdateForm({ ...updateForm, image: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    wrapperClassName="flex-1"
                    className="font-mono text-xs"
                  />
                </div>
              </FormField>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setIsUpdateModalOpen(false)}
                disabled={isUpdating}
              >
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                variant="primary"
                loading={isUpdating}
                leading={<Palette className="w-4 h-4" />}
              >
                {isUpdating ? t('sidebar.updatingApp') : t('sidebar.updateApp')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
