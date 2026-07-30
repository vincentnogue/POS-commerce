-- Customer support chat: an AI assistant answers platform questions by
-- default; the visitor can request a human at any point, which routes the
-- conversation into the Super Admin "Support client" queue for a real
-- agent to take over. Works for both anonymous site visitors (pre-signup)
-- and logged-in tenant users.
--
-- All access goes through edge functions (service role) rather than
-- direct client RLS policies — anonymous visitors have no auth.uid() to
-- scope rows to, so this table is intentionally locked to service_role
-- only, same pattern as platform_admins/platform_staff.

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  visitor_token text not null unique, -- random id generated client-side, stored in localStorage
  tenant_id uuid references public.tenants(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  visitor_name text,
  visitor_email text,
  status text not null default 'ai' check (status in ('ai', 'pending_human', 'active', 'closed')),
  assigned_admin_email text,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender text not null check (sender in ('visitor', 'ai', 'agent')),
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists support_conversations_status_idx on public.support_conversations (status, last_message_at desc);
create index if not exists support_messages_conversation_idx on public.support_messages (conversation_id, created_at);

alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;
-- No client-facing policies by design — every read/write goes through the
-- support-chat (visitor side) and support-agent (Super Admin side) edge
-- functions, which apply their own authorization logic.
