'use client';

import { useState } from 'react';
import { Loader2, Copy, Check, Key, Shield, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';

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
  const [copySecret, setCopySecret] = useState(false);
  const [copyPublishable, setCopyPublishable] = useState(false);

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

  const handleCopy = (text: string, type: 'secret' | 'publishable') => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showNotification(type === 'secret' ? t('onboarding.secretKeyCopied') : t('onboarding.publishableKeyCopied'), 'success');
    if (type === 'secret') setCopySecret(true);
    else setCopyPublishable(true);
    setTimeout(() => (type === 'secret' ? setCopySecret(false) : setCopyPublishable(false)), 600);
  };

  const handleFinish = () => {
    const path = `${BASE_PATH}`.replace(/\/+/g, '/') || '/';
    window.location.href = path || '/';
  };

  const data = response?.data;

  return (
    <div className="min-h-screen flex bg-[#0f0f12] text-white">
      {/* Left pane - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-lg">
              A
            </div>
            <span className="text-2xl font-bold tracking-tight">Foundathyon</span>
          </div>
        </div>
        <p className="text-muted-foreground/90 text-sm max-w-xs">
          {t('onboarding.branding')}
        </p>
      </div>

      {/* Right pane - Form / Success */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 lg:p-16">
        <div className="w-full max-w-md">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center font-bold text-primary-foreground text-lg">
              A
            </div>
            <span className="text-2xl font-bold tracking-tight">Foundathyon</span>
          </div>

          {step === 'form' ? (
            <>
              <h1 className="text-2xl font-bold mb-2">{t('onboarding.setupTitle')}</h1>
              <p className="text-muted-foreground text-sm mb-8">
                {t('onboarding.setupDesc')}
              </p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="name" className="text-foreground">{t('onboarding.appName')}</Label>
                  <Input
                    id="name"
                    required
                    placeholder={t('onboarding.appNamePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                    className="bg-background/50 border-border"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-foreground">{t('onboarding.adminEmail')}</Label>
                  <Input
                    id="email"
                    required
                    type="email"
                    placeholder={t('onboarding.adminEmailPlaceholder')}
                    value={formData.root_email}
                    onChange={(e) => setFormData((p) => ({ ...p, root_email: e.target.value }))}
                    className="bg-background/50 border-border"
                  />
                </div>
                <Button type="submit" className="w-full h-11" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                      {t('onboarding.creating')}
                    </>
                  ) : (
                    t('onboarding.createApp')
                  )}
                </Button>
              </form>
            </>
          ) : (
            <div className="space-y-6">
              <h1 className="text-2xl font-bold">{t('onboarding.successTitle')}</h1>
              <p className="text-muted-foreground text-sm">
                {t('onboarding.successDesc', { name: data?.name ?? '' })}
              </p>

              <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{t('onboarding.keysWarning')}</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> {t('onboarding.secretKey')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={data?.secret_key || ''}
                      className="font-mono text-xs bg-background/50 border-border flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopy(data?.secret_key || '', 'secret')}
                    >
                      {copySecret ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5" /> {t('onboarding.publishableKey')}
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={data?.publishable_key || ''}
                      className="font-mono text-xs bg-background/50 border-border flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="shrink-0"
                      onClick={() => handleCopy(data?.publishable_key || '', 'publishable')}
                    >
                      {copyPublishable ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </div>

              {data?.created_role && (
                <div className="rounded-lg border border-border bg-background/30 p-4 space-y-2">
                  <Label className="text-muted-foreground text-xs flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5" /> {t('onboarding.roleCreated')}
                  </Label>
                  <div>
                    <p className="font-medium">{data.created_role.name}</p>
                    <p className="text-xs text-muted-foreground">{data.created_role.description}</p>
                    <p className="text-xs font-mono text-muted-foreground/80 mt-1">{data.created_role.id}</p>
                  </div>
                </div>
              )}

              <Button onClick={handleFinish} className="w-full h-11">
                {t('onboarding.goToDashboard')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
