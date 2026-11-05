'use client';

import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Select,
  Switch,
  Textarea,
} from '@foundathyon/community-ui';
import { parseConfigObject } from '@/components/behaviors/json-config-form';
import { Button } from '@/components/fdn/button';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiError, type Envelope } from '@/lib/api-envelope';

interface AvailableBehavior {
  code: string;
  name: string;
  description: string;
}

const CUSTOM = '__custom__';

interface NewBehaviorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  secretKey: string;
  /** `created_by` of a custom behavior; custom creation needs one row to take it from. */
  appId?: string;
  existingCodes: string[];
  onCreated: () => void;
}

/**
 * Creates a behavior: from the backend's catalog (`POST /simple`, predefined
 * config) or a custom one (`POST /`). Those with a screen of their own are not
 * offered: they are born with their first PUT, and both routes refuse them.
 */
export function NewBehaviorDialog({ open, onOpenChange, secretKey, appId, existingCodes, onCreated }: NewBehaviorDialogProps) {
  const { apiUrl, showNotification } = useAdmin();
  const { t, locale } = useI18n();
  const [catalog, setCatalog] = useState<AvailableBehavior[]>([]);
  const [choice, setChoice] = useState('');
  const [code, setCode] = useState('');
  const [configText, setConfigText] = useState('{}');
  const [active, setActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const offered = catalog.filter((item) => !existingCodes.includes(item.code));
  const selected = offered.find((item) => item.code === choice);
  const custom = choice === CUSTOM;
  const config = parseConfigObject(configText);
  const canSubmit = !submitting && (custom ? code.trim() !== '' && config !== null : Boolean(selected));

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setCode('');
    setConfigText('{}');
    setActive(true);
    fetch(apiUrl('/api/behaviors/available'), {
      headers: { 'X-Secret-API-Key': secretKey, 'Accept-Language': locale },
      cache: 'no-store',
    })
      .then((res) => res.json())
      .then((json: { data?: { behaviors?: AvailableBehavior[] } }) => {
        if (!alive) return;
        const items = json.data?.behaviors ?? [];
        setCatalog(items);
        setChoice(items.find((item) => !existingCodes.includes(item.code))?.code ?? (appId ? CUSTOM : ''));
      })
      .catch(() => {
        if (alive) showNotification(t('behaviors.list.catalogError'), 'error');
      });
    return () => {
      alive = false;
    };
    // Reloaded each time the dialog opens; the rest only matters at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(custom ? '/api/behaviors' : '/api/behaviors/simple'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': secretKey },
        body: JSON.stringify(
          custom
            ? { behavior_code: code.trim(), config, is_active: active, created_by: appId }
            : { behavior_code: choice },
        ),
      });
      const json = (await res.json().catch(() => null)) as Envelope | null;
      if (!res.ok) {
        showNotification(
          res.status === 409 ? t('behaviors.list.alreadyExists') : (apiError(json)?.message ?? t('behaviors.list.createFailed')),
          'error',
        );
        return;
      }
      showNotification(t('behaviors.list.created'), 'success');
      onOpenChange(false);
      onCreated();
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const items = [
    ...offered.map((item) => ({ value: item.code, label: item.name })),
    ...(appId ? [{ value: CUSTOM, label: t('behaviors.list.custom') }] : []),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('behaviors.list.newBehavior')}</DialogTitle>
          <DialogDescription>{t('behaviors.list.newBehaviorDesc')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <FormField label={t('behaviors.list.type')} description={selected?.description}>
            <Select
              value={choice || null}
              onValueChange={(value) => setChoice(value ?? '')}
              items={items}
              className="w-full"
              placeholder={t('behaviors.list.noneAvailable')}
              disabled={items.length === 0}
            />
          </FormField>

          {custom && (
            <>
              <FormField label={t('behaviors.list.code')}>
                <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="my_behavior" className="font-mono" />
              </FormField>
              <FormField
                label={t('behaviors.configJson')}
                error={config ? undefined : t('behaviors.invalidJson')}
              >
                <Textarea
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  className="font-mono text-xs"
                />
              </FormField>
              <Switch label={t('common.active')} checked={active} onCheckedChange={setActive} />
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={submitting}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!canSubmit} loading={submitting}>
            {t('behaviors.list.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
