import type { Role } from './types';

export const ROLE_LABELS: Record<string, { key: string; tone: 'primary' | 'success' | 'danger' | 'warning' | 'flow' }> = {
  owner: { key: 'users.role.owner', tone: 'primary' },
  admin: { key: 'users.role.admin', tone: 'primary' },
  manager: { key: 'users.role.manager', tone: 'success' },
  staff: { key: 'users.role.staff', tone: 'flow' },
  viewer: { key: 'users.role.viewer', tone: 'warning' },
};

export const PERMISSIONS_BY_ROLE: Record<Role, string[]> = {
  owner: ['*'], // All permissions
  admin: [
    'dashboard:read', 'dashboard:write',
    'pos:read', 'pos:write',
    'products:read', 'products:write', 'products:delete',
    'stock:read', 'stock:write',
    'invoices:read', 'invoices:write',
    'customers:read', 'customers:write',
    'expenses:read', 'expenses:write',
    'reports:read',
    'users:read', 'users:write',
    'marketplace:read', 'marketplace:write',
  ],
  manager: [
    'dashboard:read', 'pos:read', 'pos:write',
    'products:read', 'stock:read', 'stock:write',
    'invoices:read', 'invoices:write',
    'customers:read', 'expenses:read',
    'reports:read',
  ],
  staff: [
    'dashboard:read', 'pos:read', 'pos:write',
    'products:read', 'stock:read',
    'invoices:read', 'customers:read',
  ],
  viewer: [
    'dashboard:read', 'pos:read', 'products:read',
    'invoices:read', 'reports:read',
  ],
};
