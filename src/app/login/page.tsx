'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  AuthForm,
  Button,
  Card,
  CardBody,
  FormField,
  Heading,
  Input,
  PasswordInput,
  Text,
} from '@foundathyon/community-ui';
import { BrandMark, BrandPanel } from '@/components/auth-brand-panel';
import { useI18n } from '@/context/i18n-context';
import { apiUrl, BASE_PATH } from '@/lib/utils';
import styles from '@/styles/auth-shell.module.css';

// Same orange as Dokgistry's --vault-accent (#f97316), expressed as the
// oklch triple @foundathyon/community-ui's accent engine needs — see
// accounts-admin-community-ui-migration memory for the exact conversion.

function LoginForm() {
  const router = useRouter();
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const from = searchParams.get('from') || '/';
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/admin/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, password }),
        credentials: 'include',
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        const redirectTo = from.startsWith('/') ? from : `/${from}`;
        const fullPath = `${BASE_PATH}${redirectTo}`.replace(/\/+/g, '/') || '/';
        router.push(fullPath);
        router.refresh();
      } else {
        setError(data.error || t('login.errorLogin'));
      }
    } catch {
      setError(t('login.errorConnection'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.shell}>
      <BrandPanel headline={t('login.brandHeadline')} tagline={t('login.brandTagline')} />

      <section className={styles.formPane}>
        <div className={styles.formCard}>
          <BrandMark />

          <Card>
            <CardBody className="flex flex-col gap-5">
              <div>
                <Heading level={1} visual="h2">
                  {t('login.title')}
                </Heading>
                <Text tone="secondary">{t('login.subtitle')}</Text>
              </div>

              <AuthForm
                error={error || undefined}
                loading={loading}
                onSubmit={handleSubmit}
                submitSlot={
                  <Button type="submit" variant="primary" loading={loading} className="w-full">
                    {loading ? t('login.entering') : t('login.enter')}
                  </Button>
                }
              >
                <FormField label={t('login.user')}>
                  <Input
                    name="user"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={user}
                    onChange={(e) => setUser(e.target.value)}
                    placeholder="admin"
                    required
                    autoFocus
                  />
                </FormField>
                <FormField label={t('login.password')}>
                  <PasswordInput
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    showPasswordLabel={t('login.showPassword')}
                    hidePasswordLabel={t('login.hidePassword')}
                  />
                </FormField>
              </AuthForm>
            </CardBody>
          </Card>
        </div>
      </section>
    </div>
  );
}

function LoginFallback() {
  const { t } = useI18n();
  return (
    <div className={styles.shell} style={{ alignItems: 'center', justifyContent: 'center' }}>
      <Text tone="muted">{t('common.loading')}</Text>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
