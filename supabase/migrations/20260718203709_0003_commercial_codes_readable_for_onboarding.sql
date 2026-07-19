/*
# Allow authenticated users to verify commercial codes during onboarding

## Problem
The commercial_codes SELECT policy was restricted to super_admin only. During
onboarding, a new tenant enters an optional commercial code and the app queries
commercial_codes to verify it. With super_admin-only SELECT, that query always
returns empty for a normal authenticated user, so every code appears invalid.

## Fix
- SELECT policy now allows any authenticated user to read commercial_codes
  (the codes are non-sensitive tracking identifiers; write access stays
  super-admin-only).
- INSERT/UPDATE/DELETE remain super_admin-only (unchanged).

## Security
- commercial_codes contain only a code string, rep name, region, and aggregate
  counters — no secrets. Read access for authenticated users is safe and
  required for the onboarding verification flow.
*/

drop policy if exists "commercial_codes_select_auth" on public.commercial_codes;
create policy "commercial_codes_select_auth" on public.commercial_codes for select
  to authenticated using (true);