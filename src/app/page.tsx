'use client';

import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Layers, Users, Settings, Plus, Search, Bell,
  Info, Loader2, Key, Eye, EyeOff, CheckCircle2, ShieldCheck,
  Webhook, ChevronDown, ChevronRight, Zap, Globe, Lock, RotateCcw,
  Server, RefreshCw, AlertCircle, Puzzle, Shield, FileCheck, Link2,
  MoreVertical, ChevronLeft, Mail
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn, apiUrl } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';

// ─── Types ────────────────────────────────────────────────────────
interface App {
  id: string;
  name: string;
  created_at: string;
}

interface LoginMethodDetails {
  id: string;
  email?: string;
  app_id?: string;
  created_at?: string;
}

interface LoginMethod {
  id: string;
  entity_type: string;
  entity_id: string;
  is_verify: boolean;
  user_id: string;
  details?: LoginMethodDetails;
}

interface RoleDetails {
  id: string;
  name: string;
  description: string;
}

interface User {
  id: string;
  name: string;
  user_name: string;
  app_id: string;
  role_id: string;
  created_at: string;
  updated_at: string;
  role_details?: RoleDetails;
  login_methods?: LoginMethod[];
}

interface WebhookItem {
  id: string;
  name: string;
  description?: string;
  url: string;
  secret: string;
  events: string[];
  active: boolean;
  retries: number;
  app_id: string;
  created_at: string;
  updated_at: string;
}

interface WebhookEvent {
  code: string;
  description: string;
  category: string;
}

interface EventsByCategory {
  [category: string]: WebhookEvent[];
}

interface EnvVar {
  key: string;
  value: string;
  sensitive: boolean;
  category: string;
}

interface AppBehavior {
  id: string;
  app_id: string;
  behavior_code: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AppBehaviorDetail extends AppBehavior {
  config: Record<string, any>;
  created_by: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  app_id: string;
  created_at: string;
  updated_at: string;
}

interface Policy {
  id: string;
  name: string;
  description: string;
  resource: string;
  action: string;
  effect: string;
  app_id: string;
  created_at: string;
  updated_at: string;
}

// ─── Component ───────────────────────────────────────────────────
export default function AdminDashboard() {
  const [activeView, setActiveView] = useState('dashboard');
  const [apps, setApps] = useState<App[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [webhooks, setWebhooks] = useState<WebhookItem[]>([]);
  const [behaviors, setBehaviors] = useState<AppBehavior[]>([]);
  const [selectedBehavior, setSelectedBehavior] = useState<AppBehaviorDetail | null>(null);
  const [isBehaviorModalOpen, setIsBehaviorModalOpen] = useState(false);
  const [eventsByCategory, setEventsByCategory] = useState<EventsByCategory>({});
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWebhookModalOpen, setIsWebhookModalOpen] = useState(false);

  // Config
  const [secretApiKey, setSecretApiKey] = useState('');
  const [savedSecretKey, setSavedSecretKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [keySaved, setKeySaved] = useState(false);

  // Admin Key
  const [adminApiKey, setAdminApiKey] = useState('');
  const [savedAdminKey, setSavedAdminKey] = useState('');
  const [showAdminKey, setShowAdminKey] = useState(false);
  const [adminKeySaved, setAdminKeySaved] = useState(false);

  // Env vars
  const [envVars, setEnvVars] = useState<EnvVar[]>([]);
  const [envLoading, setEnvLoading] = useState(false);
  const [envError, setEnvError] = useState('');
  const [showSensitiveValues, setShowSensitiveValues] = useState<Record<string, boolean>>({});
  const [hasRevealedEnvVars, setHasRevealedEnvVars] = useState(false);

  // App form
  const [formData, setFormData] = useState({ name: '', root_email: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdAppResponse, setCreatedAppResponse] = useState<Record<string, unknown> | null>(null);

  // Webhook form
  const [webhookForm, setWebhookForm] = useState({
    name: '', description: '', url: '', secret: '', retries: 3, active: true,
  });
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [isWebhookSubmitting, setIsWebhookSubmitting] = useState(false);
  const [expandedWebhook, setExpandedWebhook] = useState<string | null>(null);

  // Roles & Policies
  const [roles, setRoles] = useState<Role[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [rolePoliciesInfo, setRolePoliciesInfo] = useState<{ role: Role; policies: Policy[] } | null>(null);
  const [selectedRoleForPolicies, setSelectedRoleForPolicies] = useState<string | null>(null);
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isRolePoliciesModalOpen, setIsRolePoliciesModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ name: '', description: '' });
  const [policyForm, setPolicyForm] = useState({ name: '', description: '', resource: '', action: '', effect: 'allow' as string });
  const [assignForm, setAssignForm] = useState({ role_id: '', policy_id: '' });
  const [isRoleSubmitting, setIsRoleSubmitting] = useState(false);
  const [isPolicySubmitting, setIsPolicySubmitting] = useState(false);
  const [isAssignSubmitting, setIsAssignSubmitting] = useState(false);

  // ─── Notifications ──────────────────────────────────────────────
  const showNotification = (message: string, type: 'success' | 'error') => {
    if (type === 'success') toast.success(message);
    else toast.error(message);
  };

  // ─── Init ───────────────────────────────────────────────────────
  useEffect(() => {
    const stored = localStorage.getItem('authify_secret_key');
    if (stored) { setSavedSecretKey(stored); setSecretApiKey(stored); setKeySaved(true); }
    const storedAdmin = localStorage.getItem('authify_admin_key');
    if (storedAdmin) { setSavedAdminKey(storedAdmin); setAdminApiKey(storedAdmin); setAdminKeySaved(true); }
    fetchApps();
    fetchAvailableEvents();
  }, []);

  // ─── Key helpers ────────────────────────────────────────────────
  const handleSaveKey = () => {
    if (!secretApiKey.trim()) { showNotification('La Secret API Key no puede estar vacía', 'error'); return; }
    localStorage.setItem('authify_secret_key', secretApiKey.trim());
    setSavedSecretKey(secretApiKey.trim());
    setKeySaved(true);
    showNotification('Secret API Key guardada correctamente', 'success');
  };
  const handleClearKey = () => {
    localStorage.removeItem('authify_secret_key');
    setSavedSecretKey(''); setSecretApiKey(''); setKeySaved(false);
    showNotification('Secret API Key eliminada', 'success');
  };

  const handleSaveAdminKey = () => {
    if (!adminApiKey.trim()) { showNotification('El Admin API Key no puede estar vacío', 'error'); return; }
    localStorage.setItem('authify_admin_key', adminApiKey.trim());
    setSavedAdminKey(adminApiKey.trim());
    setAdminKeySaved(true);
    showNotification('Admin API Key guardado correctamente', 'success');
  };
  const handleClearAdminKey = () => {
    localStorage.removeItem('authify_admin_key');
    setSavedAdminKey(''); setAdminApiKey(''); setAdminKeySaved(false);
    setEnvVars([]);
    showNotification('Admin API Key eliminado', 'success');
  };

  const fetchEnvVars = async (revealSensitive = false) => {
    if (!savedAdminKey) { showNotification('Configura el Admin API Key primero', 'error'); return; }
    setEnvLoading(true);
    setEnvError('');
    try {
      const url = revealSensitive ? apiUrl('/api/system/env?reveal_sensitive=1') : apiUrl('/api/system/env');
      const res = await fetch(url, {
        headers: { 'X-Admin-API-Key': savedAdminKey },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setEnvVars(data.data);
        if (revealSensitive) setHasRevealedEnvVars(true);
        else { setHasRevealedEnvVars(false); setShowSensitiveValues({}); }
        if (!revealSensitive) showNotification(`${data.data.length} variables cargadas`, 'success');
      } else {
        setEnvError(data.error?.message || 'Error al cargar variables de entorno');
      }
    } catch {
      setEnvError('Error de conexión con el servidor');
    } finally {
      setEnvLoading(false);
    }
  };

  const handleToggleSensitive = async (key: string) => {
    const willShow = !showSensitiveValues[key];
    if (willShow && !hasRevealedEnvVars) {
      if (!savedAdminKey) return;
      setEnvLoading(true);
      setEnvError('');
      try {
        const res = await fetch(apiUrl('/api/system/env?reveal_sensitive=1'), {
          headers: { 'X-Admin-API-Key': savedAdminKey },
        });
        const data = await res.json();
        if (data.success && data.data) {
          setEnvVars(data.data);
          setHasRevealedEnvVars(true);
          setShowSensitiveValues(prev => ({ ...prev, [key]: true }));
        } else {
          showNotification(data.error?.message || 'Error al cargar valores', 'error');
        }
      } catch {
        showNotification('Error de conexión', 'error');
      } finally {
        setEnvLoading(false);
      }
    } else {
      setShowSensitiveValues(prev => ({ ...prev, [key]: willShow }));
    }
  };
  const truncateKey = (key: string) => {
    if (!key || key.length <= 20) return key;
    return key.slice(0, 12) + '••••••••••••' + key.slice(-8);
  };

  // ─── Fetch helpers ──────────────────────────────────────────────
  const fetchApps = async () => {
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/apps'));
      const data = await res.json();
      if (data.success) setApps(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar apps', 'error');
    } catch { showNotification('Error de conexión con la API de Apps', 'error'); }
    finally { setLoading(false); }
  };

  const fetchUsers = async () => {
    if (!savedSecretKey) { showNotification('Configura tu Secret API Key primero', 'error'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/users'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setUsers(data.data || []);
      else showNotification(data.error?.message || data.errors?.[0] || 'Error al cargar usuarios', 'error');
    } catch { showNotification('Error de conexión con la API de Usuarios', 'error'); }
    finally { setLoading(false); }
  };

  const fetchWebhooks = async () => {
    if (!savedSecretKey) { showNotification('Configura tu Secret API Key primero', 'error'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/webhooks'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setWebhooks(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar webhooks', 'error');
    } catch { showNotification('Error de conexión con la API de Webhooks', 'error'); }
    finally { setLoading(false); }
  };

  const fetchBehaviors = async () => {
    if (!savedSecretKey) { showNotification('Configura tu Secret API Key primero', 'error'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/behaviors'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) setBehaviors(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar behaviors', 'error');
    } catch { showNotification('Error de conexión con la API de Behaviors', 'error'); }
    finally { setLoading(false); }
  };

  const fetchBehaviorDetails = async (id: string) => {
    if (!savedSecretKey) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/behaviors/${id}`), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.success) {
        setSelectedBehavior(data.data);
        setIsBehaviorModalOpen(true);
      } else {
        showNotification(data.error?.message || 'Error al cargar detalles', 'error');
      }
    } catch {
      showNotification('Error al contactar el servidor', 'error');
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
        // Expandir primera categoría por defecto
        const firstCat = Object.keys(data.data)[0];
        if (firstCat) setExpandedCategories(new Set([firstCat]));
      }
    } catch { /* silent */ }
  };

  const fetchRoles = async () => {
    if (!savedSecretKey) { showNotification('Configura tu Secret API Key primero', 'error'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/roles'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setRoles(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar roles', 'error');
    } catch { showNotification('Error al conectar con la API de Roles', 'error'); }
    finally { setLoading(false); }
  };

  const fetchPolicies = async () => {
    if (!savedSecretKey) { showNotification('Configura tu Secret API Key primero', 'error'); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/policies'), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) setPolicies(data.data || []);
      else showNotification(data.error?.message || 'Error al cargar políticas', 'error');
    } catch { showNotification('Error al conectar con la API de Políticas', 'error'); }
    finally { setLoading(false); }
  };

  const fetchRolePolicies = async (roleId: string) => {
    if (!savedSecretKey) return;
    setLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/role-policies/${roleId}`), { headers: { 'X-Secret-API-Key': savedSecretKey } });
      const data = await res.json();
      if (data.data && (data.status === 200 || data.success)) {
        setRolePoliciesInfo(data.data);
        setSelectedRoleForPolicies(roleId);
        setAssignForm(prev => ({ ...prev, role_id: roleId }));
        setIsRolePoliciesModalOpen(true);
      } else showNotification(data.error?.message || 'Error al cargar políticas del rol', 'error');
    } catch { showNotification('Error al conectar con el servidor', 'error'); }
    finally { setLoading(false); }
  };

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRoleSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/roles'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(roleForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification('Rol creado con éxito', 'success');
        setIsRoleModalOpen(false);
        setRoleForm({ name: '', description: '' });
        fetchRoles();
      } else showNotification(data.error?.message || 'Error al crear rol', 'error');
    } catch { showNotification('Error al contactar el servidor', 'error'); }
    finally { setIsRoleSubmitting(false); }
  };

  const handleCreatePolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPolicySubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/policies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(policyForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification('Política creada con éxito', 'success');
        setIsPolicyModalOpen(false);
        setPolicyForm({ name: '', description: '', resource: '', action: '', effect: 'allow' });
        fetchPolicies();
      } else showNotification(data.error?.message || 'Error al crear política', 'error');
    } catch { showNotification('Error al contactar el servidor', 'error'); }
    finally { setIsPolicySubmitting(false); }
  };

  const handleAssignPolicy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignForm.role_id || !assignForm.policy_id) {
      showNotification('Selecciona rol y política', 'error');
      return;
    }
    setIsAssignSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/role-policies'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify(assignForm),
      });
      const data = await res.json();
      if (data.data || data.success) {
        showNotification('Política asignada al rol correctamente', 'success');
        setAssignForm(prev => ({ ...prev, policy_id: '' }));
        if (selectedRoleForPolicies) fetchRolePolicies(selectedRoleForPolicies);
      } else showNotification(data.error?.message || 'Error al asignar política', 'error');
    } catch { showNotification('Error al contactar el servidor', 'error'); }
    finally { setIsAssignSubmitting(false); }
  };

  // ─── App create ─────────────────────────────────────────────────
  const handleCreateApp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setCreatedAppResponse(null);
    try {
      const res = await fetch(apiUrl('/api/apps'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Aplicación creada con éxito', 'success');
        setCreatedAppResponse(data);
        fetchApps();
        // Auto-guardar secret_key en config para no tener que actualizarlo manualmente
        const secretKey = data.data?.secret_key;
        if (secretKey && typeof secretKey === 'string') {
          localStorage.setItem('authify_secret_key', secretKey.trim());
          setSavedSecretKey(secretKey.trim());
          setSecretApiKey(secretKey.trim());
          setKeySaved(true);
          showNotification('Secret API Key guardada automáticamente en Configuración', 'success');
        }
      } else showNotification(data.error?.message || 'Error al crear', 'error');
    } catch { showNotification('Error al contactar el servidor', 'error'); }
    finally { setIsSubmitting(false); }
  };

  const closeAppModal = () => {
    setIsModalOpen(false);
    setFormData({ name: '', root_email: '' });
    setCreatedAppResponse(null);
  };

  // ─── Webhook create ─────────────────────────────────────────────
  const handleCreateWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedEvents.size === 0) { showNotification('Debes seleccionar al menos un evento', 'error'); return; }
    setIsWebhookSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/webhooks'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Secret-API-Key': savedSecretKey },
        body: JSON.stringify({ ...webhookForm, events: Array.from(selectedEvents) }),
      });
      const data = await res.json();
      if (data.success) {
        showNotification('Webhook creado con éxito', 'success');
        setIsWebhookModalOpen(false);
        setWebhookForm({ name: '', description: '', url: '', secret: '', retries: 3, active: true });
        setSelectedEvents(new Set());
        fetchWebhooks();
      } else showNotification(data.error?.message || 'Error al crear webhook', 'error');
    } catch { showNotification('Error al contactar el servidor', 'error'); }
    finally { setIsWebhookSubmitting(false); }
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

  const selectAllInCategory = (category: string) => {
    const events = eventsByCategory[category] || [];
    const next = new Set(selectedEvents);
    const allSelected = events.every(e => next.has(e.code));
    events.forEach(e => allSelected ? next.delete(e.code) : next.add(e.code));
    setSelectedEvents(next);
  };

  // ─── Category color map ─────────────────────────────────────────
  const categoryColor: Record<string, string> = {
    'User': 'text-indigo-400 bg-indigo-500/10',
    'Auth': 'text-sky-400 bg-sky-500/10',
    'Session': 'text-purple-400 bg-purple-500/10',
    'Code': 'text-amber-400 bg-amber-500/10',
    'Role & Policy': 'text-emerald-400 bg-emerald-500/10',
    'OAuth': 'text-orange-400 bg-orange-500/10',
    'API Key / App': 'text-pink-400 bg-pink-500/10',
    'Security': 'text-rose-400 bg-rose-500/10',
  };
  const getCategoryColor = (cat: string) => categoryColor[cat] || 'text-muted-foreground bg-muted';

  // ─── Sidebar nav ────────────────────────────────────────────────
  const navItems = [
    { id: 'dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { id: 'apps', icon: Layers, label: 'Aplicaciones' },
    { id: 'users', icon: Users, label: 'Usuarios' },
    { id: 'roles_policies', icon: Shield, label: 'Roles y Políticas' },
    { id: 'webhooks', icon: Webhook, label: 'Webhooks' },
    { id: 'behaviors', icon: Puzzle, label: 'Behaviors' },
    { id: 'settings', icon: Settings, label: 'Configuración' },
  ];

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden font-sans">

      {/* ── Sidebar ── */}
      <aside className="w-64 bg-card border-r border-border flex flex-col z-20 shrink-0">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center font-bold text-primary-foreground text-sm">A</div>
            <div>
              <span className="text-xl font-bold tracking-tight">Authify Admin</span>
              <div className="mt-1">
                <Badge variant="secondary" className="text-[10px] font-medium px-1.5 py-0">API Accounts · Community</Badge>
              </div>
            </div>
          </div>
        </div>
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              className={cn(
                "w-full justify-start gap-3 px-4 py-3 rounded-xl h-auto font-normal",
                (activeView === item.id || (item.id === 'users' && activeView === 'user_detail')) && "bg-primary/10 text-primary font-semibold"
              )}
              onClick={() => {
                setActiveView(item.id);
                if (item.id === 'users') setSelectedUser(null);
                if (item.id === 'apps') fetchApps();
                if (item.id === 'users') fetchUsers();
                if (item.id === 'roles_policies') { fetchRoles(); fetchPolicies(); }
                if (item.id === 'webhooks') fetchWebhooks();
                if (item.id === 'behaviors') fetchBehaviors();
                if (item.id === 'dashboard') fetchApps();
              }}
            >
              <item.icon className="w-4 h-4 shrink-0" />
              <span>{item.label}</span>
              {(item.id === 'users' || item.id === 'webhooks' || item.id === 'behaviors' || item.id === 'roles_policies') && !savedSecretKey && (
                <span className="ml-auto w-2 h-2 rounded-full bg-amber-400" />
              )}
            </Button>
          ))}
        </nav>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Header */}
        <header className="h-20 border-b border-border flex items-center justify-between px-8 bg-background/80 backdrop-blur-md sticky top-0 z-10 shrink-0">
          <div className="max-w-sm w-full relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input type="text" placeholder="Buscar..." className="pl-10 rounded-xl" />
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="rounded-xl">
              <Bell className="w-5 h-5" />
            </Button>
            {activeView === 'webhooks' && savedSecretKey ? (
              <Button onClick={() => setIsWebhookModalOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Nuevo Webhook
              </Button>
            ) : (
              <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> Nuevo
              </Button>
            )}
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto w-full space-y-0">

          {/* ── DASHBOARD ── */}
          {activeView === 'dashboard' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center gap-3 mb-8">
                <h1 className="text-3xl font-bold">Dashboard</h1>
                <Badge variant="outline" className="text-xs font-normal text-muted-foreground">API Accounts · Community</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
                {[
                  { icon: Layers, label: 'Aplicaciones', value: apps.length },
                  { icon: Users, label: 'Usuarios', value: users.length },
                  { icon: Webhook, label: 'Webhooks', value: webhooks.length },
                  { icon: Puzzle, label: 'Behaviors', value: behaviors.length },
                ].map(card => (
                  <Card key={card.label} className="p-6">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
                      <card.icon className="w-6 h-6" />
                    </div>
                    <div className="text-muted-foreground text-sm font-medium">{card.label}</div>
                    <div className="text-3xl font-bold mt-1">{loading ? '…' : card.value}</div>
                  </Card>
                ))}
              </div>
              <Card>
                <CardHeader className="flex-row items-center justify-between">
                  <CardTitle>Aplicaciones Recientes</CardTitle>
                  <Button variant="link" className="text-primary p-0 h-auto" onClick={() => setActiveView('apps')}>Ver todas →</Button>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-border">
                    {loading ? (
                      <div className="py-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                    ) : apps.length === 0 ? (
                      <div className="py-16 text-center text-muted-foreground text-sm">No hay aplicaciones aún</div>
                    ) : apps.slice(0, 5).map(app => (
                      <div key={app.id} className="px-6 py-4 hover:bg-muted/50 transition-colors flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-muted-foreground font-bold">{app.name.charAt(0).toUpperCase()}</div>
                          <div>
                            <div className="font-semibold">{app.name}</div>
                            <div className="text-xs text-muted-foreground font-mono mt-0.5">{app.id}</div>
                          </div>
                        </div>
                        <Badge variant="secondary">Activo</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── APPS ── */}
          {activeView === 'apps' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold mb-8">Aplicaciones</h1>
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow className="border-b">
                      <TableHead className="px-8 py-4">Nombre</TableHead>
                      <TableHead className="px-8 py-4">ID</TableHead>
                      <TableHead className="px-8 py-4">Creado</TableHead>
                      <TableHead className="px-8 py-4">Estado</TableHead>
                      <TableHead className="px-8 py-4 text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={5} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                    ) : apps.length === 0 ? (
                      <TableRow><TableCell colSpan={5} className="py-16 text-center text-muted-foreground text-sm">No hay aplicaciones registradas</TableCell></TableRow>
                    ) : apps.map(app => (
                      <TableRow key={app.id} className="group">
                        <TableCell className="px-8 py-4 font-semibold">{app.name}</TableCell>
                        <TableCell className="px-8 py-4 text-xs font-mono text-muted-foreground">{app.id}</TableCell>
                        <TableCell className="px-8 py-4 text-muted-foreground text-sm">{new Date(app.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="px-8 py-4"><Badge variant="secondary">Activo</Badge></TableCell>
                        <TableCell className="px-8 py-4 text-right"><Button variant="ghost" size="icon"><Info className="w-4 h-4" /></Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ── USERS (Firebase-style) ── */}
          {activeView === 'users' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Usuarios</h1>
                {!savedSecretKey && (
                  <Button variant="outline" onClick={() => setActiveView('settings')} className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                    <Key className="w-4 h-4" /> Configura tu Secret API Key
                  </Button>
                )}
              </div>
              {!savedSecretKey ? (
                <Card className="border-amber-500/20 p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4"><Key className="w-8 h-8 text-amber-400" /></div>
                  <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
                  <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración.</CardDescription>
                  <Button onClick={() => setActiveView('settings')}>Ir a Configuración</Button>
                </Card>
              ) : (
                <Card className="overflow-hidden">
                  <div className="px-6 py-3 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center gap-2 text-xs text-emerald-400">
                    <ShieldCheck className="w-4 h-4 shrink-0" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
                  </div>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-b hover:bg-transparent">
                          <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Usuario</TableHead>
                          <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Provider</TableHead>
                          <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Rol</TableHead>
                          <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Creado</TableHead>
                          <TableHead className="px-6 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Última actividad</TableHead>
                          <TableHead className="px-6 py-3 w-12" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {loading ? (
                          <TableRow><TableCell colSpan={6} className="py-20 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-muted-foreground" /></TableCell></TableRow>
                        ) : users.length === 0 ? (
                          <TableRow><TableCell colSpan={6} className="py-16 text-center text-muted-foreground text-sm">No hay usuarios registrados</TableCell></TableRow>
                        ) : users.map(user => {
                            const primaryEmail = user.login_methods?.find(lm => lm.entity_type === 'email')?.details?.email;
                            const displayName = user.name || user.user_name || primaryEmail || 'Sin nombre';
                            return (
                              <TableRow
                                key={user.id}
                                className="group cursor-pointer hover:bg-muted/50 transition-colors"
                                onClick={() => { setSelectedUser(user); setActiveView('user_detail'); }}
                              >
                                <TableCell className="px-6 py-3">
                                  <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs shrink-0">
                                      {(displayName || 'U').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-mono text-xs text-muted-foreground truncate max-w-[140px]" title={user.id}>{user.id}</div>
                                      <div className="font-medium text-sm truncate">{primaryEmail || user.user_name || '—'}</div>
                                      {displayName !== primaryEmail && displayName !== user.user_name && (
                                        <div className="text-xs text-muted-foreground truncate">{displayName}</div>
                                      )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-3">
                                  <div className="flex flex-wrap gap-1">
                                    {user.login_methods?.map(lm => (
                                      <Badge key={lm.id} variant="outline" className={cn(
                                        "text-[10px] px-1.5 py-0 font-medium",
                                        lm.entity_type === 'email' ? "border-sky-500/40 text-sky-400 bg-sky-500/5" : "border-orange-500/40 text-orange-400 bg-orange-500/5"
                                      )}>
                                        {lm.entity_type}
                                        {lm.is_verify && <CheckCircle2 className="w-2.5 h-2.5 ml-0.5 text-emerald-400 inline" />}
                                      </Badge>
                                    )) || <span className="text-muted-foreground text-xs">—</span>}
                                  </div>
                                </TableCell>
                                <TableCell className="px-6 py-3">
                                  {user.role_details ? (
                                    <Badge variant="secondary" className="text-xs font-normal">{user.role_details.name}</Badge>
                                  ) : <span className="text-muted-foreground text-xs">—</span>}
                                </TableCell>
                                <TableCell className="px-6 py-3 text-xs text-muted-foreground">
                                  {new Date(user.created_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </TableCell>
                                <TableCell className="px-6 py-3 text-xs text-muted-foreground">
                                  {new Date(user.updated_at).toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </TableCell>
                                <TableCell className="px-6 py-3" onClick={e => e.stopPropagation()}>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => { setSelectedUser(user); setActiveView('user_detail'); }}>
                                    <MoreVertical className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* ── USER DETAIL ── */}
          {activeView === 'user_detail' && selectedUser && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <Button variant="ghost" onClick={() => { setSelectedUser(null); setActiveView('users'); }} className="mb-6 gap-2 -ml-2">
                <ChevronLeft className="w-4 h-4" /> Volver a usuarios
              </Button>
              <div className="space-y-6">
                <Card className="overflow-hidden">
                  <div className="p-6 flex items-start gap-6">
                    <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-2xl shrink-0">
                      {(selectedUser.name || selectedUser.user_name || 'U').charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h1 className="text-2xl font-bold">{selectedUser.name || selectedUser.user_name || 'Sin nombre'}</h1>
                      <p className="text-muted-foreground font-mono text-sm mt-1">{selectedUser.id}</p>
                      {selectedUser.role_details && (
                        <Badge variant="secondary" className="mt-2">{selectedUser.role_details.name}</Badge>
                      )}
                    </div>
                  </div>
                </Card>

                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="p-6">
                    <CardTitle className="text-base mb-4 flex items-center gap-2">
                      <Shield className="w-4 h-4" /> Información general
                    </CardTitle>
                    <dl className="space-y-3 text-sm">
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">User ID</dt>
                        <dd className="font-mono text-xs truncate max-w-[200px]" title={selectedUser.id}>{selectedUser.id}</dd>
                      </div>
                      <Separator />
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Nombre</dt>
                        <dd>{selectedUser.name || '—'}</dd>
                      </div>
                      <Separator />
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">User name</dt>
                        <dd>{selectedUser.user_name || '—'}</dd>
                      </div>
                      <Separator />
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">App ID</dt>
                        <dd className="font-mono text-xs truncate max-w-[200px]" title={selectedUser.app_id}>{selectedUser.app_id}</dd>
                      </div>
                      <Separator />
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Rol</dt>
                        <dd>{selectedUser.role_details?.name || '—'}</dd>
                      </div>
                      <Separator />
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Creado</dt>
                        <dd>{new Date(selectedUser.created_at).toLocaleString('es')}</dd>
                      </div>
                      <Separator />
                      <div className="flex justify-between gap-4">
                        <dt className="text-muted-foreground">Última actividad</dt>
                        <dd>{new Date(selectedUser.updated_at).toLocaleString('es')}</dd>
                      </div>
                    </dl>
                  </Card>

                  <Card className="p-6">
                    <CardTitle className="text-base mb-4 flex items-center gap-2">
                      <Mail className="w-4 h-4" /> Métodos de login
                    </CardTitle>
                    {selectedUser.login_methods && selectedUser.login_methods.length > 0 ? (
                      <div className="space-y-4">
                        {selectedUser.login_methods.map(lm => (
                          <div key={lm.id} className="p-3 rounded-lg border border-border bg-muted/30">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline" className={cn(
                                lm.entity_type === 'email' ? "border-sky-500/40 text-sky-400" : "border-orange-500/40 text-orange-400"
                              )}>
                                {lm.entity_type}
                              </Badge>
                              {lm.is_verify && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                            </div>
                            <dl className="space-y-1 text-xs">
                              <div className="flex gap-2">
                                <dt className="text-muted-foreground shrink-0">ID:</dt>
                                <dd className="font-mono truncate">{lm.entity_id}</dd>
                              </div>
                              {lm.details?.email && (
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground shrink-0">Email:</dt>
                                  <dd className="truncate">{lm.details.email}</dd>
                                </div>
                              )}
                              {lm.details?.created_at && (
                                <div className="flex gap-2">
                                  <dt className="text-muted-foreground shrink-0">Creado:</dt>
                                  <dd>{new Date(lm.details.created_at).toLocaleString('es')}</dd>
                                </div>
                              )}
                            </dl>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">No hay métodos de login registrados</p>
                    )}
                  </Card>
                </div>
              </div>
            </motion.div>
          )}

          {/* ── ROLES Y POLÍTICAS ── */}
          {activeView === 'roles_policies' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold">Roles y Políticas</h1>
                  <p className="text-muted-foreground text-sm mt-1">Gestiona roles, políticas de autorización y su asignación.</p>
                </div>
                {!savedSecretKey ? (
                  <Button variant="outline" onClick={() => setActiveView('settings')} className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                    <Key className="w-4 h-4" /> Configura tu Secret API Key
                  </Button>
                ) : (
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsRoleModalOpen(true)} className="gap-2">
                      <Shield className="w-4 h-4" /> Nuevo Rol
                    </Button>
                    <Button variant="outline" onClick={() => setIsPolicyModalOpen(true)} className="gap-2">
                      <FileCheck className="w-4 h-4" /> Nueva Política
                    </Button>
                  </div>
                )}
              </div>

              {!savedSecretKey ? (
                <Card className="border-amber-500/20 p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4"><Key className="w-8 h-8 text-amber-400" /></div>
                  <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
                  <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración para gestionar roles y políticas.</CardDescription>
                  <Button onClick={() => setActiveView('settings')}>Ir a Configuración</Button>
                </Card>
              ) : (
                <div className="space-y-8">
                  <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
                    <ShieldCheck className="w-4 h-4" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Roles */}
                    <Card>
                      <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Shield className="w-5 h-5 text-primary" />
                          Roles
                        </CardTitle>
                        <Button size="sm" variant="outline" onClick={() => setIsRoleModalOpen(true)} className="gap-1">
                          <Plus className="w-4 h-4" /> Crear
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                        ) : roles.length === 0 ? (
                          <div className="py-12 text-center text-muted-foreground text-sm">No hay roles. Crea uno para empezar.</div>
                        ) : (
                          <div className="space-y-2">
                            {roles.map(role => (
                              <div key={role.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div>
                                  <div className="font-semibold">{role.name}</div>
                                  {role.description && <div className="text-xs text-muted-foreground mt-0.5">{role.description}</div>}
                                </div>
                                <Button variant="ghost" size="sm" className="gap-1" onClick={() => fetchRolePolicies(role.id)}>
                                  <Link2 className="w-4 h-4" /> Políticas
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>

                    {/* Políticas */}
                    <Card>
                      <CardHeader className="flex-row items-center justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <FileCheck className="w-5 h-5 text-primary" />
                          Políticas
                        </CardTitle>
                        <Button size="sm" variant="outline" onClick={() => setIsPolicyModalOpen(true)} className="gap-1">
                          <Plus className="w-4 h-4" /> Crear
                        </Button>
                      </CardHeader>
                      <CardContent>
                        {loading ? (
                          <div className="py-12 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                        ) : policies.length === 0 ? (
                          <div className="py-12 text-center text-muted-foreground text-sm">No hay políticas. Crea una para empezar.</div>
                        ) : (
                          <div className="space-y-2">
                            {policies.map(policy => (
                              <div key={policy.id} className="p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                                <div className="flex items-center justify-between">
                                  <div className="font-semibold text-sm">{policy.name}</div>
                                  <Badge variant={policy.effect === 'allow' ? 'secondary' : 'destructive'} className="text-xs">
                                    {policy.effect}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 font-mono">
                                  {policy.resource} → {policy.action}
                                </div>
                                {policy.description && <div className="text-xs text-muted-foreground mt-0.5">{policy.description}</div>}
                              </div>
                            ))}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ── WEBHOOKS ── */}
          {activeView === 'webhooks' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold">Webhooks</h1>
                  <p className="text-muted-foreground text-sm mt-1">Recibe notificaciones en tiempo real cuando ocurran eventos en tu app.</p>
                </div>
                {!savedSecretKey && (
                  <Button variant="outline" onClick={() => setActiveView('settings')} className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                    <Key className="w-4 h-4" /> Configura tu Secret API Key
                  </Button>
                )}
              </div>

              {!savedSecretKey ? (
                <Card className="border-amber-500/20 p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4"><Key className="w-8 h-8 text-amber-400" /></div>
                  <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
                  <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración para gestionar webhooks.</CardDescription>
                  <Button onClick={() => setActiveView('settings')}>Ir a Configuración</Button>
                </Card>
              ) : loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-4">
                  {/* Key activa */}
                  <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
                    <ShieldCheck className="w-4 h-4" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
                  </div>

                  {webhooks.length === 0 ? (
                    <Card className="border-dashed p-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4"><Webhook className="w-8 h-8 text-primary" /></div>
                      <CardTitle className="mb-2">Sin webhooks</CardTitle>
                      <CardDescription className="mb-6">Crea tu primer webhook para recibir eventos de tu app.</CardDescription>
                      <Button onClick={() => setIsWebhookModalOpen(true)} className="gap-2">
                        <Plus className="w-4 h-4" /> Crear Webhook
                      </Button>
                    </Card>
                  ) : (
                    <div className="space-y-3">
                      {webhooks.map(wh => (
                        <Card key={wh.id} className="overflow-hidden">
                          {/* Row principal */}
                          <Button
                            variant="ghost"
                            className="w-full justify-start px-6 py-5 h-auto flex items-center gap-4 hover:bg-muted/50 transition-colors"
                            onClick={() => setExpandedWebhook(expandedWebhook === wh.id ? null : wh.id)}
                          >
                            <div className={cn("w-3 h-3 rounded-full shrink-0", wh.active ? "bg-emerald-400" : "bg-slate-600")} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3">
                                <span className="font-semibold">{wh.name}</span>
                                {wh.active
                                  ? <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-0">Activo</Badge>
                                  : <Badge variant="secondary" className="bg-muted text-muted-foreground">Inactivo</Badge>
                                }
                              </div>
                              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                                <Globe className="w-3 h-3" /> <span className="truncate max-w-xs">{wh.url}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 shrink-0 text-xs text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Zap className="w-3.5 h-3.5" /> {wh.events.length} eventos
                              </div>
                              <div className="flex items-center gap-1">
                                <RotateCcw className="w-3.5 h-3.5" /> {wh.retries} reintentos
                              </div>
                              <div className="text-muted-foreground">{new Date(wh.created_at).toLocaleDateString()}</div>
                            </div>
                            {expandedWebhook === wh.id
                              ? <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform shrink-0" />
                              : <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform shrink-0" />
                            }
                          </Button>

                          {/* Expandido */}
                          <AnimatePresence>
                            {expandedWebhook === wh.id && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden border-t border-border"
                              >
                                <div className="px-6 py-5 grid grid-cols-2 gap-6">
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Detalles</h4>
                                    <div className="space-y-2 text-sm">
                                      {wh.description && <p className="text-foreground">{wh.description}</p>}
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Lock className="w-3.5 h-3.5" />
                                        <span className="font-mono text-xs">{wh.secret.slice(0, 6)}{'•'.repeat(8)}</span>
                                        <span className="text-muted-foreground text-xs">secret hash</span>
                                      </div>
                                      <div className="text-xs text-muted-foreground font-mono">ID: {wh.id}</div>
                                    </div>
                                  </div>
                                  <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Eventos suscritos ({wh.events.length})</h4>
                                    <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                                      {wh.events.map(ev => {
                                        const cat = ev.split('.')[1] || '';
                                        const colorKey = Object.keys(categoryColor).find(k => k.toLowerCase().includes(cat.toLowerCase())) || '';
                                        const color = categoryColor[colorKey] || 'text-muted-foreground bg-muted';
                                        return (
                                          <span key={ev} className={cn("px-2 py-0.5 rounded-md text-xs font-mono font-medium", color)}>
                                            {ev}
                                          </span>
                                        );
                                      })}
                                    </div>
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
          )}

          {/* ── BEHAVIORS ── */}
          {activeView === 'behaviors' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h1 className="text-3xl font-bold">Behaviors</h1>
                  <p className="text-muted-foreground text-sm mt-1">Comportamientos activos en tu aplicación.</p>
                </div>
                {!savedSecretKey && (
                  <Button variant="outline" onClick={() => setActiveView('settings')} className="gap-2 border-amber-500/20 text-amber-500 hover:bg-amber-500/10">
                    <Key className="w-4 h-4" /> Configura tu Secret API Key
                  </Button>
                )}
              </div>

              {!savedSecretKey ? (
                <Card className="border-amber-500/20 p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-amber-500/10 flex items-center justify-center mx-auto mb-4"><Key className="w-8 h-8 text-amber-400" /></div>
                  <CardTitle className="text-amber-300 mb-2">Secret API Key Requerida</CardTitle>
                  <CardDescription className="mb-6">Necesitas configurar la Secret API Key en Configuración para ver los behaviors.</CardDescription>
                  <Button onClick={() => setActiveView('settings')}>Ir a Configuración</Button>
                </Card>
              ) : loading ? (
                <div className="py-20 flex justify-center"><Loader2 className="w-10 h-10 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-4">
                  <div className="px-6 py-3 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl flex items-center gap-2 text-xs text-emerald-400">
                    <ShieldCheck className="w-4 h-4" /> Consultando con: <span className="font-mono">{truncateKey(savedSecretKey)}</span>
                  </div>

                  {behaviors.length === 0 ? (
                    <Card className="border-dashed p-16 text-center">
                      <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto mb-4"><Puzzle className="w-8 h-8 text-rose-400" /></div>
                      <CardTitle className="mb-2">Sin behaviors</CardTitle>
                      <CardDescription>No hay comportamientos configurados para esta aplicación.</CardDescription>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {behaviors.map(behavior => (
                        <Card
                          key={behavior.id}
                          className="p-6 cursor-pointer hover:border-primary/30 transition-all group"
                          onClick={() => fetchBehaviorDetails(behavior.id)}
                        >
                          <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-rose-500/20 to-orange-500/20 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform">
                              <Puzzle className="w-5 h-5" />
                            </div>
                            <Badge variant={behavior.is_active ? "secondary" : "outline"} className={cn(
                              behavior.is_active ? "bg-emerald-500/10 text-emerald-400 border-0" : "bg-muted text-muted-foreground"
                            )}>
                              {behavior.is_active ? 'Activo' : 'Inactivo'}
                            </Badge>
                          </div>

                          <CardTitle className="text-lg mb-1">{behavior.behavior_code}</CardTitle>
                          <p className="text-xs text-muted-foreground font-mono mb-4">{behavior.id}</p>

                          <div className="text-xs text-muted-foreground mt-auto pt-4 border-t border-border flex flex-col gap-1">
                            <div className="flex justify-between">
                              <span>Actualizado:</span>
                              <span className="text-foreground">{new Date(behavior.updated_at).toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>Creado:</span>
                              <span className="text-foreground">{new Date(behavior.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* ── SETTINGS ── */}
          {activeView === 'settings' && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
              <h1 className="text-3xl font-bold mb-8">Configuración</h1>
              <div className="max-w-3xl space-y-6">

                {/* Secret API Key */}
                <Card className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Key className="w-5 h-5" /></div>
                    <div>
                      <CardTitle className="text-lg">Secret API Key</CardTitle>
                      <CardDescription>Para consultar usuarios y webhooks de tu aplicación</CardDescription>
                    </div>
                  </div>
                  {keySaved && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-sm">
                      <ShieldCheck className="w-4 h-4 shrink-0" /> Key activa: <span className="font-mono text-xs">{truncateKey(savedSecretKey)}</span>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Secret API Key</Label>
                      <div className="relative">
                        <Input
                          type={showKey ? 'text' : 'password'}
                          placeholder="sk_live_..."
                          value={secretApiKey}
                          onChange={e => { setSecretApiKey(e.target.value); setKeySaved(false); }}
                          className="pr-12 font-mono"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowKey(v => !v)}>
                          {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSaveKey} className="flex-1 gap-2">
                        <Key className="w-4 h-4" /> Guardar Key
                      </Button>
                      {savedSecretKey && (
                        <Button variant="outline" onClick={handleClearKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">Eliminar</Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Admin API Key */}
                <Card className="p-8">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400"><ShieldCheck className="w-5 h-5" /></div>
                    <div>
                      <CardTitle className="text-lg">Admin API Key</CardTitle>
                      <CardDescription>Para acceder a las variables de entorno del servidor</CardDescription>
                    </div>
                  </div>
                  {adminKeySaved && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-2 text-emerald-400 text-sm">
                      <ShieldCheck className="w-4 h-4 shrink-0" /> Admin Key activa: <span className="font-mono text-xs">{truncateKey(savedAdminKey)}</span>
                    </div>
                  )}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Admin API Key</Label>
                      <div className="relative">
                        <Input
                          type={showAdminKey ? 'text' : 'password'}
                          placeholder="Ej: secret"
                          value={adminApiKey}
                          onChange={e => { setAdminApiKey(e.target.value); setAdminKeySaved(false); }}
                          className="pr-12 font-mono"
                        />
                        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowAdminKey(v => !v)}>
                          {showAdminKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground px-1">Corresponde a la variable <code className="text-rose-400 bg-rose-500/10 px-1 rounded">ADMIN_API_KEY</code> del servidor.</p>
                    </div>
                    <div className="flex gap-3">
                      <Button onClick={handleSaveAdminKey} className="flex-1 gap-2 bg-rose-600 hover:bg-rose-500">
                        <ShieldCheck className="w-4 h-4" /> Guardar Admin Key
                      </Button>
                      {savedAdminKey && (
                        <Button variant="outline" onClick={handleClearAdminKey} className="border-destructive/30 text-destructive hover:bg-destructive/10">Eliminar</Button>
                      )}
                    </div>
                  </div>
                </Card>

                {/* Variables de entorno */}
                <Card className="overflow-hidden">
                  <CardHeader className="flex-row items-center justify-between p-6 border-b">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400"><Server className="w-5 h-5" /></div>
                      <div>
                        <CardTitle className="text-lg">Variables de Entorno</CardTitle>
                        <CardDescription>Estado actual de la configuración del servidor</CardDescription>
                      </div>
                    </div>
                    <Button
                      onClick={() => fetchEnvVars()}
                      disabled={envLoading || !savedAdminKey}
                      className="gap-2 bg-sky-600 hover:bg-sky-500"
                    >
                      {envLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                      {envLoading ? 'Cargando…' : 'Cargar Vars'}
                    </Button>
                  </CardHeader>

                  {envError && (
                    <div className="mx-6 mt-4 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex items-center gap-3 text-rose-400 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <div>
                        <span className="font-semibold">Error: </span>{envError}
                        {envError.includes('disabled') && (
                          <span className="block mt-1 text-muted-foreground text-xs">Asegúrate de tener <code className="text-sky-400">EXPOSE_ENV=true</code> en tu archivo <code>.env.local</code></span>
                        )}
                      </div>
                    </div>
                  )}

                  {!savedAdminKey && envVars.length === 0 && (
                    <div className="p-10 text-center text-muted-foreground text-sm">
                      <Server className="w-8 h-8 mx-auto mb-3 opacity-30" />
                      Configura el Admin API Key para cargar las variables de entorno del servidor.
                    </div>
                  )}

                  {envVars.length > 0 && (
                    <div className="divide-y divide-border">
                      {/* Agrupa por categoría */}
                      {Array.from(new Set(envVars.map(e => e.category))).map(category => (
                        <div key={category}>
                          <div className="px-6 py-2 bg-muted/30">
                            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{category}</span>
                          </div>
                          {envVars.filter(e => e.category === category).map(envVar => (
                            <div key={envVar.key} className="px-6 py-3 hover:bg-muted/50 transition-colors flex items-center gap-4">
                              <div className="w-64 shrink-0">
                                <span className={cn(
                                  "text-xs font-mono font-semibold",
                                  envVar.sensitive ? "text-amber-400" : "text-sky-400"
                                )}>
                                  {envVar.key}
                                </span>
                                {envVar.sensitive && (
                                  <span className="ml-2 px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[10px] font-semibold">SENSIBLE</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                {envVar.sensitive ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-mono text-muted-foreground truncate">
                                      {showSensitiveValues[envVar.key] ? envVar.value : '••••••••'}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => handleToggleSensitive(envVar.key)}
                                      disabled={envLoading}
                                    >
                                      {showSensitiveValues[envVar.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </Button>
                                  </div>
                                ) : (
                                  <span className={cn(
                                    "text-sm font-mono truncate block",
                                    envVar.value === 'false' ? "text-muted-foreground" :
                                      envVar.value === 'true' ? "text-emerald-400" :
                                        envVar.value === '' ? "text-muted-foreground italic" :
                                          "text-foreground"
                                  )}>
                                    {envVar.value === '' ? '(vacío)' : envVar.value}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>

                {/* Info */}
                <Card className="p-6">
                  <CardTitle className="text-base mb-3">Notas de seguridad</CardTitle>
                  <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
                    <li>Las keys se almacenan solo en <code className="text-primary bg-primary/10 px-1 rounded">localStorage</code> de tu navegador.</li>
                    <li>Los valores de campos sensibles aparecen enmascarados por defecto.</li>
                    <li>El endpoint de entorno requiere <code className="text-sky-400 bg-sky-500/10 px-1 rounded">EXPOSE_ENV=true</code> en el servidor.</li>
                    <li>Nunca actives <code className="text-rose-400">EXPOSE_ENV=true</code> en producción.</li>
                  </ul>
                </Card>

              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* ── Modal: Nueva App ── */}
      <Dialog open={isModalOpen} onOpenChange={open => !open && closeAppModal()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{createdAppResponse ? 'Respuesta de Accounts' : 'Nueva Aplicación'}</DialogTitle>
          </DialogHeader>
          {createdAppResponse ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">JSON devuelto por la API al crear la aplicación:</p>
              <pre className="p-4 rounded-lg bg-muted/50 border border-border text-xs font-mono overflow-x-auto max-h-[60vh] overflow-y-auto">
                {JSON.stringify(createdAppResponse, null, 2)}
              </pre>
              <DialogFooter>
                <Button onClick={closeAppModal}>Cerrar</Button>
              </DialogFooter>
            </div>
          ) : (
            <form onSubmit={handleCreateApp} className="space-y-5">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input required placeholder="Mi Aplicación" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Email Administrador</Label>
                <Input required type="email" placeholder="admin@ejemplo.com" value={formData.root_email} onChange={e => setFormData(p => ({ ...p, root_email: e.target.value }))} />
              </div>
              <DialogFooter className="gap-4 pt-4">
                <Button type="button" variant="outline" onClick={closeAppModal} className="flex-1">Cancelar</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1 gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}{isSubmitting ? 'Creando…' : 'Crear Aplicación'}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nuevo Rol ── */}
      <Dialog open={isRoleModalOpen} onOpenChange={setIsRoleModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              Nuevo Rol
            </DialogTitle>
            <DialogDescription>Los roles agrupan permisos que puedes asignar a los usuarios.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateRole} className="space-y-5">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input required placeholder="admin" value={roleForm.name} onChange={e => setRoleForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Rol con permisos de administración" value={roleForm.description} onChange={e => setRoleForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsRoleModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isRoleSubmitting} className="gap-2">
                {isRoleSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isRoleSubmitting ? 'Creando…' : 'Crear Rol'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nueva Política ── */}
      <Dialog open={isPolicyModalOpen} onOpenChange={setIsPolicyModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-primary" />
              Nueva Política
            </DialogTitle>
            <DialogDescription>Define permisos (recurso + acción + efecto) para control de acceso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreatePolicy} className="space-y-5">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input required placeholder="read_users" value={policyForm.name} onChange={e => setPolicyForm(p => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input placeholder="Permite leer información de usuarios" value={policyForm.description} onChange={e => setPolicyForm(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Recurso *</Label>
                <Input required placeholder="users" value={policyForm.resource} onChange={e => setPolicyForm(p => ({ ...p, resource: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Acción *</Label>
                <Input required placeholder="read" value={policyForm.action} onChange={e => setPolicyForm(p => ({ ...p, action: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Efecto *</Label>
              <select
                value={policyForm.effect}
                onChange={e => setPolicyForm(p => ({ ...p, effect: e.target.value }))}
                className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="allow">allow</option>
                <option value="deny">deny</option>
              </select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsPolicyModalOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isPolicySubmitting} className="gap-2">
                {isPolicySubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPolicySubmitting ? 'Creando…' : 'Crear Política'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Políticas del Rol (asignar) ── */}
      <Dialog open={isRolePoliciesModalOpen} onOpenChange={(open) => { if (!open) { setIsRolePoliciesModalOpen(false); setRolePoliciesInfo(null); setSelectedRoleForPolicies(null); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-primary" />
              Políticas del rol
              {rolePoliciesInfo && <span className="text-muted-foreground font-normal">— {rolePoliciesInfo.role.name}</span>}
            </DialogTitle>
            {rolePoliciesInfo?.role.description && (
              <DialogDescription>{rolePoliciesInfo.role.description}</DialogDescription>
            )}
          </DialogHeader>

          {rolePoliciesInfo && (
            <div className="space-y-6">
              <div>
                <h4 className="text-sm font-semibold mb-3">Políticas asignadas</h4>
                {rolePoliciesInfo.policies.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4">No hay políticas asignadas. Añade una abajo.</p>
                ) : (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {rolePoliciesInfo.policies.map(p => (
                      <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div>
                          <span className="font-medium text-sm">{p.name}</span>
                          <span className="text-xs text-muted-foreground ml-2 font-mono">{p.resource} → {p.action}</span>
                        </div>
                        <Badge variant={p.effect === 'allow' ? 'secondary' : 'destructive'}>{p.effect}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <form onSubmit={handleAssignPolicy} className="space-y-4">
                <h4 className="text-sm font-semibold">Asignar nueva política</h4>
                <div className="space-y-2">
                  <Label>Política</Label>
                  <select
                    value={assignForm.policy_id}
                    onChange={e => setAssignForm(p => ({ ...p, policy_id: e.target.value }))}
                    className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">Selecciona una política</option>
                    {policies
                      .filter(p => !rolePoliciesInfo.policies.some(rp => rp.id === p.id))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.resource} → {p.action})</option>
                      ))}
                  </select>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsRolePoliciesModalOpen(false)}>Cerrar</Button>
                  <Button type="submit" disabled={isAssignSubmitting || !assignForm.policy_id} className="gap-2">
                    {isAssignSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {isAssignSubmitting ? 'Asignando…' : 'Asignar Política'}
                  </Button>
                </DialogFooter>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Modal: Nuevo Webhook ── */}
      <Dialog open={isWebhookModalOpen} onOpenChange={setIsWebhookModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary"><Webhook className="w-5 h-5" /></div>
              <DialogTitle>Nuevo Webhook</DialogTitle>
            </div>
          </DialogHeader>

          <form onSubmit={handleCreateWebhook} className="flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input required placeholder="Mi Webhook" value={webhookForm.name} onChange={e => setWebhookForm(p => ({ ...p, name: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Descripción</Label>
                  <Input placeholder="Opcional" value={webhookForm.description} onChange={e => setWebhookForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2"><Globe className="w-4 h-4" /> URL del endpoint *</Label>
                <Input required type="url" placeholder="https://tuapp.com/webhooks" value={webhookForm.url} onChange={e => setWebhookForm(p => ({ ...p, url: e.target.value }))} className="font-mono" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><Lock className="w-4 h-4" /> Secret de firma *</Label>
                  <Input required placeholder="mi-secret-seguro" value={webhookForm.secret} onChange={e => setWebhookForm(p => ({ ...p, secret: e.target.value }))} className="font-mono" />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-2"><RotateCcw className="w-4 h-4" /> Reintentos (0–10)</Label>
                  <Input type="number" min={0} max={10} value={webhookForm.retries} onChange={e => setWebhookForm(p => ({ ...p, retries: +e.target.value }))} />
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-muted/50 rounded-2xl border">
                <div>
                  <div className="text-sm font-medium">Activar inmediatamente</div>
                  <CardDescription>Comenzará a recibir eventos al crearse</CardDescription>
                </div>
                <Switch checked={webhookForm.active} onCheckedChange={active => setWebhookForm(p => ({ ...p, active }))} />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label className="flex items-center gap-2"><Zap className="w-4 h-4" /> Eventos a suscribir *</Label>
                  <span className="text-xs text-primary font-semibold">{selectedEvents.size} seleccionados</span>
                </div>
                <div className="space-y-2 bg-muted/30 rounded-2xl border p-3 max-h-56 overflow-y-auto">
                  {Object.entries(eventsByCategory).map(([category, catEvents]) => (
                    <div key={category}>
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full justify-between px-3 py-2 h-auto"
                        onClick={() => toggleCategory(category)}
                      >
                        <div className="flex items-center gap-2">
                          <span className={cn("px-2 py-0.5 rounded-md text-xs font-semibold", getCategoryColor(category))}>{category}</span>
                          <span className="text-xs text-muted-foreground">{catEvents.length} eventos</span>
                          {catEvents.every(e => selectedEvents.has(e.code)) && catEvents.length > 0 && (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-xs text-muted-foreground hover:text-primary h-auto py-0 px-2"
                            onClick={e => { e.stopPropagation(); selectAllInCategory(category); }}
                          >
                            {catEvents.every(e => selectedEvents.has(e.code)) ? 'Quitar todos' : 'Todos'}
                          </Button>
                          {expandedCategories.has(category) ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                        </div>
                      </Button>
                      <AnimatePresence>
                        {expandedCategories.has(category) && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.15 }} className="overflow-hidden">
                            <div className="px-3 pb-2 space-y-1">
                              {catEvents.map(ev => (
                                <label key={ev.code} className="flex items-start gap-3 px-3 py-2 rounded-xl hover:bg-muted/50 cursor-pointer transition-colors group">
                                  <div className={cn("w-4 h-4 mt-0.5 rounded-md border flex items-center justify-center shrink-0 transition-colors", selectedEvents.has(ev.code) ? "bg-primary border-primary" : "border-border group-hover:border-primary/50")}>
                                    {selectedEvents.has(ev.code) && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                                  </div>
                                  <input type="checkbox" className="hidden" checked={selectedEvents.has(ev.code)} onChange={() => toggleEvent(ev.code)} />
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
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-4 pt-6">
              <Button type="button" variant="outline" onClick={() => setIsWebhookModalOpen(false)} className="flex-1">Cancelar</Button>
              <Button type="submit" disabled={isWebhookSubmitting} className="flex-1 gap-2">
                {isWebhookSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                {isWebhookSubmitting ? 'Creando…' : 'Crear Webhook'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Modal: Behavior Details ── */}
      <Dialog open={isBehaviorModalOpen && !!selectedBehavior} onOpenChange={open => !open && setIsBehaviorModalOpen(false)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {selectedBehavior && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400">
                    <Puzzle className="w-6 h-6" />
                  </div>
                  <div>
                    <DialogTitle>{selectedBehavior.behavior_code}</DialogTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={selectedBehavior.is_active ? "secondary" : "outline"} className={cn(
                        selectedBehavior.is_active ? "bg-emerald-500/10 text-emerald-400 border-0" : "bg-muted text-muted-foreground"
                      )}>
                        {selectedBehavior.is_active ? 'Activo' : 'Inactivo'}
                      </Badge>
                      <span className="text-xs text-muted-foreground font-mono">{selectedBehavior.id}</span>
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="space-y-8">
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground mb-4 flex items-center gap-2">
                    <Settings className="w-4 h-4" /> Configuración JSON
                  </h3>
                  <div className="bg-muted/50 rounded-2xl p-4 border font-mono text-sm overflow-x-auto">
                    <pre className="text-sky-300">
                      {JSON.stringify(selectedBehavior.config, null, 2)}
                    </pre>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">Creado por</div>
                    <div className="text-sm font-mono">{selectedBehavior.created_by}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">App ID</div>
                    <div className="text-sm font-mono">{selectedBehavior.app_id}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">Fecha de creación</div>
                    <div className="text-sm">{new Date(selectedBehavior.created_at).toLocaleString()}</div>
                  </div>
                  <div className="space-y-1">
                    <div className="text-xs text-muted-foreground font-medium uppercase">Última actualización</div>
                    <div className="text-sm">{new Date(selectedBehavior.updated_at).toLocaleString()}</div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
