import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Store,
  FileText, Truck, Users, Building2, Receipt, Wallet, ClipboardList,
  FileBarChart, Calculator, UserCog, Settings, Shield, Crown,
  ChevronDown, LogOut, X, Globe, Lock, Puzzle, Clock3, Tag, ClipboardCheck, Percent, MessageSquare,
  TrendingUp,
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

type NavGroup = {
  labelKey: string | null; // null = standalone, no section header (Dashboard)
  items: NavItem[];
};

// Grouped into labeled sections instead of one flat 23-item list — the
// items themselves are unchanged (same routes, icons, module gating),
// this only changes how they're visually organized, matching the pattern
// every comparable POS SaaS (Lightspeed, Square, Shopify POS) uses once
// there are more than ~8 nav items to show at once.
// Pinned "quick access" row (no section header) surfaces the 3 modules
// used every single day at a retail POS business — Dashboard, the
// point of sale itself, and the product catalog — ahead of everything
// else, Notion/Linear-style. Pulled out of their original groups rather
// than duplicated there, so the full nav doesn't get longer.
const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: null,
    items: [
      { to: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, module: 'dashboard' },
      { to: '/pos', labelKey: 'nav.pos', icon: ShoppingCart, module: 'pos' },
      { to: '/products', labelKey: 'nav.products', icon: Package, module: 'products' },
    ],
  },
  {
    labelKey: 'sidebar.group.sell',
    items: [
      { to: '/quotes', labelKey: 'nav.quotes', icon: ClipboardList, module: 'quotes' },
      { to: '/invoices', labelKey: 'nav.invoices', icon: FileText, module: 'invoices' },
      { to: '/deliveries', labelKey: 'nav.deliveries', icon: Truck, module: 'deliveries' },
      { to: '/promotions', labelKey: 'nav.promotions', icon: Tag, module: 'promotions' },
    ],
  },
  {
    labelKey: 'sidebar.group.catalog',
    items: [
      { to: '/stock', labelKey: 'nav.stock', icon: Boxes, module: 'stock' },
      { to: '/suppliers', labelKey: 'nav.suppliers', icon: Building2, module: 'suppliers' },
      { to: '/purchases', labelKey: 'nav.purchases', icon: Receipt, module: 'purchases' },
    ],
  },
  {
    labelKey: 'sidebar.group.customers',
    items: [
      { to: '/customers', labelKey: 'nav.customers', icon: Users, module: 'customers' },
      { to: '/messages', labelKey: 'nav.messages', icon: MessageSquare, module: 'messages' },
    ],
  },
  {
    labelKey: 'sidebar.group.finance',
    items: [
      { to: '/performance', labelKey: 'nav.performance', icon: TrendingUp, module: 'performance' },
      { to: '/expenses', labelKey: 'nav.expenses', icon: Wallet, module: 'expenses' },
      { to: '/accounting', labelKey: 'nav.accounting', icon: Calculator, module: 'accounting' },
      { to: '/commissions', labelKey: 'nav.commissions', icon: Percent },
      { to: '/reports', labelKey: 'nav.reports', icon: FileBarChart, module: 'reports' },
    ],
  },
  {
    labelKey: 'sidebar.group.team',
    items: [
      { to: '/stores', labelKey: 'nav.stores', icon: Store, module: 'stores' },
      { to: '/users', labelKey: 'nav.users', icon: UserCog, module: 'users' },
      { to: '/timeclock', labelKey: 'nav.timeclock', icon: Clock3 },
      { to: '/tasks', labelKey: 'nav.tasks', icon: ClipboardCheck },
    ],
  },
  {
    labelKey: 'sidebar.group.platform',
    items: [
      { to: '/marketplace', labelKey: 'nav.marketplace', icon: Puzzle, module: 'marketplace' },
      { to: '/administration', labelKey: 'nav.administration', icon: Shield, module: 'administration' },
      { to: '/settings', labelKey: 'nav.settings', icon: Settings, module: 'settings' },
      { to: '/superadmin', labelKey: 'nav.superadmin', icon: Crown, module: 'administration', superAdminOnly: true },
    ],
  },
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

  // Collapsible sections (Notion/Linear-style), remembered per browser so
  // a merchant's chosen layout sticks across visits. Defaults to nothing
  // collapsed — collapsing is an opt-in the user takes, never a surprise
  // on first load that hides a module they haven't chosen to hide.
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = window.localStorage.getItem('sidebar-collapsed-groups');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  useEffect(() => {
    try {
      window.localStorage.setItem('sidebar-collapsed-groups', JSON.stringify(collapsedGroups));
    } catch {
      // Private-browsing/storage-disabled contexts: collapsing still
      // works for the session, it just won't be remembered next time.
    }
  }, [collapsedGroups]);
  const toggleGroup = (key: string) => setCollapsedGroups((g) => ({ ...g, [key]: !g[key] }));

  const ALWAYS_AVAILABLE = ['dashboard', 'pos', 'settings'];
  // BUG FIX: super admins must never be locked out of a module by plan tier —
  // the /superadmin item shares the 'administration' module code with the
  // regular admin panel, so without this check a super admin on a tenant
  // whose plan excludes 'administration' would see the item redirect to
  // /subscribe instead of opening the Super Admin console.
  const isLocked = (mod?: string) =>
    !isSuperAdmin && !!mod && !ALWAYS_AVAILABLE.includes(mod) && !!planModules && !planModules.includes(mod);

  const filteredNavGroups = NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => !item.superAdminOnly || isSuperAdmin) }))
    .filter((group) => group.items.length > 0);

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
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-brand-50 dark:bg-ink-900 dark:border-r dark:border-ink-800 transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Logo */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <Logo clickable />
          <button onClick={onClose} className="rounded-full p-1 text-ink-500 dark:text-ink-400 hover:bg-brand-100 dark:hover:bg-brand-900/35 lg:hidden">
            <X size={20} />
          </button>
        </div>

        {/* Tenant selector */}
        <div className="px-3 pb-2">
          <div className="relative">
            <button
              onClick={() => setTenantMenuOpen((v) => !v)}
              className="flex w-full items-center justify-between rounded-xl border border-brand-100 dark:border-ink-700 bg-white dark:bg-ink-800 px-2.5 py-2 text-left shadow-sm transition hover:border-brand-300 hover:shadow-soft"
            >
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/35 text-brand-600">
                  <Building2 size={14} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{tenant?.name ?? t('sidebar.noStore')}</p>
                  <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                    {tenant?.city ?? '—'} · {tenant?.country_name}
                  </p>
                </div>
              </div>
              <ChevronDown size={15} className={`ml-2 shrink-0 text-ink-400 dark:text-ink-500 transition-transform ${tenantMenuOpen ? 'rotate-180' : ''}`} />
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
        <nav className="flex-1 overflow-y-auto px-2.5 py-1.5 scroll-thin">
          {filteredNavGroups.map((group, groupIdx) => {
            const isCollapsed = group.labelKey ? !!collapsedGroups[group.labelKey] : false;
            return (
              <div key={group.labelKey ?? 'standalone'} className={groupIdx > 0 ? 'mt-2.5 border-t border-ink-900/5 dark:border-white/5 pt-2.5' : ''}>
                {group.labelKey && (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.labelKey as string)}
                    className="flex w-full items-center justify-between px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-400 dark:text-ink-500 hover:text-ink-600 dark:hover:text-ink-300"
                  >
                    {t(group.labelKey)}
                    <ChevronDown size={12} className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`} />
                  </button>
                )}
                <AnimatePresence initial={false}>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="overflow-hidden"
                    >
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const locked = isLocked(item.module);
                        if (locked) {
                          return (
                            <NavLink
                              key={item.to}
                              to="/subscribe"
                              onClick={() => onClose()}
                              className="group relative flex items-center gap-2.5 rounded-lg border-l-2 border-transparent px-2.5 py-1.5 text-sm font-medium text-ink-400 dark:text-ink-500 opacity-70 transition-colors hover:bg-white/60 dark:hover:bg-ink-800/60"
                              title={t('sidebar.lockedFeature')}
                            >
                              <Icon size={16} strokeWidth={1.8} className="shrink-0 text-ink-400 dark:text-ink-500" />
                              <span className="truncate">{t(item.labelKey)}</span>
                              <Lock size={12} className="ml-auto shrink-0" />
                            </NavLink>
                          );
                        }
                        return (
                          <NavLink
                            key={item.to}
                            to={item.to}
                            onClick={() => onClose()}
                            className={({ isActive }) =>
                              `group relative flex items-center gap-2.5 rounded-lg border-l-2 px-2.5 py-1.5 text-sm font-medium transition-all duration-150 ${
                                isActive
                                  ? 'border-brand-600 bg-white dark:bg-ink-800 text-brand-700 shadow-soft'
                                  : 'border-transparent text-ink-700 dark:text-ink-200 hover:border-brand-200 hover:bg-white/60 dark:hover:bg-ink-800/60 hover:text-brand-700'
                              }`
                            }
                          >
                            <Icon size={16} strokeWidth={1.8} className="shrink-0 text-ink-500 dark:text-ink-400 transition-colors group-hover:text-brand-600" />
                            <span className="truncate">{t(item.labelKey)}</span>
                          </NavLink>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </nav>

        {/* Profile + sign out */}
        <div className="m-2.5 rounded-xl border border-brand-100 dark:border-ink-700 bg-white dark:bg-ink-800 p-2.5 shadow-sm">
          <div className="flex items-center gap-2.5">
            <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-medium text-white ${avatarColor}`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-50">{member?.display_name ?? tenant?.name ?? user?.email}</p>
              <p className="truncate text-xs text-ink-500 dark:text-ink-400">{member ? t(ROLE_LABELS[(member.role as Role) ?? 'staff']?.key ?? 'users.role.staff') : '—'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-full border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 py-1.5 text-sm font-medium text-ink-700 dark:text-ink-200 transition hover:border-error-200 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"
          >
            <LogOut size={14} /> {t('common.signOut')}
          </button>
        </div>
        <div className="px-4 pb-3 text-center text-[10px] text-ink-400 dark:text-ink-500">
          <div className="flex items-center justify-center gap-1">
            <Globe size={10} /> LiAfrik · Dubaï / Afrique
          </div>
        </div>
      </aside>
    </>
  );
}
