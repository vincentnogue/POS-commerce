-- Rate limiting for edge functions that cost real money per call (AI
-- generation, SMS/WhatsApp, payment initiation, shipping) or that could
-- be used to harass real people (payment prompts, bulk messages).
--
-- Found missing during the security audit that fixed 9 edge functions'
-- tenant-isolation bugs (see migration 0084-adjacent commits): even with
-- tenant isolation fixed, a tenant's OWN compromised session, a buggy
-- integration, or a malicious staff member could still call
-- ai-generate/notifications-twilio/mpesa-payments/etc. in a tight loop
-- and run up a real bill (OpenAI, Twilio) or spam real phone numbers
-- with payment prompts, with nothing to stop them.
--
-- Design: a fixed-window counter per (tenant_id, function_name, window).
-- Simple and sufficient for this — these are low-frequency, human-paced
-- actions (a cashier ringing up a sale, a manager sending a campaign),
-- not a high-throughput API, so a basic window counter avoids the
-- complexity of a sliding-window/token-bucket implementation for a
-- problem that doesn't need it here.

CREATE TABLE IF NOT EXISTS public.function_rate_limits (
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  function_name TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  call_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (tenant_id, function_name, window_start)
);

-- No RLS needed for direct client access — this table is only ever
-- touched by edge functions via the service-role key (RLS is bypassed
-- either way), same as integration_credentials. Enabling RLS with no
-- policies still blocks any accidental anon/authenticated access.
ALTER TABLE public.function_rate_limits ENABLE ROW LEVEL SECURITY;

-- Atomically checks and increments the call count for the current
-- window. Returns true if the call is allowed (and counts it), false if
-- the limit was already reached (does NOT count the rejected call).
-- p_window_minutes buckets time into fixed windows (e.g. 60 = hourly);
-- p_max_calls is the limit per window.
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_tenant_id UUID,
  p_function_name TEXT,
  p_max_calls INT,
  p_window_minutes INT
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window_start TIMESTAMPTZ;
  v_current_count INT;
BEGIN
  -- Bucket "now" into a fixed window start, e.g. with a 60-minute window,
  -- 14:37 and 14:52 both fall in the 14:00 window.
  v_window_start := date_trunc('hour', now())
    - (EXTRACT(MINUTE FROM now())::INT % p_window_minutes) * INTERVAL '1 minute';

  INSERT INTO public.function_rate_limits (tenant_id, function_name, window_start, call_count)
  VALUES (p_tenant_id, p_function_name, v_window_start, 1)
  ON CONFLICT (tenant_id, function_name, window_start)
  DO UPDATE SET call_count = function_rate_limits.call_count + 1
  WHERE function_rate_limits.call_count < p_max_calls
  RETURNING call_count INTO v_current_count;

  -- If the UPDATE's WHERE clause excluded the row (limit already
  -- reached), RETURNING gives no row, so v_current_count stays NULL and
  -- the INSERT's ON CONFLICT DO NOTHING-like path already happened
  -- (the count was not incremented) — this call is rejected.
  RETURN v_current_count IS NOT NULL;
END;
$$;

-- Old windows accumulate forever otherwise (one row per tenant per
-- function per window, indefinitely) — this is invoked lazily to trim
-- old windows rather than needing a cron job.
CREATE OR REPLACE FUNCTION public.cleanup_old_rate_limit_windows() RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM public.function_rate_limits WHERE window_start < now() - INTERVAL '7 days';
$$;
