import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, ShoppingCart, Package, Boxes, Store,
  FileText, Truck, Users, Building2, Receipt, Wallet, ClipboardList,
  FileBarChart, Calculator, UserCog, Settings, Shield, Crown,
  ChevronDown, LogOut, X, Globe,
} from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Logo } from './Logo';
import type { Role } from '../lib/types';

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  module?: string;
  superAdminOnly?: boolean;
};

const NAV: NavItem[] = [
  { to: '/dashboard', label: 'Tableau de bord', icon: LayoutDashboard, module: 'dashboard' },
  { to: '/pos', label: 'Point de Vente', icon: ShoppingCart, module: 'pos' },
  { to: '/products', label: 'Produits', icon: Package, module: 'products' },
  { to: '/stock', label: 'Stock', icon: Boxes, module: 'stock' },
  { to: '/stores', label: 'Magasins', icon: Store, module: 'stores' },
  { to: '/invoices', label: 'Factures', icon: FileText, module: 'invoices' },
  { to: '/deliveries', label: 'Livraisons', icon: Truck, module: 'deliveries' },
  { to: '/customers', label: 'Clients', icon: Users, module: 'customers' },
  { to: '/suppliers', label: 'Fournisseurs', icon: Building2, module: 'suppliers' },
  { to: '/expenses', label: 'Dépenses', icon: Wallet, module: 'expenses' },
  { to: '/purchases', label: 'Achats', icon: Receipt, module: 'purchases' },
  { to: '/quotes', label: 'Devis', icon: ClipboardList, module: 'quotes' },
  { to: '/reports', label: 'Rapports', icon: FileBarChart, module: 'reports' },
  { to: '/accounting', label: 'Comptabilité', icon: Calculator, module: 'accounting' },
  { to: '/users', label: 'Utilisateurs', icon: UserCog, module: 'users' },
  { to: '/administration', label: 'Administration', icon: Shield, module: 'administration' },
  { to: '/settings', label: 'Paramètres', icon: Settings, module: 'settings' },
  { to: '/superadmin', label: 'Super Admin', icon: Crown, module: 'administration', superAdminOnly: true },
];

const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  admin: 'Propriétaire',
  manager: 'Manager',
  staff: 'Vendeur',
};

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
  const { tenant, member, tenants, switchTenant, signOut, user } = useAuth();
  const [tenantMenuOpen, setTenantMenuOpen] = useState(false);
  const navigate = useNavigate();

  const filteredNav = NAV;

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
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col bg-brand-50 dark:bg-brand-900/25 dark:bg-ink-900 dark:border-r dark:border-ink-800 transition-transform lg:static lg:translate-x-0 ${
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
                <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{tenant?.name ?? 'Aucun magasin'}</p>
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
                  {tenants.map(({ tenant: t, member: m }) => (
                    <button
                      key={t.id}
                      onClick={() => { switchTenant(t.id); setTenantMenuOpen(false); }}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-brand-50 dark:hover:bg-brand-900/25 ${
                        t.id === tenant?.id ? 'bg-brand-50 dark:bg-brand-900/25 font-semibold' : ''
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-ink-900 dark:text-ink-50">{t.name}</p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-400">{t.city}</p>
                      </div>
                      <span className="ml-2 shrink-0 rounded-full bg-ink-100 dark:bg-ink-800 px-2 py-0.5 text-[10px] uppercase text-ink-600 dark:text-ink-300">
                        {ROLE_LABELS[(m.role as Role) ?? 'staff']}
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
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => onClose()}
                className={({ isActive }) =>
                  `group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-white dark:bg-ink-800 text-brand-700 shadow-soft'
                      : 'text-ink-700 dark:text-ink-200 hover:bg-white/60 dark:bg-ink-800/60 hover:text-brand-700'
                  }`
                }
              >
                <Icon size={18} strokeWidth={1.8} className="shrink-0 text-ink-500 dark:text-ink-400 group-hover:text-brand-600" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Profile + sign out */}
        <div className="m-3 rounded-xl border border-brand-100 bg-white dark:bg-ink-800 p-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${avatarColor}`}>
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-900 dark:text-ink-50">{member?.display_name ?? tenant?.name ?? user?.email}</p>
              <p className="truncate text-xs text-ink-500 dark:text-ink-400">{member ? ROLE_LABELS[(member.role as Role) ?? 'staff'] : '—'}</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-ink-200 dark:border-ink-700 bg-white dark:bg-ink-800 px-3 py-2 text-sm font-semibold text-ink-700 dark:text-ink-200 transition hover:border-error-200 hover:bg-error-50 dark:hover:bg-error-900/25 hover:text-error-600"
          >
            <LogOut size={15} /> Se déconnecter
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
