// Shared domain types

export type Role = 'super_admin' | 'admin' | 'manager' | 'staff' | 'viewer';

export type Tenant = {
  id: string;
  name: string;
  business_type: string | null;
  country_code: string;
  country_name: string;
  region: string | null;
  city: string | null;
  currency: string;
  currency_locked: boolean;
  plan_id: string | null;
  commercial_code_id: string | null;
  status: string;
  trial_ends_at: string | null; // 14 days free trial
  created_at: string;
  rms_destination_store_id?: string | null;
  return_settings?: { allow_cash?: boolean; allow_card?: boolean; allow_store_credit?: boolean; allow_exchange?: boolean } | null;
  max_x_reports_per_day?: number;
};

export type Store = {
  id: string;
  tenant_id: string;
  name: string;
  city: string | null;
  address: string | null;
  phone: string | null;
  is_active: boolean;
  latitude: number | null;
  longitude: number | null;
};

export type StoreAssignment = {
  id: string;
  tenant_id: string;
  member_id: string;
  store_id: string;
  can_transfer: boolean;
  created_at: string;
};

export type StockTransfer = {
  id: string;
  tenant_id: string;
  product_id: string;
  source_store_id: string;
  dest_store_id: string;
  quantity: number;
  status: 'pending' | 'received' | 'cancelled';
  notes: string | null;
  initiated_by: string | null;
  received_by: string | null;
  created_at: string;
  received_at: string | null;
};

export type CustomRole = {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  permissions: Permissions;
  created_at: string;
};

export type Member = {
  id: string;
  tenant_id: string;
  user_id: string;
  role: Role;
  custom_role_id: string | null;
  display_name: string | null;
  avatar_color: string;
  staff_code?: string | null;
};

export type Plan = {
  id: string;
  name: string;
  code: string;
  price_usd: number;
  max_users: number;
  max_stores: number;
  max_products: number;
  features: string[];
  is_active: boolean;
  sort_order: number;
};

export type Product = {
  id: string;
  tenant_id: string;
  category_id: string | null;
  name: string;
  sku: string | null;
  barcode: string | null;
  description: string | null;
  cost_price: number;
  sale_price: number;
  tax_rate: number;
  unit: string;
  variants: any[];
  image_url: string | null;
  low_stock_threshold: number;
  is_active: boolean;
};

export type Customer = {
  id: string;
  tenant_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tax_id: string | null;
  balance: number;
  notes: string | null;
  created_at: string;
  store_credit_balance?: number;
};

export type Supplier = {
  id: string;
  tenant_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  tax_id: string | null;
  balance: number;
  notes: string | null;
};

export type Sale = {
  id: string;
  tenant_id: string;
  store_id: string | null;
  customer_id: string | null;
  commercial_code_id: string | null;
  reference: string;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  paid_amount: number;
  payment_method: string | null;
  payment_status: string;
  sale_status: string;
  notes: string | null;
  sale_date: string;
  created_at: string;
};

export type SaleItem = {
  id: string;
  sale_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
  variant: string | null;
};

export type InvoiceItem = {
  id: string;
  invoice_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
};

export type PurchaseItem = {
  id: string;
  purchase_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_cost: number;
  total: number;
  rejected_quantity: number;
  rejection_reason: string | null;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  discount: number;
  tax_rate: number;
  total: number;
};

export type Invoice = {
  id: string;
  tenant_id: string;
  store_id: string | null;
  customer_id: string | null;
  sale_id: string | null;
  number: string;
  status: string;
  issue_date: string;
  due_date: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  paid_amount: number;
  notes: string | null;
  created_at: string;
};

export type Delivery = {
  id: string;
  tenant_id: string;
  invoice_id: string | null;
  sale_id: string | null;
  customer_name: string;
  address: string | null;
  city: string | null;
  phone: string | null;
  status: string;
  carrier: string | null;
  tracking_number: string | null;
  scheduled_date: string | null;
  delivered_at: string | null;
  created_at: string;
};

export type Expense = {
  id: string;
  tenant_id: string;
  store_id: string | null;
  category: string | null;
  description: string;
  amount: number;
  payment_method: string | null;
  expense_date: string;
  supplier_id: string | null;
  notes: string | null;
};

export type Purchase = {
  id: string;
  tenant_id: string;
  supplier_id: string | null;
  store_id: string | null;
  reference: string;
  status: string;
  subtotal: number;
  tax_total: number;
  total: number;
  paid_amount: number;
  purchase_date: string;
  notes: string | null;
};

export type Quote = {
  id: string;
  tenant_id: string;
  customer_id: string | null;
  number: string;
  status: string;
  issue_date: string;
  expiry_date: string | null;
  subtotal: number;
  tax_total: number;
  discount_total: number;
  total: number;
  notes: string | null;
};

export type SaleReturn = {
  id: string;
  tenant_id: string;
  store_id: string | null;
  original_sale_id: string;
  customer_id: string | null;
  day_session_id: string | null;
  reference: string;
  kind: 'return' | 'exchange';
  reason: string | null;
  refund_method: 'cash' | 'card' | 'mobile_money' | 'store_credit' | 'none';
  refund_amount: number;
  staff_code: string | null;
  processed_by: string | null;
  created_at: string;
};

export type SaleReturnItem = {
  id: string;
  return_id: string;
  sale_item_id: string | null;
  product_id: string | null;
  name: string;
  quantity: number;
  unit_price: number;
  total: number;
};

export type Category = {
  id: string;
  tenant_id: string;
  name: string;
  color: string;
};

export type Notification = {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  type: string;
  link: string | null;
  read: boolean;
  created_at: string;
};

export type AuditLog = {
  id: string;
  tenant_id: string | null;
  actor_email: string | null;
  action: string;
  entity: string | null;
  details: any;
  created_at: string;
};

export type CommercialCode = {
  id: string;
  code: string;
  rep_name: string;
  rep_email: string | null;
  region: string | null;
  is_active: boolean;
  total_sales: number;
  total_revenue: number;
};

export type BlogPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  author: string;
  cover_url: string | null;
  published: boolean;
  published_at: string | null;
};

export type JobPosting = {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  type: string;
  description: string;
  requirements: string | null;
  salary_range: string | null;
  published: boolean;
};

export type ContactMessage = {
  id: string;
  name: string;
  email: string;
  subject: string | null;
  message: string;
  handled: boolean;
  created_at: string;
};

export const MODULES = [
  'dashboard', 'pos', 'products', 'stock', 'stores', 'invoices',
  'deliveries', 'customers', 'suppliers', 'expenses', 'purchases',
  'quotes', 'reports', 'accounting', 'users', 'administration', 'marketplace', 'settings',
] as const;
export type ModuleCode = (typeof MODULES)[number];

export const PERMISSION_ACTIONS = ['view', 'create', 'update', 'delete'] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type Permissions = Partial<Record<ModuleCode, Partial<Record<PermissionAction, boolean>>>>;

// Default permissions for built-in roles
export const DEFAULT_PERMISSIONS: Record<Role, Permissions> = {
  super_admin: Object.fromEntries(
    MODULES.map((m) => [m, Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, true]))])
  ) as Permissions,
  admin: Object.fromEntries(
    MODULES.map((m) => [m, Object.fromEntries(PERMISSION_ACTIONS.map((a) => [a, true]))])
  ) as Permissions,
  manager: {
    dashboard: { view: true }, pos: { view: true, create: true, update: true },
    products: { view: true, create: true, update: true }, stock: { view: true, create: true, update: true },
    stores: { view: true }, invoices: { view: true, create: true, update: true },
    deliveries: { view: true, create: true, update: true }, customers: { view: true, create: true, update: true },
    suppliers: { view: true }, expenses: { view: true, create: true, update: true },
    purchases: { view: true, create: true }, quotes: { view: true, create: true, update: true },
    reports: { view: true }, accounting: { view: true }, users: { view: true },
    marketplace: { view: true }, administration: {}, settings: { view: true, update: true },
  } as Permissions,
  staff: {
    dashboard: { view: true }, pos: { view: true, create: true },
    products: { view: true }, stock: { view: true },
    stores: { view: true }, invoices: { view: true },
    deliveries: { view: true }, customers: { view: true, create: true, update: true },
    suppliers: { view: true }, expenses: { view: true },
    purchases: {}, quotes: { view: true, create: true },
    reports: {}, accounting: {}, users: {},
    marketplace: { view: true }, administration: {}, settings: { view: true },
  } as Permissions,
  viewer: {
    dashboard: { view: true }, pos: { view: true },
    products: { view: true }, stock: { view: true },
    stores: { view: true }, invoices: { view: true },
    deliveries: { view: true }, customers: { view: true },
    suppliers: { view: true }, expenses: { view: true },
    purchases: {}, quotes: { view: true },
    reports: { view: true }, accounting: {},
    users: {}, marketplace: { view: true }, administration: {}, settings: { view: true },
  } as Permissions,
};
