-- Fase 06 — Carrinho definitivo
-- Read-only validation endpoint for cart lines. This function does not reserve,
-- decrement or mutate stock; transactional stock remains a later phase.

CREATE OR REPLACE FUNCTION public.validate_cart_items(p_items jsonb)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
WITH requested AS (
  SELECT
    item_position,
    item,
    item->>'line_id' AS line_id,
    CASE
      WHEN COALESCE(item->>'product_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (item->>'product_id')::uuid
      ELSE NULL
    END AS product_id,
    CASE
      WHEN COALESCE(item->>'variant_id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      THEN (item->>'variant_id')::uuid
      ELSE NULL
    END AS requested_variant_id
  FROM jsonb_array_elements(
    CASE WHEN jsonb_typeof(p_items) = 'array' THEN p_items ELSE '[]'::jsonb END
  ) WITH ORDINALITY AS input(item, item_position)
  LIMIT 100
), resolved AS (
  SELECT
    r.item_position,
    r.line_id,
    r.requested_variant_id,
    p.id AS product_id,
    p.slug AS product_slug,
    p.name AS product_name,
    v.id AS variant_id,
    v.sku AS variant_sku,
    v.name AS variant_name,
    v.stock_quantity AS available_stock,
    CASE
      WHEN v.id IS NULL OR p.id IS NULL THEN NULL
      ELSE COALESCE(
        v.promotional_price_override,
        CASE WHEN v.price_override IS NULL THEN p.promotional_price ELSE NULL END,
        v.price_override,
        p.price
      )
    END AS unit_price,
    CASE
      WHEN r.product_id IS NULL THEN 'unavailable'
      WHEN p.id IS NULL THEN 'unavailable'
      WHEN r.requested_variant_id IS NULL
        AND EXISTS (
          SELECT 1
          FROM public.product_options po
          WHERE po.product_id = p.id
            AND po.is_required = true
        ) THEN 'needs_review'
      WHEN v.id IS NULL THEN 'unavailable'
      WHEN v.stock_quantity <= 0 THEN 'out_of_stock'
      ELSE 'available'
    END AS cart_status
  FROM requested r
  LEFT JOIN public.products p
    ON p.id = r.product_id
   AND p.status = 'active'
  LEFT JOIN LATERAL (
    SELECT candidate.*
    FROM public.product_variants candidate
    WHERE candidate.product_id = p.id
      AND candidate.status = 'active'
      AND (
        r.requested_variant_id IS NULL
        OR candidate.id = r.requested_variant_id
      )
    ORDER BY
      CASE
        WHEN r.requested_variant_id IS NOT NULL
          AND candidate.id = r.requested_variant_id THEN 0
        WHEN candidate.is_default THEN 1
        ELSE 2
      END,
      candidate.sort_order,
      candidate.created_at
    LIMIT 1
  ) v ON true
)
SELECT COALESCE(
  jsonb_agg(
    jsonb_build_object(
      'line_id', COALESCE(line_id, ''),
      'product_id', product_id,
      'product_slug', product_slug,
      'product_name', product_name,
      'variant_id', variant_id,
      'variant_sku', variant_sku,
      'variant_name', variant_name,
      'unit_price', unit_price,
      'available_stock', available_stock,
      'status', cart_status
    )
    ORDER BY item_position
  ),
  '[]'::jsonb
)
FROM resolved;
$$;

REVOKE ALL ON FUNCTION public.validate_cart_items(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_cart_items(jsonb) TO anon, authenticated, service_role;

COMMENT ON FUNCTION public.validate_cart_items(jsonb) IS
  'Validates up to 100 cart lines against active products/variants and returns current estimated price and stock without reserving or changing stock.';
