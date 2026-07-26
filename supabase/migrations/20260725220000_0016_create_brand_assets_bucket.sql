-- The brand-assets storage BUCKET itself was never created — only its RLS
-- policies were (migration 0008), which is why uploads failed with
-- "Bucket not found" even though the policies looked correct.

insert into storage.buckets (id, name, public)
values ('brand-assets', 'brand-assets', true)
on conflict (id) do nothing;
