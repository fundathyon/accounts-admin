'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Button,
  Card,
  CardBody,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Heading,
  Icon,
  Inline,
  Input,
  Select,
  Spinner,
  Text,
  Tooltip,
} from '@foundathyon/community-ui';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiUrl } from '@/lib/utils';
import { cn } from '@/lib/utils';

interface EmailTemplate {
  id: string;
  name: string;
  url: string;
  variables: string[];
}

const DEFAULT_VALUES: Record<string, string> = {
  user_name: 'Juan García',
  activation_code: '123456',
  token: 'sample-token-abc123',
  new_email: 'nuevo@ejemplo.com',
  magic_link_url: 'https://lyron.lat/auth/verify?token=sample-token-abc123',
  redirect_path: '/',
  expires_in_minutes: '15',
  from_name: 'Lyron',
  logo_url: 'https://lyron.lat/logo.png',
  button_color: '#7c3aed',
};

export default function EmailTemplatesPage() {
  const { showNotification } = useAdmin();
  const { t } = useI18n();
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formValues, setFormValues] = useState<Record<string, Record<string, string>>>({});
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [iframeHeight, setIframeHeight] = useState(400);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewIdRef = useRef(0);
  const [sendTestDialogOpen, setSendTestDialogOpen] = useState(false);
  const [sendTestEmail, setSendTestEmail] = useState('');

  const selectedTemplate = templates.find((t) => t.id === selectedId);

  const fetchPreview = useCallback(
    async (templateId: string, vars: Record<string, string>) => {
      setPreviewLoading(true);
      try {
        const res = await fetch(apiUrl('/api/system/email-templates/preview'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ template_id: templateId, variables: vars }),
        });
        const data = await res.json();
        if (data.success && data.data?.html != null) {
          previewIdRef.current += 1;
          setIframeHeight(400);
          setPreviewHtml(data.data.html);
        } else {
          setPreviewHtml('');
          showNotification(data.error?.message || t('emailTemplates.errorPreview'), 'error');
        }
      } catch {
        setPreviewHtml('');
        showNotification(t('emailTemplates.errorConnection'), 'error');
      } finally {
        setPreviewLoading(false);
      }
    },
    [t, showNotification]
  );

  // Escuchar altura del iframe para eliminar scrollbar (aislamiento de CSS vía iframe)
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'email-preview-height' && typeof e.data?.height === 'number') {
        setIframeHeight(Math.max(200, e.data.height));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  useEffect(() => {
    if (!selectedTemplate) {
      setPreviewHtml('');
      return;
    }
    const vars = formValues[selectedTemplate.id] || {};
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview(selectedTemplate.id, vars);
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selectedTemplate?.id, formValues, fetchPreview]);

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(apiUrl('/api/system/email-templates'));
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          const list = data.data as EmailTemplate[];
          setTemplates(list);
          const initial: Record<string, Record<string, string>> = {};
          list.forEach((tpl) => {
            initial[tpl.id] = {};
            tpl.variables.forEach((v) => {
              initial[tpl.id][v] = DEFAULT_VALUES[v] ?? `{${v}}`;
            });
          });
          setFormValues(initial);
          if (list.length > 0 && !selectedId) {
            setSelectedId(list[0].id);
          }
        } else {
          setError(data.error?.message || t('emailTemplates.errorLoad'));
        }
      } catch {
        setError(t('emailTemplates.errorConnection'));
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, [t]);

  const updateFormValue = (templateId: string, key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [templateId]: {
        ...(prev[templateId] || {}),
        [key]: value,
      },
    }));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Heading level={1}>{t('emailTemplates.title')}</Heading>
          <Text tone="secondary" className="mt-1">
            {t('emailTemplates.subtitle')}
          </Text>
        </div>
        {templates.length > 0 && (
          <Inline gap={2}>
            <Select
              items={templates.map((tpl) => ({ value: tpl.id, label: tpl.name }))}
              value={selectedId}
              onValueChange={(value) => setSelectedId(value || null)}
              aria-label={t('emailTemplates.title')}
              className="min-w-[200px]"
            />
            <Tooltip content={t('tooltips.sendTestEmail')}>
              <Button
                variant="primary"
                size="sm"
                leading={<Icon icon={Mail} size={14} />}
                onClick={() => {
                  setSendTestEmail('');
                  setSendTestDialogOpen(true);
                }}
              >
                {t('emailTemplates.sendEmail')}
              </Button>
            </Tooltip>
          </Inline>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Spinner size={20} label={t('common.loading')} className="text-muted" />
        </div>
      ) : error ? (
        <Card className="border-danger-border/30">
          <CardBody className="py-12 text-center">
            <Text tone="secondary">{error}</Text>
          </CardBody>
        </Card>
      ) : templates.length === 0 ? (
        <Card className="border-dashed">
          <EmptyState
            icon={Mail}
            title={t('emailTemplates.noTemplates')}
            description={t('emailTemplates.noTemplatesDesc')}
          />
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Formulario */}
          {selectedTemplate && (
            <Card>
              <CardBody>
                <div className="flex flex-wrap items-center gap-3">
                  {selectedTemplate.variables.map((v) => (
                    <FormField key={v} label={<span className="font-mono">{v}</span>} className="shrink-0">
                      <Input
                        placeholder={`{${v}}`}
                        value={(formValues[selectedTemplate.id] || {})[v] ?? ''}
                        onChange={(e) => updateFormValue(selectedTemplate.id, v, e.target.value)}
                        className="font-mono"
                        wrapperClassName="w-40"
                      />
                    </FormField>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Previsualización automática */}
          {selectedTemplate && (
            <Card className="min-h-[70vh]">
              <CardBody className="flex flex-1 flex-col min-h-0 p-6">
                <div
                  className={cn(
                    'flex flex-1 min-h-0 flex-col rounded-lg border border-border bg-white overflow-x-auto',
                    !previewHtml && !previewLoading && 'flex items-center justify-center min-h-[200px]'
                  )}
                >
                  {previewHtml ? (
                    <iframe
                      key={previewIdRef.current}
                      srcDoc={
                        previewHtml.includes('</body>')
                          ? previewHtml.replace(
                            '</body>',
                            `<script>(function(){function s(){var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);if(window.parent!==window)window.parent.postMessage({type:'email-preview-height',height:h},'*');}if(document.readyState==='complete')s();else window.addEventListener('load',s);})();<\/script></body>`
                          )
                          : previewHtml +
                          `<script>(function(){function s(){var h=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight);if(window.parent!==window)window.parent.postMessage({type:'email-preview-height',height:h},'*');}if(document.readyState==='complete')s();else window.addEventListener('load',s);})();<\/script>`
                      }
                      title={t('emailTemplates.previewTitle')}
                      className="w-full flex-1 min-h-0 border-0"
                      style={{ minHeight: iframeHeight }}
                      sandbox="allow-same-origin"
                    />
                  ) : !previewLoading ? (
                    <Text tone="muted" className="p-6">
                      {t('emailTemplates.previewHint')}
                    </Text>
                  ) : null}
                </div>
              </CardBody>
            </Card>
          )}

          {/* Dialog para enviar email de prueba */}
          <Dialog open={sendTestDialogOpen} onOpenChange={setSendTestDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('emailTemplates.sendTestDialogTitle')}</DialogTitle>
                <DialogDescription>{t('emailTemplates.sendTestDialogDescription')}</DialogDescription>
              </DialogHeader>
              <div className="py-2">
                <FormField label={t('emailTemplates.sendTestDialogEmailLabel')}>
                  <Input
                    id="send-test-email"
                    type="email"
                    placeholder="email@ejemplo.com"
                    value={sendTestEmail}
                    onChange={(e) => setSendTestEmail(e.target.value)}
                  />
                </FormField>
              </div>
              <DialogFooter>
                <Button variant="secondary" onClick={() => setSendTestDialogOpen(false)}>
                  {t('emailTemplates.sendTestDialogCancel')}
                </Button>
                <Button
                  variant="primary"
                  onClick={() => {
                    /* TODO: enviar email al destinatario */
                    showNotification(t('emailTemplates.sendEmailComingSoon'), 'success');
                    setSendTestDialogOpen(false);
                  }}
                >
                  {t('emailTemplates.sendTestDialogSend')}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </motion.div>
  );
}
