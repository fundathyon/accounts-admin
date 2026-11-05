'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, Palette } from 'lucide-react';
import { Alert, Icon, Tab, Tabs, TabsList, TabsPanel } from '@foundathyon/community-ui';
import { RichMessage } from '@/components/security-screen/rich-message';
import { ScreenLoadError, ScreenLoading, ScreenUnavailable } from '@/components/security-screen/screen-states';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiError } from '@/lib/api-envelope';
import {
  emailScopeHeaders,
  emailTemplatesErrorMessage,
  readEnvelope,
  type CatalogItem,
  type EmailCatalog,
  type EmailRequest,
  type ProviderStatus,
} from '@/lib/email-templates';
import { BrandingEditor } from './branding-editor';
import { TemplatesPanel } from './templates-panel';

// Accounts sends every email with the sender of the instance: there is nothing
// to configure per app, the banner only says which one it is.
function ProviderBanner({ status }: { status: ProviderStatus }) {
  const { t } = useI18n();
  if (status.state === 'ok') {
    return <Alert tone="success" title={<RichMessage text={t('emailTemplates.provider.ok', { sender: status.sender })} />} />;
  }
  if (status.state === 'missing') {
    return <Alert tone="warning" title={<RichMessage text={t('emailTemplates.provider.missing')} />} />;
  }
  if (status.state === 'error') return <Alert tone="danger" title={t('emailTemplates.provider.error')} />;
  return null;
}

/**
 * `secretKey` picks the scope: an app's key edits that app (Pro) and `null` edits
 * the instance through the BFF's admin key (Community). `senderKey` only reads
 * the sender, which has no operator route.
 */
export function EmailTemplatesEditor({ secretKey, senderKey }: { secretKey: string | null; senderKey: string }) {
  const { apiUrl } = useAdmin();
  const { t } = useI18n();

  const [items, setItems] = useState<CatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState('');
  const [unavailable, setUnavailable] = useState(false);
  const [provider, setProvider] = useState<ProviderStatus>({ state: 'loading' });
  // Bumped after a save, so both tabs render the email again.
  const [revision, setRevision] = useState(0);

  const request = useCallback<EmailRequest>(
    (path, init = {}) =>
      fetch(apiUrl(`/api/email-templates${path}`), {
        ...init,
        cache: 'no-store',
        headers: emailScopeHeaders(secretKey),
      }),
    [apiUrl, secretKey],
  );

  const loadCatalog = useCallback(
    () =>
      request('/catalog')
        .then(async (res) => {
          if (res.status === 404) {
            setUnavailable(true);
            return;
          }
          const json = await readEnvelope(res);
          if (!res.ok || !json?.data) {
            setLoadError(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.loadFailed')));
            return;
          }
          setLoadError('');
          setItems((json.data as EmailCatalog).items);
        })
        .catch(() => setLoadError(t('securityScreens.networkError'))),
    [request, t],
  );

  useEffect(() => {
    void loadCatalog();
  }, [loadCatalog]);

  useEffect(() => {
    if (!senderKey) return;
    let alive = true;
    fetch(apiUrl('/api/email-templates/email-config'), {
      headers: { 'X-Secret-API-Key': senderKey },
      cache: 'no-store',
    })
      .then(async (res) => {
        const json = await readEnvelope(res);
        const data = json?.data as { client?: string; sender?: string } | undefined;
        if (!alive) return;
        if (res.ok && data?.sender) setProvider({ state: 'ok', client: data.client ?? 'smtp', sender: data.sender });
        else setProvider({ state: res.ok || res.status === 404 ? 'missing' : 'error' });
      })
      .catch(() => {
        if (alive) setProvider({ state: 'error' });
      });
    return () => {
      alive = false;
    };
  }, [apiUrl, senderKey]);

  const afterSave = async () => {
    await loadCatalog();
    setRevision((r) => r + 1);
  };

  if (unavailable) {
    return <ScreenUnavailable title={t('emailTemplates.unavailable.title')} body={t('emailTemplates.unavailable.body')} />;
  }
  if (loadError && !items) return <ScreenLoadError message={loadError} onRetry={loadCatalog} />;
  if (!items) return <ScreenLoading />;

  const shownProvider: ProviderStatus = senderKey ? provider : { state: 'unknown' };

  return (
    <div className="space-y-6">
      <ProviderBanner status={shownProvider} />

      {/* keepMounted: leaving the tab must not lose an unsaved branding draft. */}
      <Tabs defaultValue="branding">
        <TabsList>
          <Tab value="branding">
            <Icon icon={Palette} size={14} /> {t('emailTemplates.tabs.branding')}
          </Tab>
          <Tab value="templates">
            <Icon icon={Mail} size={14} /> {t('emailTemplates.tabs.templates')}
          </Tab>
        </TabsList>
        <TabsPanel value="branding" keepMounted>
          <BrandingEditor
            request={request}
            secretKey={secretKey}
            catalog={items}
            sender={shownProvider.state === 'ok' ? shownProvider.sender : undefined}
            revision={revision}
            onSaved={() => setRevision((r) => r + 1)}
          />
        </TabsPanel>
        <TabsPanel value="templates" keepMounted>
          <TemplatesPanel
            request={request}
            secretKey={secretKey}
            catalog={items}
            provider={shownProvider}
            revision={revision}
            onChanged={afterSave}
          />
        </TabsPanel>
      </Tabs>
    </div>
  );
}
