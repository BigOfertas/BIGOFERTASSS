BEGIN;

CREATE TABLE IF NOT EXISTS public.edge_rate_limits (
  scope text NOT NULL,
  key_hash text NOT NULL,
  window_start timestamptz NOT NULL,
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (scope, key_hash)
);

COMMENT ON TABLE public.edge_rate_limits IS
  'Server-only fixed-window counters used by Supabase Edge Functions. Identifiers are SHA-256 hashes; raw IPs/emails are not stored.';

ALTER TABLE public.edge_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.edge_rate_limits FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.edge_rate_limits TO service_role;

CREATE OR REPLACE FUNCTION public.consume_edge_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS TABLE (
  allowed boolean,
  remaining integer,
  retry_after_seconds integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry integer;
BEGIN
  IF p_scope IS NULL OR length(p_scope) < 1 OR length(p_scope) > 80 THEN
    RAISE EXCEPTION 'invalid rate-limit scope';
  END IF;
  IF p_key_hash IS NULL OR p_key_hash !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'invalid rate-limit key';
  END IF;
  IF p_limit < 1 OR p_limit > 10000 THEN
    RAISE EXCEPTION 'invalid rate-limit limit';
  END IF;
  IF p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid rate-limit window';
  END IF;

  v_window_start := to_timestamp(
    floor(extract(epoch FROM v_now) / p_window_seconds) * p_window_seconds
  );

  INSERT INTO public.edge_rate_limits AS limits (
    scope,
    key_hash,
    window_start,
    request_count,
    updated_at
  )
  VALUES (
    p_scope,
    p_key_hash,
    v_window_start,
    1,
    v_now
  )
  ON CONFLICT (scope, key_hash) DO UPDATE
  SET
    window_start = CASE
      WHEN limits.window_start < EXCLUDED.window_start THEN EXCLUDED.window_start
      ELSE limits.window_start
    END,
    request_count = CASE
      WHEN limits.window_start < EXCLUDED.window_start THEN 1
      ELSE limits.request_count + 1
    END,
    updated_at = v_now
  RETURNING request_count INTO v_count;

  v_retry := GREATEST(
    1,
    CEIL(EXTRACT(epoch FROM (v_window_start + make_interval(secs => p_window_seconds) - v_now)))::integer
  );

  RETURN QUERY SELECT
    v_count <= p_limit,
    GREATEST(0, p_limit - v_count),
    CASE WHEN v_count <= p_limit THEN 0 ELSE v_retry END;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_edge_rate_limit(text, text, integer, integer)
  TO service_role;

COMMIT;
