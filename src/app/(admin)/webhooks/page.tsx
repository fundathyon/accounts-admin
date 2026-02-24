'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Webhook,
  Plus,
  Key,
  ShieldCheck,
  Globe,
  Zap,
  RotateCcw,
  Lock,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  FileJson,
  FormInput,
  Send,
  Power,
  PowerOff,
  Pencil,
  Trash2,
  Search,
  ArrowDownAZ,
  ArrowUpAZ,
  Filter,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAdmin } from '@/context/admin-context';
import { useI18n } from '@/context/i18n-context';
import { BASE_PATH } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { WebhookItem, EventsByCategory, WebhookEvent } from '@/lib/admin-types';

function truncateKey(key: string) {
  if (!key || key.length <= 20) return key;
  return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
}

function useCommonEvents(t: (k: string) => string): WebhookEvent[] {
  return [
    { code: 'accounts.user.signup', description: t('webhooks.eventSignupDesc'), category: t('webhooks.categoryCommon') },
    { code: 'accounts.user.deleted', description: t('webhooks.eventDeletedDesc'), category: t('webhooks.categoryCommon') },
  ];
}

const categoryColor: Record<string, string> = {
  Comunes: 'text-cyan-400 bg-cyan-500/10',
  User: 'text-indigo-400 bg-indigo-500/10',
  Auth: 'text-sky-400 bg-sky-500/10',
  Session: 'text-purple-400 bg-purple-500/10',
  Code: 'text-amber-400 bg-amber-500/10',
  'Role & Policy': 'text-emerald-400 bg-emerald-500/10',
  OAuth: 'text-orange-400 bg-orange-500/10',
  'API Key / App': 'text-pink-400 bg-pink-500/10',
  Security: 'text-rose-400 bg-rose-500/10',
};

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

function getCategoryColor(cat: string) {
  return categoryColor[cat] || 'text-muted-foreground bg-muted';
}

export default function WebhooksPage() {
  const { apiUrl, showNotification, savedSecretKey } = useAdmin();
  const { t } = useI18n();
  const COMMON_EVENTS = useCommonEvents(t);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [eventsByCategory, setEventsByCategory] = useState<EventsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);
  const initialWebhookForm = {
    name: '',
    description: '',
    url: '',
    secret: '',
    retries: 3,
    active: true,
  };
  const [webhookForm, setWebhookForm] = useState(initialWebhookForm);
  const [editingWebhook, setEditingWebhook] = useState<WebhookItem | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isWebhookSubmitting, setIsWebhookSubmitting] = useState(false);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);
  const [webhookEditMode, setWebhookEditMode] = useState<'form' | 'json'>('form');
  const [webhookJsonRaw, setWebhookJsonRaw] = useState('');
  const [togglingWebhookId, setTogglingWebhookId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');

  const buildWebhookPayload = () => ({
    name: webhookForm.name,
    description: webhookForm.description,
    url: webhookForm.url,
    secret: webhookForm.secret,
    retries: webhookForm.retries,
    active: webhookForm.active,
    events: Array.from(selectedEvents),
  });

  const switchToJsonMode = () => {
    const payload = buildWebhookPayload();
    setWebhookJsonRaw(JSON.stringify(payload, null, 2));
    setWebhookEditMode('json');
  };

  const switchToFormMode = () => {
    try {
      const parsed = JSON.parse(webhookJsonRaw) as Record<string, unknown>;
      setWebhookForm({
        name: String(parsed.name ?? ''),
        description: String(parsed.description ?? ''),
        url: String(parsed.url ?? ''),
        secret: String(parsed.secret ?? ''),
        retries: Math.max(0, Math.min(10, Number(parsed.retries ?? 3))),
        active: Boolean(parsed.active ?? true),
      });
      const evs = Array.isArray(parsed.events) ? parsed.events.filter((e): e is string => typeof e === 'string') : [];
      setSelectedEvents(new Set(evs));
      setWebhookEditMode('form');
    } catch {
      showNotification(t('webhooks.invalidJson'), 'error');
    }
  };

  const settingsHref = `${BASE_PATH}/settings`.replace(/\/+/g, '/') || '/settings';

  const fetchWebhooks = async () => {
    if (!savedSecretKey) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/webhooks'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setWebhooks(data.data || []);
      else showNotification(data.error?.message || t('webhooks.errorLoad'), 'error');
    } catch {
      showNotification(t('webhooks.errorConnectionApi'), 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableEvents = async () => {
    try {
      const res = await fetch(apiUrl('/api/webhooks/events'));
      const data = await res.json();
      if (data.success && data.data) {
        setEventsByCategory(data.data);
        const firstCat = Object.keys(data.data)[0];
        if (firstCat) setExpandedCategories(new Set([firstCat]));
      }
    } catch {
      /* silent */
    }
  };

  useEffect(() => {
    fetchAvailableEvents();
  }, []);

  useEffect(() => {
    fetchWebhooks();
  }, [savedSecretKey]);

  const filteredWebhooks = webhooks.filter(wh => {
    const query = searchQuery.toLowerCase();
    const searchMatch = wh.name.toLowerCase().includes(query) ||
      wh.url.toLowerCase().includes(query) ||
      (wh.description && wh.description.toLowerCase().includes(query)) ||
      wh.id.toLowerCase().includes(query);

    if (!searchMatch) return false;

    if (statusFilter === 'active' && !wh.active) return false;
    if (statusFilter === 'inactive' && wh.active) return false;

    return true;
  }).sort((a, b) => {
    const dateA = new Date(a.created_at).getTime();
    const dateB = new Date(b.created_at).getTime();
    return sortBy === 'newest' ? dateB - dateA : dateA - dateB;
  });

  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    let payload: Record<string, unknown>;
    if (webhookEditMode === 'json') {
      try {
        payload = JSON.parse(webhookJsonRaw) as Record<string, unknown>;
      } catch {
        showNotification(t('webhooks.invalidJsonSubmit'), 'error');
        return;
      }
      const events = Array.isArray(payload.events) ? payload.events : [];
      if (events.length === 0) {
        showNotification(t('webhooks.selectAtLeastOneEvent'), 'error');
        return;
      }
    } else {
      if (selectedEvents.size === 0) {
        showNotification(t('webhooks.selectAtLeastOneEventForm'), 'error');
        return;
      }
      payload = buildWebhookPayload();
    }
    setIsWebhookSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/webhooks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('webhooks.webhookCreated'), 'success');
        setIsWebhookModalOpen(false);
        setWebhookForm(initialWebhookForm);
        setSelectedEvents(new Set());
        setEditingWebhook(null);
        setWebhookEditMode('form');
        setWebhookJsonRaw('');
        fetchWebhooks();
      } else showNotification(data.error?.message || t('webhooks.errorCreate'), 'error');
    } catch {
      showNotification(t('webhooks.errorConnection'), 'error');
    } finally {
      setIsWebhookSubmitting(false);
    }
  };

  const toggleEvent = (code: string) => {
    const next = new Set(selectedEvents);
    next.has(code) ? next.delete(code) : next.add(code);
    setSelectedEvents(next);
  };

  const toggleCategory = (category: string) => {
    const next = new Set(expandedCategories);
    next.has(category) ? next.delete(category) : next.add(category);
    setExpandedCategories(next);
  };

  const selectAllInCategory = (category: string, events?: WebhookEvent[]) => {
    const list = events ?? eventsByCategory[category] ?? [];
    const next = new Set(selectedEvents);
    const allSelected = list.every((e: WebhookEvent) => next.has(e.code));
    list.forEach((e: WebhookEvent) => (allSelected ? next.delete(e.code) : next.add(e.code)));
    setSelectedEvents(next);
  };

  const handleToggleActive = async (wh: WebhookItem) => {
    if (!savedSecretKey) return;
    setTogglingWebhookId(wh.id);
    try {
      const res = await fetch(apiUrl(`/api/webhooks/${wh.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify({ active: !wh.active }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(wh.active ? t('webhooks.webhookDeactivated') : t('webhooks.webhookActivated'), 'success');
        fetchWebhooks();
      } else {
        showNotification(data.error?.message || t('webhooks.errorUpdate'), 'error');
      }
    } catch {
      showNotification(t('webhooks.errorConnection'), 'error');
    } finally {
      setTogglingWebhookId(null);
    }
  };

  const [deletingWebhookId, setDeletingWebhookId] = useState<string | null>(null);

  const openEditModal = (wh: WebhookItem) => {
    setWebhookForm({
      name: wh.name,
      description: wh.description ?? '',
      url: wh.url,
      secret: '',
      retries: wh.retries,
      active: wh.active,
    });
    setSelectedEvents(new Set(wh.events));
    setEditingWebhook(wh);
    setWebhookEditMode('form');
    setWebhookJsonRaw('');
    setIsWebhookModalOpen(true);
  };

  const closeWebhookModal = () => {
    setIsWebhookModalOpen(false);
    setEditingWebhook(null);
    setWebhookForm(initialWebhookForm);
    setSelectedEvents(new Set());
    setWebhookEditMode('form');
    setWebhookJsonRaw('');
  };

  const handleUpdateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWebhook || !savedSecretKey) return;
    let payload: Record<string, unknown>;
    if (webhookEditMode === 'json') {
      try {
        payload = JSON.parse(webhookJsonRaw) as Record<string, unknown>;
      } catch {
        showNotification(t('webhooks.invalidJsonSubmit'), 'error');
        return;
      }
      const events = Array.isArray(payload.events) ? payload.events : [];
      if (events.length === 0) {
        showNotification(t('webhooks.selectAtLeastOneEvent'), 'error');
        return;
      }
    } else {
      if (selectedEvents.size === 0) {
        showNotification(t('webhooks.selectAtLeastOneEventForm'), 'error');
        return;
      }
      payload = {
        name: webhookForm.name,
        description: webhookForm.description || undefined,
        url: webhookForm.url,
        retries: webhookForm.retries,
        active: webhookForm.active,
        events: Array.from(selectedEvents),
      };
      if (webhookForm.secret.trim()) payload.secret = webhookForm.secret.trim();
    }
    setIsWebhookSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/api/webhooks/${editingWebhook.id}`), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('webhooks.webhookUpdated'), 'success');
        closeWebhookModal();
        setExpandedWebhook(null);
        fetchWebhooks();
      } else {
        showNotification(data.error?.message || t('webhooks.errorUpdate'), 'error');
      }
    } catch {
      showNotification(t('webhooks.errorConnection'), 'error');
    } finally {
      setIsWebhookSubmitting(false);
    }
  };

  const handleDeleteWebhook = async (wh: WebhookItem) => {
    if (!savedSecretKey) return;
    if (!window.confirm(t('webhooks.deleteWebhookConfirm'))) return;
    setDeletingWebhookId(wh.id);
    try {
      const res = await fetch(apiUrl(`/api/webhooks/${wh.id}`), {
        method: 'DELETE',
        headers: { 'X-Secret-API-Key': savedSecretKey },
      });
      const data = await res.json();
      if (data.success) {
        showNotification(t('webhooks.webhookDeleted'), 'success');
        setExpandedWebhook((prev) => (prev === wh.id ? null : prev));
        fetchWebhooks();
      } else {
        showNotification(data.error?.message || t('webhooks.errorDelete'), 'error');
      }
    } catch {
      showNotification(t('webhooks.errorConnection'), 'error');
    } finally {
      setDeletingWebhookId(null);
    }
  };

  return (
    <>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">{t('webhooks.title')}</h1>
            <p className="text-muted-foreground text-sm mt-1">{t('webhooks.subtitle')}</p>
          </div>
          <div className="flex gap-2">
            {!savedSecretKey ? (
              <Button variant="outline" asChild className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                <Link href={settingsHref}>
                  <Key className="w-4 h-4" /> {t('webhooks.configSecretKey')}
                </Link>
              </Button>
            ) : (
              <Button
                onClick={() => {
                  setEditingWebhook(null);
                  setWebhookForm(initialWebhookForm);
                  setSelectedEvents(new Set());
                  setWebhookEditMode('form');
                  setWebhookJsonRaw('');
                  setIsWebhookModalOpen(true);
                }}
                className="gap-2"
              >
                <Plus className="w-4 h-4" /> {t('webhooks.newWebhook')}
              </Button>
            )}
          </div>
        </div>

        {!savedSecretKey ? (
          <Card className="border-amber-500/20 p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Key className="w-8 h-8 text-amber-400" />
            </div>
            <CardTitle className="text-amber-300 mb-2">{t('webhooks.secretKeyRequired')}</CardTitle>
            <CardDescription className="mb-6">{t('webhooks.configSecretKeyCard')}</CardDescription>
            <Button asChild>
              <Link href={settingsHref}>{t('webhooks.goToSettings')}</Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
              <ShieldCheck className="w-4 h-4" /> {t('webhooks.consultingWith')} <span className="font-mono">{truncateKey(savedSecretKey)}</span>
            </div>

            <div className="flex flex-wrap items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border/50">
              <div className="relative flex-1 min-w-[300px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder={t('webhooks.searchPlaceholder') || "Search by name, URL or ID..."}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 h-10 border-none bg-background shadow-none focus-visible:ring-1 focus-visible:ring-primary/30"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{t('users.state')}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                      <SelectTrigger className="w-[140px] h-10 border-none bg-background shadow-none focus:ring-1 focus:ring-primary/30">
                        <div className="flex items-center gap-2">
                          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                          <SelectValue placeholder={t('users.state') || "State"} />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t('common.all') || "All"}</SelectItem>
                        <SelectItem value="active">{t('common.active') || "Active"}</SelectItem>
                        <SelectItem value="inactive">{t('behaviors.inactive') || "Inactive"}</SelectItem>
                      </SelectContent>
                    </Select>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tooltips.state')}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSortBy(sortBy === 'newest' ? 'oldest' : 'newest')}
                      className="h-10 gap-2 text-xs font-medium text-muted-foreground hover:text-foreground px-3 bg-background hover:bg-background/80"
                    >
                      {sortBy === 'newest' ? <ArrowDownAZ className="w-4 h-4" /> : <ArrowUpAZ className="w-4 h-4" />}
                      {sortBy === 'newest' ? t('users.sortByNewest') || "Newest" : t('users.sortByOldest') || "Oldest"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {t('tooltips.sortBy')}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {webhooks.length === 0 ? (
              <Card className="border-dashed p-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Webhook className="w-8 h-8 text-primary" />
                </div>
                <CardTitle className="mb-2">{t('webhooks.noWebhooks')}</CardTitle>
                <CardDescription className="mb-6">{t('webhooks.createFirst')}</CardDescription>
                <Button
                  onClick={() => {
                    setEditingWebhook(null);
                    setWebhookForm(initialWebhookForm);
                    setSelectedEvents(new Set());
                    setWebhookEditMode('form');
                    setWebhookJsonRaw('');
                    setIsWebhookModalOpen(true);
                  }}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" /> {t('webhooks.addWebhook')}
                </Button>
              </Card>
            ) : (
              <div className="space-y-3">
                {filteredWebhooks.map((wh) => (
                  <Card key={wh.id} className="overflow-hidden">
                    <Button
                      variant="ghost"
                      className="w-full justify-start px-6 py-5 h-auto flex items-center gap-4 hover:bg-muted/50 transition-colors"
                      onClick={() => setExpandedWebhook(expandedWebhook === wh.id ? null : wh.id)}
                    >
                      <div className={cn('w-3 h-3 rounded-full shrink-0', wh.active ? 'bg-emerald-400' : 'bg-slate-600')} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3">
                          <span className="font-semibold">{wh.name}</span>
                          {wh.active ? (
                            <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-0">
                              {t('common.active')}
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-muted text-muted-foreground">
                              {t('behaviors.inactive')}
                            </Badge>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                          <Globe className="w-3 h-3" /> <span className="truncate max-w-xs">{wh.url}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Zap className="w-3.5 h-3.5" /> {wh.events.length} {t('webhooks.events')}
                        </div>
                        <div className="flex items-center gap-1">
                          <RotateCcw className="w-3.5 h-3.5" /> {wh.retries} {t('webhooks.retries')}
                        </div>
                        <div className="text-muted-foreground">{new Date(wh.created_at).toLocaleDateString()}</div>
                      </div>
                      {expandedWebhook === wh.id ? (
                        <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform shrink-0" />
                      )}
                    </Button>
                    <AnimatePresence>
                      {expandedWebhook === wh.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden border-t border-border"
                        >
                          <div className="px-6 py-5 space-y-5">
                            <div className="grid grid-cols-2 gap-6">
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">{t('webhooks.details')}</h4>
                                <div className="space-y-2 text-sm">
                                  {wh.description && <p className="text-foreground">{wh.description}</p>}
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Lock className="w-3.5 h-3.5" />
                                    <span className="font-mono text-xs">{wh.secret.slice(0, 6)}{'•'.repeat(8)}</span>
                                    <span className="text-muted-foreground text-xs">{t('webhooks.secretHash')}</span>
                                  </div>
                                  <div className="text-xs text-muted-foreground font-mono">ID: {wh.id}</div>
                                </div>
                              </div>
                              <div>
                                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
                                  {t('webhooks.subscribedEvents')} ({wh.events.length})
                                </h4>
                                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                  {wh.events.map((ev) => {
                                    const cat = ev.split('.')[1] || '';
                                    const colorKey = Object.keys(categoryColor).find((k) => k.toLowerCase().includes(cat.toLowerCase())) || '';
                                    const color = categoryColor[colorKey] || 'text-muted-foreground bg-muted';
                                    return (
                                      <span key={ev} className={cn('px-2 py-0.5 rounded-md text-xs font-mono font-medium', color)}>
                                        {ev}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                            <div className="pt-3 border-t border-border flex flex-wrap items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => openEditModal(wh)}
                              >
                                <Pencil className="w-4 h-4" /> {t('webhooks.editWebhook')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={deletingWebhookId === wh.id}
                                onClick={() => handleDeleteWebhook(wh)}
                              >
                                {deletingWebhookId === wh.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Trash2 className="w-4 h-4" />
                                )}
                                {deletingWebhookId === wh.id ? t('webhooks.deleting') : t('webhooks.deleteWebhook')}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                disabled={togglingWebhookId === wh.id}
                                onClick={() => handleToggleActive(wh)}
                              >
                                {togglingWebhookId === wh.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : wh.active ? (
                                  <PowerOff className="w-4 h-4" />
                                ) : (
                                  <Power className="w-4 h-4" />
                                )}
                                {wh.active ? t('webhooks.deactivate') : t('webhooks.activate')}
                              </Button>
                              <Button variant="outline" size="sm" className="gap-2" asChild>
                                <Link href={`${BASE_PATH}/webhooks/${wh.id}/test`.replace(/\/+/g, '/')}>
                                  <Send className="w-4 h-4" /> {t('webhooks.sendTestEvent')}
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
      </motion.div>

      <Dialog open={isWebhookModalOpen} onOpenChange={(open) => { if (!open) closeWebhookModal(); setIsWebhookModalOpen(open); }}>
        <DialogContent className="sm:max-w-4xl max-w-full max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary">
                  <Webhook className="w-5 h-5" />
                </div>
                <DialogTitle>{editingWebhook ? t('webhooks.editWebhookTitle') : t('webhooks.newWebhook')}</DialogTitle>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => (webhookEditMode === 'form' ? switchToJsonMode() : switchToFormMode())}
              >
                {webhookEditMode === 'form' ? (
                  <>
                    <FileJson className="w-4 h-4" /> {t('webhooks.editJson')}
                  </>
                ) : (
                  <>
                    <FormInput className="w-4 h-4" /> {t('webhooks.backToForm')}
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>

          <form onSubmit={editingWebhook ? handleUpdateWebhook : handleCreateWebhook} className="flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="overflow-y-auto space-y-6">
              {webhookEditMode === 'json' ? (
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <FileJson className="w-4 h-4" /> {t('webhooks.jsonLabel')}
                  </Label>
                  <textarea
                    value={webhookJsonRaw}
                    onChange={(e) => setWebhookJsonRaw(e.target.value)}
                    className="w-full min-h-[320px] rounded-xl border border-input bg-background px-4 py-3 font-mono text-sm resize-y focus:outline-none focus:ring-2 focus:ring-ring"
                    placeholder='{"name":"...","url":"...","events":[...]}'
                    spellCheck={false}
                  />
                  <p className="text-xs text-muted-foreground">
                    {t('webhooks.jsonPlaceholder')}
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>{t('webhooks.nameRequired')}</Label>
                      <Input
                        required
                        placeholder={t('webhooks.name')}
                        value={webhookForm.name}
                        onChange={(e) => setWebhookForm((p) => ({ ...p, name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t('webhooks.description')}</Label>
                      <Input placeholder={t('webhooks.optional')} value={webhookForm.description} onChange={(e) => setWebhookForm((p) => ({ ...p, description: e.target.value }))} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="w-4 h-4" /> {t('webhooks.urlLabel')}
                    </Label>
                    <Input
                      required
                      type="url"
                      placeholder="https://tuapp.com/webhooks"
                      value={webhookForm.url}
                      onChange={(e) => setWebhookForm((p) => ({ ...p, url: e.target.value }))}
                      className="font-mono"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Lock className="w-4 h-4" /> {t('webhooks.secretLabel')} {editingWebhook ? `(${t('webhooks.optional')})` : ''}
                      </Label>
                      <Input
                        required={!editingWebhook}
                        placeholder={editingWebhook ? t('webhooks.secretLeaveEmpty') : 'mi-secret-seguro'}
                        value={webhookForm.secret}
                        onChange={(e) => setWebhookForm((p) => ({ ...p, secret: e.target.value }))}
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <RotateCcw className="w-4 h-4" /> {t('webhooks.retriesLabel')}
                      </Label>
                      <Input type="number" min={0} max={10} value={webhookForm.retries} onChange={(e) => setWebhookForm((p) => ({ ...p, retries: +e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl border">
                    <div>
                      <div className="text-sm font-medium">{t('webhooks.activateImmediately')}</div>
                      <CardDescription>{t('webhooks.activateImmediatelyDesc')}</CardDescription>
                    </div>
                    <Switch checked={webhookForm.active} onCheckedChange={(active) => setWebhookForm((p) => ({ ...p, active }))} />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label className="flex items-center gap-2">
                        <Zap className="w-4 h-4" /> {t('webhooks.eventsToSubscribe')}
                      </Label>
                      <span className="text-xs text-primary font-semibold">{selectedEvents.size} {t('webhooks.selectedCount')}</span>
                    </div>

                    {/* Eventos más comunes - siempre visible arriba */}
                    <div className="mb-4 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={cn('px-2 py-0.5 rounded-md text-xs font-semibold', getCategoryColor('Comunes'))}>{t('webhooks.mostCommon')}</span>
                      </div>
                      <div className="space-y-1 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3">
                        {COMMON_EVENTS.map((ev) => (
                          <label
                            key={ev.code}
                            className="flex items-start gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group"
                          >
                            <div
                              className={cn(
                                'w-4 h-4 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                                selectedEvents.has(ev.code) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                              )}
                            >
                              {selectedEvents.has(ev.code) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                            </div>
                            <input
                              type="checkbox"
                              className="hidden"
                              checked={selectedEvents.has(ev.code)}
                              onChange={() => toggleEvent(ev.code)}
                            />
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-mono font-medium">{ev.code}</div>
                              <div className="text-xs text-muted-foreground mt-0.5 truncate">{ev.description}</div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2 bg-muted/30 rounded-2xl border p-3 max-h-56 overflow-y-auto">
                      {Object.entries(eventsByCategory).map(([category, catEvents]) => {
                        const commonCodes = new Set(COMMON_EVENTS.map((e) => e.code));
                        const filteredEvents = catEvents.filter((e) => !commonCodes.has(e.code));
                        if (filteredEvents.length === 0) return null;
                        return (
                          <div key={category}>
                            <Button
                              type="button"
                              variant="ghost"
                              className="w-full justify-between px-3 py-2 h-auto"
                              onClick={() => toggleCategory(category)}
                            >
                              <div className="flex items-center gap-2">
                                <span className={cn('px-2 py-0.5 rounded-md text-xs font-semibold', getCategoryColor(category))}>{category}</span>
                                <span className="text-xs text-muted-foreground">{filteredEvents.length} {t('webhooks.events')}</span>
                                {filteredEvents.every((e) => selectedEvents.has(e.code)) && filteredEvents.length > 0 && (
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs text-muted-foreground hover:text-primary h-auto py-0 px-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    selectAllInCategory(category, filteredEvents);
                                  }}
                                >
                                  {filteredEvents.every((e) => selectedEvents.has(e.code)) ? t('webhooks.removeAll') : t('webhooks.all')}
                                </Button>
                                {expandedCategories.has(category) ? (
                                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                                ) : (
                                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                )}
                              </div>
                            </Button>
                            <AnimatePresence>
                              {expandedCategories.has(category) && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.15 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-3 pb-2 space-y-1">
                                    {filteredEvents.map((ev) => (
                                      <label
                                        key={ev.code}
                                        className="flex items-start gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group"
                                      >
                                        <div
                                          className={cn(
                                            'w-4 h-4 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-colors',
                                            selectedEvents.has(ev.code) ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                                          )}
                                        >
                                          {selectedEvents.has(ev.code) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                                        </div>
                                        <input
                                          type="checkbox"
                                          className="hidden"
                                          checked={selectedEvents.has(ev.code)}
                                          onChange={() => toggleEvent(ev.code)}
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="text-xs font-mono font-medium">{ev.code}</div>
                                          <div className="text-xs text-muted-foreground mt-0.5 truncate">{ev.description}</div>
                                        </div>
                                      </label>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="gap-4 pt-6">
              <Button type="button" variant="outline" onClick={closeWebhookModal} className="flex-1">
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isWebhookSubmitting} className="flex-1 gap-2">
                {isWebhookSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isWebhookSubmitting
                  ? (editingWebhook ? t('webhooks.updating') : t('webhooks.creating'))
                  : (editingWebhook ? t('webhooks.updateWebhook') : t('webhooks.createWebhook'))}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
