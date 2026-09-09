BEGIN;

-- BIGofertas — mantém a seção "Lançamentos" independente da ordem de novas importações.
-- Os dez produtos do primeiro álbum definitivo permanecem fixos nas posições 1–10;
-- novos lotes entram no catálogo normalmente sem deslocar essa vitrine.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS launch_position smallint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'products_launch_position_positive'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_launch_position_positive
      CHECK (launch_position IS NULL OR launch_position > 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS products_launch_position_uidx
  ON public.products (launch_position)
  WHERE launch_position IS NOT NULL;

UPDATE public.products
SET launch_position = CASE catalog_code
  WHEN 'P000001' THEN 1
  WHEN 'P000002' THEN 2
  WHEN 'P000003' THEN 3
  WHEN 'P000004' THEN 4
  WHEN 'P000005' THEN 5
  WHEN 'P000006' THEN 6
  WHEN 'P000007' THEN 7
  WHEN 'P000008' THEN 8
  WHEN 'P000009' THEN 9
  WHEN 'P000010' THEN 10
  ELSE NULL
END
WHERE launch_position IS NOT NULL
   OR catalog_code BETWEEN 'P000001' AND 'P000010';

CREATE OR REPLACE FUNCTION public.storefront_launch_products()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH launch_rows AS (
    SELECT
      p.id,
      p.slug,
      p.name,
      p.price,
      p.promotional_price,
      p.stock,
      p.category,
      p.campeonato,
      p.liga,
      p.time,
      p.season,
      p.brand,
      p.audience,
      COALESCE(pps.commercial_type, 'other') AS commercial_type,
      p.created_at,
      p.launch_position,
      image.storage_key AS image_storage_key,
      image.card_storage_key AS image_card_storage_key,
      image.thumb_storage_key AS image_thumb_storage_key,
      image.external_url AS image_external_url,
      image.image_source,
      p.image_url AS fallback_image_url
    FROM public.products p
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    LEFT JOIN LATERAL (
      SELECT
        i.storage_key,
        i.card_storage_key,
        i.thumb_storage_key,
        i.external_url,
        i.image_source
      FROM public.product_images i
      LEFT JOIN public.product_variants pv ON pv.id = i.variant_id
      WHERE i.product_id = p.id
        AND i.status = 'ready'::public.product_image_status
      ORDER BY
        (i.variant_id IS NULL) DESC,
        COALESCE(pv.is_default, false) DESC,
        i.is_primary DESC,
        i.sort_order ASC,
        i.created_at ASC,
        i.id ASC
      LIMIT 1
    ) image ON true
    WHERE p.status = 'active'::public.product_status
      AND p.launch_position BETWEEN 1 AND 10
    ORDER BY p.launch_position ASC
    LIMIT 10
  ),
  items AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', row.id,
          'slug', row.slug,
          'name', row.name,
          'price', row.price,
          'promotional_price', row.promotional_price,
          'stock', row.stock,
          'category', row.category,
          'campeonato', row.campeonato,
          'liga', row.liga,
          'time', row.time,
          'season', row.season,
          'brand', row.brand,
          'audience', row.audience,
          'commercial_type', row.commercial_type,
          'created_at', row.created_at,
          'image_storage_key', row.image_storage_key,
          'image_card_storage_key', row.image_card_storage_key,
          'image_thumb_storage_key', row.image_thumb_storage_key,
          'image_external_url', row.image_external_url,
          'image_source', row.image_source,
          'fallback_image_url', row.fallback_image_url
        ) ORDER BY row.launch_position
      ),
      '[]'::jsonb
    ) AS value
    FROM launch_rows row
  )
  SELECT jsonb_build_object(
    'items', items.value,
    'total', jsonb_array_length(items.value),
    'page', 1,
    'pageSize', 10,
    'totalPages', CASE WHEN jsonb_array_length(items.value) = 0 THEN 0 ELSE 1 END
  )
  FROM items;
$$;

REVOKE ALL ON FUNCTION public.storefront_launch_products() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_launch_products() TO anon, authenticated;

COMMIT;
