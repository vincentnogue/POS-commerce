-- BUG: Twilio's auth_schema collected `phone_number`, but
-- notifications-twilio reads `parsed.from_number` (and `parsed.
-- from_whatsapp`, never collected at all) -- a field-name mismatch of the
-- same kind already fixed for mpesa/orange_money. `fromNumber` would
-- always be undefined, so SMS sending would fail every time on the
-- function's own `if (!fromNumber) return error` guard, and WhatsApp
-- receipts (POSPage.tsx's auto_send_receipt_whatsapp path, which
-- genuinely calls this function) had no field to configure a From
-- WhatsApp number at all.
update public.integration_providers
set auth_schema = '{"type":"object","properties":{"account_sid":{"type":"string","title":"Account SID"},"auth_token":{"type":"string","title":"Auth Token"},"from_number":{"type":"string","title":"Numéro d''envoi SMS (format E.164, ex: +15551234567)"},"from_whatsapp":{"type":"string","title":"Numéro WhatsApp Business (optionnel, format E.164)"}},"required":["account_sid","auth_token","from_number"]}'::jsonb
where provider_key = 'twilio';
