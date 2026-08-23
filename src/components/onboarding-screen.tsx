'use client';

import { useState } from 'react';
import { Key, Shield } from 'lucide-react';
import {
  Alert,
  Button,
  Card,
  CardBody,
  FormField,
  Heading,
  Icon,
  Input,
  Text,
  TokenDisplay,
} from '@foundathyon/community-ui';
import { BrandMark, BrandPanel } from '@/components/auth-brand-panel';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import styles from '@/styles/auth-shell.module.css';

// Same orange as Dokgistry's --vault-accent (#f97316) — see login/page.tsx.

interface CreateAppResponse {
  data?: {
    id: string;
    name: string;
    root_email: string;
    secret_key: string;
    publishable_key: string;
    created_role?: { id: string; name: string; description: string };
    activated_behaviors?: unknown[];
  };
  success?: boolean;
}

export function OnboardingScreen() {
  const { apiUrl: getApiUrl, showNotification, setSavedSecretKey, setSavedPublishableKey } = useAdmin();
  const { t } = useI18n();
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [formData, setFormData] = useState({ name: '', root_email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [response, setResponse] = useState<CreateAppResponse | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.root_email.trim()) {
      showNotification(t('onboarding.completeFields'), 'error');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          root_email: formData.root_email.trim(),
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setResponse(data);
        setStep('success');
        const sk = data.data.secret_key;
        if (sk && typeof sk === 'string') {
          setSavedSecretKey(sk.trim());
        }
        const pk = data.data.publishable_key;
        if (pk && typeof pk === 'string') {
          setSavedPublishableKey(pk.trim());
        }
        showNotification(t('onboarding.appCreated'), 'success');
      } else {
        showNotification(data.error?.message || data.Error?.message || t('onboarding.errorCreate'), 'error');
      }
    } catch {
      showNotification(t('settings.errorConnectionServer'), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFinish = () => {
    const path = `${BASE_PATH}`.replace(/\/+/g, '/') || '/';
    window.location.href = path || '/';
  };

  const data = response?.data;

  return (
    <div className={styles.shell}>
      <BrandPanel headline={t('onboarding.brandHeadline')} tagline={t('onboarding.branding')} />

      <section className={styles.formPane}>
        <div className={styles.formCard}>
          <BrandMark />

          <Card>
            <CardBody className="flex flex-col gap-5">
              <div>
                <Heading level={1} visual="h2">
                  {step === 'form' ? t('onboarding.setupTitle') : t('onboarding.successTitle')}
                </Heading>
                <Text tone="secondary">
                  {step === 'form'
                    ? t('onboarding.setupDesc')
                    : t('onboarding.successDesc', { name: data?.name ?? '' })}
                </Text>
              </div>

              {step === 'form' ? (
                <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="flex flex-col gap-5">
                  <FormField label={t('onboarding.appName')}>
                    <Input
                      required
                      placeholder={t('onboarding.appNamePlaceholder')}
                      value={formData.name}
                      onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    />
                  </FormField>
                  <FormField label={t('onboarding.adminEmail')}>
                    <Input
                      required
                      type="email"
                      placeholder={t('onboarding.adminEmailPlaceholder')}
                      value={formData.root_email}
                      onChange={(e) => setFormData((p) => ({ ...p, root_email: e.target.value }))}
                    />
                  </FormField>
                  <Button type="submit" variant="primary" loading={isSubmitting} className="w-full">
                    {isSubmitting ? t('onboarding.creating') : t('onboarding.createApp')}
                  </Button>
                </form>
              ) : (
                <div className="flex flex-col gap-5">
                  <Alert tone="warning" title={t('onboarding.keysWarning')} />

                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Text variant="label" tone="muted" className="flex items-center gap-1.5">
                        <Icon icon={Key} size={14} /> {t('onboarding.secretKey')}
                      </Text>
                      <TokenDisplay value={data?.secret_key || ''} warning={null} />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Text variant="label" tone="muted" className="flex items-center gap-1.5">
                        <Icon icon={Key} size={14} /> {t('onboarding.publishableKey')}
                      </Text>
                      <TokenDisplay value={data?.publishable_key || ''} warning={null} />
                    </div>
                  </div>

                  {data?.created_role && (
                    <div className="flex flex-col gap-2 rounded-lg border border-border bg-subtle p-4">
                      <Text variant="label" tone="muted" className="flex items-center gap-1.5">
                        <Icon icon={Shield} size={14} /> {t('onboarding.roleCreated')}
                      </Text>
                      <div>
                        <Text className="font-medium">{data.created_role.name}</Text>
                        <Text as="p" variant="caption" tone="muted">
                          {data.created_role.description}
                        </Text>
                        <Text as="p" variant="caption" tone="muted" className="font-mono mt-1">
                          {data.created_role.id}
                        </Text>
                      </div>
                    </div>
                  )}

                  <Button onClick={handleFinish} variant="primary" className="w-full">
                    {t('onboarding.goToDashboard')}
                  </Button>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}
