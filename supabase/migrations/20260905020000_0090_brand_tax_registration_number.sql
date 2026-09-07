-- International tax compliance gap: most jurisdictions require the
-- ISSUING business's own tax/VAT/company registration number to appear
-- on any invoice they issue (SIRET/SIREN in France, VAT number across
-- the EU, company registration number in the UK, etc.). The customer's
-- own tax_id already renders correctly on generated invoices (see
-- invoicePdf.ts, "NIF/Reg" line) — but there was nowhere for the
-- merchant to enter THEIR OWN business's number, so it could never
-- appear on invoices they generate. Every invoice this platform has
-- ever produced is missing a field many countries legally require.
--
-- Lives on brand_settings (not tenants) because it's part of the same
-- "how your business identity appears on documents" group as
-- phone/address/email/logo, edited together in Settings > Contact.
ALTER TABLE public.brand_settings
  ADD COLUMN IF NOT EXISTS tax_registration_number TEXT;
