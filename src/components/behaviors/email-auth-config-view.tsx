'use client';

import { Mail, Link2, Lock, ShieldCheck, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface EmailAuthConfig {
  identifier?: string;
  email?: {
    allow_plus_alias?: boolean;
    enabled?: boolean;
    normalize?: { lowercase?: boolean; trim?: boolean };
  };
  magic_link?: {
    bind_to_ip?: boolean;
    bind_to_user_agent?: boolean;
    enabled?: boolean;
    max_attempts_per_window?: number;
    single_use?: boolean;
    ttl_seconds?: number;
    window_seconds?: number;
  };
  password?: {
    enabled?: boolean;
    policy?: {
      deny_common_passwords?: boolean;
      max_length?: number;
      min_digits?: number;
      min_length?: number;
      min_lowercase?: number;
      min_special_char?: number;
      min_uppercase?: number;
      special_chars?: string[];
    };
  };
  verification?: {
    code_size?: number;
    code_type?: string;
    enabled?: boolean;
    mode?: string;
    ttl_seconds?: number;
  };
}

interface ConfigSectionProps {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}

function ConfigSection({ icon, title, children }: ConfigSectionProps) {
  return (
    <div className="rounded-xl border border-border/60 bg-muted/30 p-4">
      <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-foreground">
        {icon}
        {title}
      </div>
      <div className="space-y-2 text-sm">{children}</div>
    </div>
  );
}

function BoolBadge({ value }: { value?: boolean }) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge
      variant="outline"
      className={cn(
        value ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' : 'bg-rose-500/10 text-rose-400 border-rose-500/30'
      )}
    >
      {value ? 'Sí' : 'No'}
    </Badge>
  );
}

function ConfigRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium">{value}</span>
    </div>
  );
}

interface EmailAuthConfigViewProps {
  config: EmailAuthConfig;
  onToggleVerification?: () => void;
  togglingVerification?: boolean;
}

export function EmailAuthConfigView({ config, onToggleVerification, togglingVerification }: EmailAuthConfigViewProps) {
  const email = config.email ?? {};
  const magic = config.magic_link ?? {};
  const password = config.password ?? {};
  const policy = password.policy ?? {};
  const verification = config.verification ?? {};

  return (
    <div className="space-y-6">
      {config.identifier && (
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground uppercase tracking-wider">Identificador</span>
          <Badge variant="secondary" className="font-mono">
            {config.identifier}
          </Badge>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <ConfigSection icon={<Mail className="w-4 h-4 text-sky-400" />} title="Email">
          <ConfigRow label="Activo" value={<BoolBadge value={email.enabled} />} />
          <ConfigRow label="Permitir alias +" value={<BoolBadge value={email.allow_plus_alias} />} />
          {email.normalize && (
            <div className="pt-2 mt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Normalización</div>
              <div className="flex gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">
                  lowercase: {email.normalize.lowercase ? 'sí' : 'no'}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  trim: {email.normalize.trim ? 'sí' : 'no'}
                </Badge>
              </div>
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<Link2 className="w-4 h-4 text-violet-400" />} title="Magic Link">
          <ConfigRow label="Activo" value={<BoolBadge value={magic.enabled} />} />
          <ConfigRow label="Un solo uso" value={<BoolBadge value={magic.single_use} />} />
          <ConfigRow label="Vincular a IP" value={<BoolBadge value={magic.bind_to_ip} />} />
          <ConfigRow label="Vincular a User-Agent" value={<BoolBadge value={magic.bind_to_user_agent} />} />
          <ConfigRow
            label="Intentos máx. por ventana"
            value={<span className="font-mono">{magic.max_attempts_per_window ?? '—'}</span>}
          />
          <ConfigRow label="TTL (seg)" value={<span className="font-mono">{magic.ttl_seconds ?? '—'}</span>} />
          <ConfigRow label="Ventana (seg)" value={<span className="font-mono">{magic.window_seconds ?? '—'}</span>} />
        </ConfigSection>

        <ConfigSection icon={<Lock className="w-4 h-4 text-amber-400" />} title="Password">
          <ConfigRow label="Activo" value={<BoolBadge value={password.enabled} />} />
          {policy && (
            <div className="pt-2 mt-2 space-y-1 border-t border-border/50">
              <div className="text-xs text-muted-foreground mb-1">Política</div>
              <ConfigRow label="Longitud mín." value={<span className="font-mono">{policy.min_length ?? '—'}</span>} />
              <ConfigRow label="Longitud máx." value={<span className="font-mono">{policy.max_length ?? '—'}</span>} />
              <ConfigRow label="Mayúsculas mín." value={<span className="font-mono">{policy.min_uppercase ?? '—'}</span>} />
              <ConfigRow label="Minúsculas mín." value={<span className="font-mono">{policy.min_lowercase ?? '—'}</span>} />
              <ConfigRow label="Dígitos mín." value={<span className="font-mono">{policy.min_digits ?? '—'}</span>} />
              <ConfigRow label="Caracteres esp. mín." value={<span className="font-mono">{policy.min_special_char ?? '—'}</span>} />
              {policy.special_chars && policy.special_chars.length > 0 && (
                <ConfigRow
                  label="Caracteres especiales"
                  value={
                    <span className="font-mono text-xs">
                      [{policy.special_chars.join(', ')}]
                    </span>
                  }
                />
              )}
              <ConfigRow
                label="Rechazar contraseñas comunes"
                value={<BoolBadge value={policy.deny_common_passwords} />}
              />
            </div>
          )}
        </ConfigSection>

        <ConfigSection icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />} title="Verificación">
          <ConfigRow label="Activo" value={<BoolBadge value={verification.enabled} />} />
          <ConfigRow label="Modo" value={<span className="font-mono">{verification.mode ?? '—'}</span>} />
          <ConfigRow label="Tamaño del código" value={<span className="font-mono">{verification.code_size ?? '—'}</span>} />
          <ConfigRow label="Tipo de código" value={<span className="font-mono">{verification.code_type ?? '—'}</span>} />
          <ConfigRow label="TTL (seg)" value={<span className="font-mono">{verification.ttl_seconds ?? '—'}</span>} />
          {onToggleVerification && (
            <div className="pt-3 mt-2 border-t border-border/50">
              <Button
                variant="outline"
                size="sm"
                onClick={onToggleVerification}
                disabled={togglingVerification}
                className="gap-2"
              >
                {togglingVerification ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                {verification.enabled ? 'Desactivar verificación' : 'Activar verificación'}
              </Button>
            </div>
          )}
        </ConfigSection>
      </div>
    </div>
  );
}
