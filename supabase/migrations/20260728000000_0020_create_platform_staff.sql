-- Platform staff: LiAfrik employees who need partial access to the Super
-- Admin dashboard (e.g. a support agent), distinct from platform_admins
-- (full, unrestricted access — can manage other admins, delete tenants,
-- etc.). Staff access is scoped to specific sections via `permissions`.
--
-- IMPORTANT ARCHITECTURAL NOTE: granting a staff member ANY section still
-- requires giving their account the tenant_members.role = 'super_admin'
-- role, because is_super_admin() is the RLS bypass used throughout the
-- schema for platform-wide reads. This means restriction to specific
-- sections is enforced at the UI layer and at the edge-function layer for
-- WRITE actions (see platform-staff-manage, super-admin-manage,
-- broadcast-notification) — not at the raw table-read RLS layer. A staff
-- member is fully trusted platform personnel, not an untrusted third
-- party; this is the same trust model most internal admin tools use
-- (support staff can technically query more via the DB than the UI
-- shows them, but cannot perform destructive/sensitive actions outside
-- their granted permissions). The 'admins' section (managing other
-- Super Admins) can NEVER be granted to staff — only platform_admins.

create table if not exists public.platform_staff (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  label text,
  permissions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by text
);

alter table public.platform_staff enable row level security;
-- No client-facing policies: only edge functions (service role) read/write this.
