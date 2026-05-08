'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { apiUrl } from '@/lib/utils';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
          <h1 className="text-3xl font-bold">{t('emailTemplates.title')}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t('emailTemplates.subtitle')}</p>
        </div>
        {templates.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedId ?? ''}
              onChange={(e) => setSelectedId(e.target.value || null)}
              className="px-4 py-2 rounded-lg border border-input bg-background text-sm font-medium min-w-[200px]"
            >
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setSendTestEmail('');
                    setSendTestDialogOpen(true);
                  }}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  {t('emailTemplates.sendEmail')}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {t('tooltips.sendTestEmail')}
              </TooltipContent>
            </Tooltip>
          </div>
        )}
      </div>

      {loading ? (
        <div className="py-20 flex justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <Card className="border-destructive/30">
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      ) : templates.length === 0 ? (
        <Card className="border-dashed p-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-8 h-8 text-amber-400" />
          </div>
          <CardTitle className="mb-2">{t('emailTemplates.noTemplates')}</CardTitle>
          <CardDescription>{t('emailTemplates.noTemplatesDesc')}</CardDescription>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Formulario */}
          {selectedTemplate && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-wrap items-center gap-3">
                  {selectedTemplate.variables.map((v) => (
                    <div key={v} className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-mono text-muted-foreground">{v}:</span>
                      <Input
                        placeholder={`{${v}}`}
                        value={(formValues[selectedTemplate.id] || {})[v] ?? ''}
                        onChange={(e) => updateFormValue(selectedTemplate.id, v, e.target.value)}
                        className="font-mono text-sm w-40"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Previsualización automática */}
          {selectedTemplate && (
            <Card className="flex min-h-[70vh] flex-col">
              <CardContent className="flex flex-1 flex-col min-h-0 p-6">
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
                    <p className="text-sm text-muted-foreground p-6">
                      {t('emailTemplates.previewHint')}
                    </p>
                  ) : null}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Dialog para enviar email de prueba */}
          <Dialog open={sendTestDialogOpen} onOpenChange={setSendTestDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('emailTemplates.sendTestDialogTitle')}</DialogTitle>
                <DialogDescription>{t('emailTemplates.sendTestDialogDescription')}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-2 py-2">
                <label htmlFor="send-test-email" className="text-sm font-medium">
                  {t('emailTemplates.sendTestDialogEmailLabel')}
                </label>
                <Input
                  id="send-test-email"
                  type="email"
                  placeholder="email@ejemplo.com"
                  value={sendTestEmail}
                  onChange={(e) => setSendTestEmail(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSendTestDialogOpen(false)}>
                  {t('emailTemplates.sendTestDialogCancel')}
                </Button>
                <Button
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
