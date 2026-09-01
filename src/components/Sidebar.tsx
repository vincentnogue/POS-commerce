import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Store,
  FileText, Truck, Users, Building2, Receipt, Wallet, ClipboardList,
  FileBarChart, Calculator, UserCog, Settings, Shield, Crown,
  ChevronDown, LogOut, X, Globe, Lock, Puzzle, Clock3, Tag,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useI18n } from '../lib/i18n';
import { ROLE_LABELS } from '../lib/constants';
import { Logo } from './Logo';
import type { Role } from '../lib/types';

type NavItem = {
  to: string;
  labelKey: string;
  icon: typeof LayoutDashboard;
  module?: string;
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, module: 'pos' },
  { to: '/products', labelKey: 'nav.products', icon: Package, module: 'products' },
  { to: '/stock', labelKey: 'nav.stock', icon: Boxes, module: 'stock' },
  { to: '/stores', labelKey: 'nav.stores', icon: Store, module: 'stores' },
  { to: '/invoices', labelKey: 'nav.invoices', icon: FileText, module: 'invoices' },
  { to: '/deliveries', labelKey: 'nav.deliveries', icon: Truck, module: 'deliveries' },
  { to: '/customers', labelKey: 'nav.customers', icon: Users, module: 'customers' },
  { to: '/suppliers', labelKey: 'nav.suppliers', icon: Building2, module: 'suppliers' },
  { to: '/expenses', labelKey: 'nav.expenses', icon: Wallet, module: 'expenses' },
  { to: '/purchases', labelKey: 'nav.purchases', icon: Receipt, module: 'purchases' },
  { to: '/quotes', labelKey: 'nav.quotes', icon: ClipboardList, module: 'quotes' },
  { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart, module: 'reports' },
  { to: '/accounting', labelKey: 'nav.accounting', icon: Calculator, module: 'accounting' },
  { to: '/users', labelKey: 'nav.users', icon: UserCog, module: 'users' },
  { to: '/timeclock', labelKey: 'nav.timeclock', icon: Clock3 },
  { to: '/promotions', labelKey: 'nav.promotions', icon: Tag },
  { to: '/administration', labelKey: 'nav.administration', icon: Shield, module: 'administration' },
  { to: '/marketplace', labelKey: 'nav.marketplace', icon: Puzzle, module: 'marketplace' },
  { to: '/settings', labelKey: 'nav.settings', icon: Settings, module: 'settings' },
  { to: '/superadmin', labelKey: 'nav.superadmin', icon: Crown, module: 'administration', superAdminOnly: true },
];

function getInitials(name: string) {
  const parts = (name || '').trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS: Record<string, string> = {
  action: 'bg-action-500',
  brand: 'bg-brand-500',
  flow: 'bg-flow-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  error: 'bg-error-500',
};

export function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { tenant, member, tenants, switchTenant, signOut, user, isSuperAdmin, planModules } = useAuth();
  const { t } = useI18n();
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const navigate = useNavigate();

  const ALWAYS_AVAILABLE = ['dashboard', 'pos', 'settings'];
  // BUG FIX: super admins must never be locked out of a module by plan tier —
  // the /superadmin item shares the 'administration' module code with the
  // regular admin panel, so without this check a super admin on a tenant
  // whose plan excludes 'administration' would see the item redirect to
  // /subscribe instead of opening the Super Admin console.
  const isLocked = (mod?: string) =>
    !isSuperAdmin && !!mod && !ALWAYS_AVAILABLE.includes(mod) && !!planModules && !planModules.includes(mod);

  const filteredNav = NAV.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const initials = member?.display_name
    ? getInitials(member.display_name)
    : tenant ? getInitials(tenant.name) : (user?.email?.slice(0, 2).toUpperCase() ?? '?');
  const avatarColor = AVATAR_COLORS[member?.avatar_color ?? 'action'] ?? 'bg-action-500';

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-ink-900/40 backdrop-blur-sm lg:hidden" onClick={onClose} />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-50 dark:bg-ink-900 dark:border-r dark:border-ink-800 transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <Logo clickable />
          <button onClick={onClose} className="rounded-full p-1 text-ink-500 dark:text-ink-400 hover:bg-brand-100 dark:hover:bg-brand-900/35 lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Tenant selector */}
        <div className="px-4 pb-2">
          <div className="relative">
            <button
              onClick={() => setTenantMenuOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-brand-100 bg-white dark:bg-ink-800 px-3 py-2.5 text-left transition hover:border-brand-200"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{tenant?.name ?? t('sidebar.noStore')}</p>
                <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                  {tenant?.city ?? '—'} · {tenant?.country_name}
                </p>
              </div>
              <ChevronDown size={16} className={`text-ink-400 dark:text-ink-500 transition-transform ${tenantMenuOpen ? 'rotate-180' : ''}`} />
            </button>
            <AnimatePresence>
              {tenantMenuOpen && tenants.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 right-0 top-full z-10 mt-1 max-h-64 overflow-auto rounded-xl border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 py-1 shadow-float scroll-thin"
                >
                  {tenants.map(({ tenant: tn, member: m }) => (
                    <button
                      key={tn.id}
                      onClick={() => { switchTenant(tn.id); setTenantMenuOpen(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-900/25 ${
                        tn.id === tenant?.id ? 'bg-brand-50 dark:bg-brand-900/25 font-medium' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-ink-900 dark:text-ink-50">{tn.name}</p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-400">{tn.city}</p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-[10px] uppercase text-ink-600 dark:text-ink-300">
                        {t(`role.${(m.role as Role) ?? 'staff'}`)}
                      </span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 scroll-thin">
          {filteredNav.map((item) => {
            const Icon = item.icon;
            const locked = isLocked(item.module);
            if (locked) {
              return (
                <NavLink
                  key={item.to}
                  to="/subscribe"
                  onClick={() => onClose()}
                  className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-400 dark:text-ink-500 opacity-70 transition-colors hover:bg-white/60 dark:hover:bg-ink-800/60"
                  title={t('sidebar.lockedFeature')}
                >
                  <Icon size={18} strokeWidth={1.8} className="shrink-0 text-ink-400 dark:text-ink-500" />
                  <span className="truncate">{t(item.labelKey)}</span>
                  <Lock size={13} className="ml-auto shrink-0" />
                </NavLink>
              );
            }
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-ink-800 text-brand-700 shadow-soft'
                      : 'text-ink-700 dark:text-ink-200 hover:bg-white/60 dark:hover:bg-ink-800/60 hover:text-brand-700'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} className="shrink-0 text-ink-500 dark:text-ink-400 group-hover:text-brand-600" />
                <span className="truncate">{t(item.labelKey)}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Profile + sign out */}
        <div className="m-3 rounded-xl border border-brand-100 bg-white dark:bg-ink-800 p-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${avatarColor}`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{member?.display_name ?? tenant?.name ?? user?.email}</p>
              <p className="truncate text-xs text-ink-500 dark:text-ink-400">{member ? t(ROLE_LABELS[(member.role as Role) ?? 'staff']?.key ?? 'users.role.staff') : '—'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 py-2 text-sm font-medium text-ink-700 dark:text-ink-200 transition hover:border-error-200 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"
          >
            <LogOut size={15} /> {t('common.signOut')}
          </button>
        </div>
        <div className="px-4 pb-4 text-center text-[10px] text-ink-400 dark:text-ink-500">
          <div className="flex items-center justify-center gap-1">
            <Globe size={10} /> LiAfrik · Dubaï / Afrique
          </div>
        </div>
      </aside>
    </>
  );
}
