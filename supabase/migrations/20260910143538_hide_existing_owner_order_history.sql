BEGIN;

-- Owner requested that all orders created before this cutoff disappear from
-- the owner's frontend history while preserving the underlying order records
-- and the human order-number sequence. Future orders remain visible normally.

CREATE OR REPLACE FUNCTION public.admin_list_orders(
  p_search text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_sort text DEFAULT 'newest',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  public_number text,
  status text,
  payment_status text,
  customer_name text,
  customer_email text,
  customer_phone text,
  total_amount numeric,
  currency text,
  item_count bigint,
  refund_request_id uuid,
  refund_status text,
  refund_reason text,
  refund_created_at timestamptz,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_search text := NULLIF(btrim(p_search), '');
  normalized_status text := lower(COALESCE(NULLIF(btrim(p_status), ''), 'all'));
  normalized_sort text := lower(COALESCE(NULLIF(btrim(p_sort), ''), 'newest'));
  safe_page integer := GREATEST(COALESCE(p_page, 1), 1);
  safe_page_size integer := LEAST(GREATEST(COALESCE(p_page_size, 20), 1), 50);
BEGIN
  IF NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao proprietario';
  END IF;

  IF normalized_sort NOT IN ('newest', 'oldest', 'total_desc', 'total_asc') THEN
    normalized_sort := 'newest';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    o.public_number,
    o.status::text,
    o.payment_status::text,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.total_amount,
    o.currency,
    (SELECT COALESCE(sum(oi.quantity), 0)::bigint FROM public.order_items AS oi WHERE oi.order_id = o.id),
    request_record.id,
    request_record.status::text,
    request_record.reason,
    request_record.created_at,
    o.created_at,
    count(*) OVER ()
  FROM public.orders AS o
  LEFT JOIN public.refund_requests AS request_record
    ON request_record.order_id = o.id
  WHERE o.created_at >= '2026-09-10T14:35:38Z'::timestamptz
    AND (
      normalized_search IS NULL
      OR o.public_number ILIKE '%' || normalized_search || '%'
      OR o.customer_name ILIKE '%' || normalized_search || '%'
      OR o.customer_email ILIKE '%' || normalized_search || '%'
      OR (
        regexp_replace(normalized_search, '[^0-9]', '', 'g') <> ''
        AND o.customer_phone ILIKE '%' || regexp_replace(normalized_search, '[^0-9]', '', 'g') || '%'
      )
    )
    AND (
      normalized_status = 'all'
      OR (normalized_status = 'refund_requested' AND request_record.status = 'requested'::public.refund_request_status)
      OR (normalized_status = 'refund_canceled' AND request_record.status = 'canceled'::public.refund_request_status)
      OR o.status::text = normalized_status
    )
  ORDER BY
    CASE WHEN normalized_sort = 'oldest' THEN o.created_at END ASC,
    CASE WHEN normalized_sort = 'total_desc' THEN o.total_amount END DESC,
    CASE WHEN normalized_sort = 'total_asc' THEN o.total_amount END ASC,
    CASE WHEN normalized_sort = 'newest' THEN o.created_at END DESC,
    o.id DESC
  LIMIT safe_page_size
  OFFSET (safe_page - 1) * safe_page_size;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_orders(text, text, text, integer, integer)
FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_orders(text, text, text, integer, integer)
TO authenticated;

COMMIT;
