-- products.image_url has existed since the initial schema and the POS
-- already renders it (POSPage.tsx), but there was never a storage bucket
-- or upload path for it, so the field could never actually be filled in.
-- This adds a dedicated bucket for product photos, following the same
-- pattern already used for brand-assets (0008/0016).

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

-- SELECT (read): public, since product photos appear in the POS grid and
-- on public storefront/marketplace listings.
-- INSERT/UPDATE/DELETE: authenticated users who are members of the tenant
-- that owns the {tenant_id}/... folder, same rule as brand-assets.

drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read" on storage.objects for select
  to public using (bucket_id = 'product-images');

drop policy if exists "product_images_member_upload" on storage.objects;
create policy "product_images_member_upload" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
      and (storage.foldername(name))[1] = tm.tenant_id::text
    )
  );

drop policy if exists "product_images_member_update" on storage.objects;
create policy "product_images_member_update" on storage.objects for update
  to authenticated using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
      and (storage.foldername(name))[1] = tm.tenant_id::text
    )
  );

drop policy if exists "product_images_member_delete" on storage.objects;
create policy "product_images_member_delete" on storage.objects for delete
  to authenticated using (
    bucket_id = 'product-images'
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
      and (storage.foldername(name))[1] = tm.tenant_id::text
    )
  );
