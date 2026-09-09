-- Compliance gap found during a GDPR/anti-spam audit of the Messages
-- feature (bulk SMS/WhatsApp to customers, see MessagesPage.tsx): there
-- was no way to mark a customer as having opted out of marketing
-- contact, so a bulk send to "all customers" or a tier/segment had no
-- way to exclude someone who had asked not to be contacted — a real
-- violation of GDPR Article 21 (right to object to marketing) and of
-- anti-spam rules (CAN-SPAM, CASL, and similar) that require honoring
-- opt-out requests, not just an oversight.
--
-- Scoped to marketing/bulk contact only — this does NOT apply to
-- transactional messages (a POS receipt, an invoice or quote sent to
-- that specific customer), which are service communications tied to a
-- transaction the customer themselves initiated, not marketing, and are
-- exempt from marketing opt-out rules in virtually every jurisdiction
-- that has them.
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS marketing_opt_out BOOLEAN NOT NULL DEFAULT false;
