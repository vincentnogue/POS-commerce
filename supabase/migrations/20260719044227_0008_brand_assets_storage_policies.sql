/*
# Storage policies for brand-assets bucket

## Summary
Allows authenticated tenant members to upload/read/delete brand assets
(logos, stamps) in their tenant folder: brand-assets/{tenant_id}/...

## Security
- SELECT (read): public, since logos appear on public invoices
- INSERT/UPDATE/DELETE: authenticated users who are members of the tenant
*/

drop policy if exists "brand_assets_public_read" on storage.objects;
create policy "brand_assets_public_read" on storage.objects for select
  to public using (bucket_id = 'brand-assets');

drop policy if exists "brand_assets_member_upload" on storage.objects;
create policy "brand_assets_member_upload" on storage.objects for insert
  to authenticated with check (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
      and (storage.foldername(name))[1] = tm.tenant_id::text
    )
  );

drop policy if exists "brand_assets_member_update" on storage.objects;
create policy "brand_assets_member_update" on storage.objects for update
  to authenticated using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
      and (storage.foldername(name))[1] = tm.tenant_id::text
    )
  );

drop policy if exists "brand_assets_member_delete" on storage.objects;
create policy "brand_assets_member_delete" on storage.objects for delete
  to authenticated using (
    bucket_id = 'brand-assets'
    and exists (
      select 1 from public.tenant_members tm
      where tm.user_id = auth.uid()
      and (storage.foldername(name))[1] = tm.tenant_id::text
    )
  );