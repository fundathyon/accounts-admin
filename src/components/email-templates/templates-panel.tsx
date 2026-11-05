'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { RotateCcw, Send } from 'lucide-react';
import {
  Alert,
  Card,
  CardBody,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FileUpload,
  FormField,
  Heading,
  Icon,
  Input,
  Skeleton,
  Text,
  Tooltip,
  type FileUploadValue,
} from '@foundathyon/community-ui';
import { Badge } from '@/components/fdn/badge';
import { Button } from '@/components/fdn/button';
import { RichMessage } from '@/components/security-screen/rich-message';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiError } from '@/lib/api-envelope';
import {
  EMAIL_LOCALE,
  MAX_HTML_BYTES,
  emailTemplatesErrorMessage,
  hasOverride,
  previewOverride,
  readEnvelope,
  type CatalogItem,
  type EmailPreview,
  type EmailRequest,
  type ProviderStatus,
  type TemplateView,
} from '@/lib/email-templates';
import { cn } from '@/lib/utils';
import { EmailPreviewFrame } from './email-preview-frame';

function CatalogList({
  items,
  selectedId,
  onSelect,
}: {
  items: CatalogItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { t } = useI18n();
  return (
    <Card className="h-fit">
      <CardBody className="space-y-2 p-2">
        <div className="px-2 pt-1">
          <Heading level={2} visual="h5">{t('emailTemplates.tabs.templates')}</Heading>
          <Text variant="body-sm" tone="muted" as="p">
            {t('emailTemplates.catalog.available', { count: items.length })}
          </Text>
        </div>
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                aria-current={selectedId === item.id ? 'true' : undefined}
                onClick={() => onSelect(item.id)}
                className={cn(
                  'flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-body transition-colors hover:bg-surface-hover',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
                  selectedId === item.id && 'bg-surface-hover font-medium',
                )}
              >
                <span className="truncate">{item.name}</span>
                {hasOverride(item) && <Badge tone="info">{t('emailTemplates.catalog.custom')}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

/** One email at a time: its real preview, custom HTML, reset and a test send. */
export function TemplatesPanel({
  request,
  secretKey,
  catalog,
  provider,
  revision,
  onChanged,
}: {
  request: EmailRequest;
  /** `null` for the global scope. */
  secretKey: string | null;
  catalog: CatalogItem[];
  provider: ProviderStatus;
  /** Changes when something else altered what the preview renders. */
  revision: number;
  onChanged: () => Promise<void>;
}) {
  const { showNotification } = useAdmin();
  const { t } = useI18n();

  const [selectedId, setSelectedId] = useState<string | null>(catalog[0]?.id ?? null);
  const [template, setTemplate] = useState<TemplateView | null>(null);
  const [templateLoading, setTemplateLoading] = useState(true);
  const [preview, setPreview] = useState<EmailPreview | null>(null);
  const [previewing, setPreviewing] = useState(true);
  const [upload, setUpload] = useState<FileUploadValue | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [testOpen, setTestOpen] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [sending, setSending] = useState(false);
  const loadSeq = useRef(0);

  const selected = catalog.find((c) => c.id === selectedId) ?? null;
  const sender = provider.state === 'ok' ? provider.sender : undefined;
  const sendingOff = provider.state === 'missing';
  const uploading = upload?.status === 'uploading';

  const load = useCallback(
    async (templateId: string) => {
      const seq = ++loadSeq.current;
      const path = `/${encodeURIComponent(templateId)}`;
      setTemplateLoading(true);
      setPreviewing(true);
      const template = (async () => {
        try {
          const res = await request(`${path}?locale=${EMAIL_LOCALE}`);
          const json = await readEnvelope(res);
          if (seq !== loadSeq.current) return;
          if (res.ok && json?.data) {
            setTemplate(json.data as TemplateView);
            return;
          }
          setTemplate(null);
          showNotification(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.templates.loadFailed')), 'error');
        } catch {
          if (seq === loadSeq.current) showNotification(t('securityScreens.networkError'), 'error');
        } finally {
          if (seq === loadSeq.current) setTemplateLoading(false);
        }
      })();
      const render = (async () => {
        try {
          const res = await request(`${path}/preview`, {
            method: 'POST',
            body: JSON.stringify({ locale: EMAIL_LOCALE, sample_variables: {} }),
          });
          const json = await readEnvelope(res);
          if (seq !== loadSeq.current) return;
          if (res.ok && json?.data) {
            setPreview(json.data as EmailPreview);
            return;
          }
          showNotification(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.branding.previewFailed')), 'error');
        } catch {
          if (seq === loadSeq.current) showNotification(t('securityScreens.networkError'), 'error');
        } finally {
          if (seq === loadSeq.current) setPreviewing(false);
        }
      })();
      await Promise.all([template, render]);
    },
    [request, showNotification, t],
  );

  useEffect(() => {
    if (selectedId) void load(selectedId);
  }, [load, revision, selectedId]);

  const select = (id: string) => {
    if (id === selectedId) return;
    setTemplate(null);
    setPreview(null);
    setUpload(null);
    setSelectedId(id);
  };

  const uploadHtml = async (value: FileUploadValue) => {
    if (!selected) return;
    const fail = (error: string) => {
      setUpload({ ...value, status: 'error', error, retryable: false });
      showNotification(error, 'error');
    };
    setUpload({ ...value, status: 'uploading', progress: 60 });
    try {
      const res = await request(`/${encodeURIComponent(selected.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          locale: EMAIL_LOCALE,
          enabled: true,
          subject: template?.subject ?? selected.subject_default,
          from_name: template?.from_name ?? selected.from_name_default,
          html: await value.file.text(),
          text: '',
        }),
      });
      const json = await readEnvelope(res);
      if (!res.ok) {
        fail(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.upload.failed')));
        return;
      }
      const warnings = (json?.data as { warnings?: string[] } | undefined)?.warnings ?? [];
      setUpload(null);
      if (warnings.length === 0) showNotification(t('emailTemplates.upload.success'), 'success');
      else {
        showNotification(
          t(warnings.length === 1 ? 'emailTemplates.upload.withWarningsOne' : 'emailTemplates.upload.withWarningsMany', {
            count: warnings.length,
          }),
          'success',
        );
      }
      await onChanged();
    } catch {
      fail(t('securityScreens.networkError'));
    }
  };

  const onUploadChange = (value: FileUploadValue | null) => {
    if (value?.status === 'error') {
      // Rejected in the browser, with the component's English copy.
      const error = value.file.size > MAX_HTML_BYTES ? t('emailTemplates.upload.tooLarge') : t('emailTemplates.upload.notHtml');
      setUpload({ ...value, error });
      return;
    }
    if (value) void uploadHtml(value);
    else setUpload(null);
  };

  /** Rejecting keeps the dialog open: it closes when this resolves. */
  const reset = async () => {
    if (!selected) return;
    const failed = (message: string) => {
      showNotification(message, 'error');
      return new Error(message);
    };
    let res: Response;
    try {
      res = await request(`/${encodeURIComponent(selected.id)}?locale=${EMAIL_LOCALE}`, { method: 'DELETE' });
    } catch {
      throw failed(t('securityScreens.networkError'));
    }
    if (!res.ok) {
      throw failed(emailTemplatesErrorMessage(t, apiError(await readEnvelope(res)), t('emailTemplates.reset.failed')));
    }
    showNotification(t('emailTemplates.reset.success'), 'success');
    await onChanged();
  };

  const sendTest = async (event: FormEvent) => {
    event.preventDefault();
    if (!selected || sending) return;
    if (!testEmail.trim()) {
      showNotification(t('emailTemplates.errors.testEmailRequired'), 'error');
      return;
    }
    setSending(true);
    try {
      const res = await request(`/${encodeURIComponent(selected.id)}/test`, {
        method: 'POST',
        body: JSON.stringify({ to_email: testEmail.trim(), locale: EMAIL_LOCALE, sample_variables: {} }),
      });
      const json = await readEnvelope(res);
      if (!res.ok) {
        showNotification(emailTemplatesErrorMessage(t, apiError(json), t('emailTemplates.test.failed')), 'error');
        return;
      }
      showNotification(t('emailTemplates.test.sent', { email: testEmail.trim() }), 'success');
      setTestOpen(false);
    } catch {
      showNotification(t('securityScreens.networkError'), 'error');
    } finally {
      setSending(false);
    }
  };

  const custom = template?.source === 'override';
  const inherited = previewOverride(preview?.source, secretKey) === 'inherited';

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <CatalogList items={catalog} selectedId={selectedId} onSelect={select} />

      <div className="min-w-0 space-y-4">
        {selected ? (
          <>
            <Card>
              <CardBody className="space-y-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Heading level={2} visual="h5">{selected.name}</Heading>
                    {custom ? (
                      <Badge tone={template.enabled ? 'info' : 'neutral'}>
                        {t(template.enabled ? 'emailTemplates.templates.customHtml' : 'emailTemplates.templates.customHtmlDisabled')}
                      </Badge>
                    ) : inherited ? (
                      <Badge tone="info">{t('emailTemplates.templates.inheritedHtml')}</Badge>
                    ) : (
                      <Badge tone="neutral">{t('emailTemplates.templates.themeBrand')}</Badge>
                    )}
                  </div>
                  <Text variant="body-sm" tone="muted" as="p" className="mt-0.5">{selected.description}</Text>
                </div>
                {inherited && <Alert tone="info" title={t('emailTemplates.templates.inheritedNotice')} />}
                {templateLoading && !preview ? (
                  <Skeleton variant="rect" className="h-[520px] w-full" />
                ) : (
                  <EmailPreviewFrame
                    html={preview?.html ?? null}
                    subject={preview?.subject ?? ''}
                    fromName={preview?.from_name}
                    sender={sender}
                    loading={previewing}
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody className="space-y-3">
                <div>
                  <Heading level={2} visual="h5">{t('emailTemplates.templates.customHtml')}</Heading>
                  <Text variant="body-sm" tone="muted" as="p" className="mt-0.5">
                    <RichMessage text={t('emailTemplates.upload.description')} />
                  </Text>
                </div>
                <FileUpload
                  aria-label={t('emailTemplates.upload.prompt')}
                  accept=".html,.htm,text/html"
                  maxSize={MAX_HTML_BYTES}
                  value={upload}
                  onValueChange={onUploadChange}
                  prompt={t('emailTemplates.upload.prompt')}
                  hint={t('emailTemplates.upload.hint')}
                  actionLabel={(action, fileName) =>
                    t(action === 'retry' ? 'emailTemplates.upload.retry' : 'emailTemplates.upload.remove', { file: fileName })
                  }
                  disabled={uploading || templateLoading}
                />
              </CardBody>
            </Card>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {custom && (
                <Button
                  variant="secondary"
                  leading={<Icon icon={RotateCcw} size={14} />}
                  onClick={() => setResetOpen(true)}
                  disabled={templateLoading}
                >
                  {t('emailTemplates.reset.button')}
                </Button>
              )}
              <Tooltip content={t(sendingOff ? 'emailTemplates.test.buttonHintMissing' : 'emailTemplates.test.buttonHintOk')}>
                <span tabIndex={sendingOff ? 0 : -1} className="inline-flex">
                  <Button
                    variant="primary"
                    leading={<Icon icon={Send} size={14} />}
                    onClick={() => setTestOpen(true)}
                    disabled={templateLoading || sendingOff || provider.state === 'loading'}
                  >
                    {t('emailTemplates.test.button')}
                  </Button>
                </span>
              </Tooltip>
            </div>
          </>
        ) : (
          <Card>
            <CardBody className="py-8 text-center">
              <Text tone="muted">{t('emailTemplates.templates.select')}</Text>
            </CardBody>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={resetOpen}
        onOpenChange={setResetOpen}
        title={t('emailTemplates.reset.title')}
        description={t('emailTemplates.reset.confirm', { name: selected?.name ?? '' })}
        verb={t('emailTemplates.reset.button')}
        cancelLabel={t('common.cancel')}
        onConfirm={reset}
      />

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <form onSubmit={sendTest}>
            <DialogHeader>
              <DialogTitle>{t('emailTemplates.test.dialogTitle')}</DialogTitle>
              <DialogDescription>{t('emailTemplates.test.dialogDescription')}</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <FormField label={t('emailTemplates.test.emailLabel')}>
                <Input
                  type="email"
                  placeholder={t('emailTemplates.test.emailPlaceholder')}
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                />
              </FormField>
              {sender && (
                <Text variant="body-sm" tone="muted" as="p">
                  <RichMessage text={t('emailTemplates.test.sendingFrom', { sender })} />
                </Text>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setTestOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={sending}>
                {t('emailTemplates.test.send')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
