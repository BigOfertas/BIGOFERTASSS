BEGIN;

-- BIGofertas — Google Photos como origem externa definitiva das imagens de produto.
ALTER TABLE public.product_images
  ALTER COLUMN storage_key DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS external_url text,
  ADD COLUMN IF NOT EXISTS image_source text NOT NULL DEFAULT 'r2';

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_source_key text,
  ADD COLUMN IF NOT EXISTS catalog_source_title text;

ALTER TABLE public.product_variants
  ADD COLUMN IF NOT EXISTS catalog_source_title text;

UPDATE public.product_images
SET image_source = CASE
  WHEN external_url IS NOT NULL THEN 'external'
  ELSE 'r2'
END
WHERE image_source IS NULL
   OR image_source NOT IN ('r2','google_photos','external');

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_exactly_one_source'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_exactly_one_source
      CHECK (num_nonnulls(storage_key, external_url) = 1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_external_url_https'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_external_url_https
      CHECK (external_url IS NULL OR external_url ~ '^https://[^[:space:]]+$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_image_source_valid'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_image_source_valid
      CHECK (image_source IN ('r2','google_photos','external'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_source_consistency'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_source_consistency
      CHECK (
        (image_source = 'r2' AND storage_key IS NOT NULL AND external_url IS NULL)
        OR
        (image_source IN ('google_photos','external') AND storage_key IS NULL AND external_url IS NOT NULL)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_google_photos_host'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_google_photos_host
      CHECK (
        image_source <> 'google_photos'
        OR external_url ~ '^https://lh[0-9]+\.googleusercontent\.com/'
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_catalog_source_key_not_blank'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_catalog_source_key_not_blank
      CHECK (catalog_source_key IS NULL OR length(btrim(catalog_source_key)) > 0);
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS products_catalog_source_key_uidx
  ON public.products (catalog_source_key)
  WHERE catalog_source_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS product_images_external_source_idx
  ON public.product_images (product_id, variant_id, sort_order, created_at)
  WHERE external_url IS NOT NULL
    AND status = 'ready'::public.product_image_status;

-- Mantém a RPC v3 e seus consumidores, mas passa a devolver também a origem externa.
CREATE OR REPLACE FUNCTION public.catalog_products_page_v3(
  p_query text DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_campeonato text DEFAULT NULL,
  p_liga text DEFAULT NULL,
  p_time text DEFAULT NULL,
  p_season text DEFAULT NULL,
  p_brand text DEFAULT NULL,
  p_audience text DEFAULT NULL,
  p_commercial_type text DEFAULT NULL,
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_sort text DEFAULT 'newest',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 24
)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT public.catalog_products_page_v2(
      p_query, p_category, p_campeonato, p_liga, p_time,
      p_season, p_brand, p_audience, p_commercial_type,
      p_min_price, p_max_price, p_sort, p_page, p_page_size
    ) AS payload
  ),
  enriched_items AS (
    SELECT COALESCE(
      jsonb_agg(
        rows.item || jsonb_build_object(
          'image_storage_key', image.storage_key,
          'image_card_storage_key', image.card_storage_key,
          'image_thumb_storage_key', image.thumb_storage_key,
          'image_external_url', image.external_url,
          'image_source', image.image_source
        )
        ORDER BY rows.ordinal
      ),
      '[]'::jsonb
    ) AS items
    FROM base
    CROSS JOIN LATERAL jsonb_array_elements(base.payload->'items')
      WITH ORDINALITY AS rows(item, ordinal)
    LEFT JOIN LATERAL (
      SELECT
        i.storage_key,
        i.card_storage_key,
        i.thumb_storage_key,
        i.external_url,
        i.image_source
      FROM public.product_images i
      LEFT JOIN public.product_variants pv ON pv.id = i.variant_id
      WHERE i.product_id = (rows.item->>'id')::uuid
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
  )
  SELECT jsonb_set(base.payload, '{items}', enriched_items.items, true)
  FROM base
  CROSS JOIN enriched_items;
$$;

REVOKE ALL ON FUNCTION public.catalog_products_page_v3(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page_v3(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.storefront_product_detail_v2(p_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH base AS (
    SELECT public.storefront_product_detail_v1(p_identifier) AS payload
  ),
  target AS (
    SELECT
      base.payload,
      CASE
        WHEN base.payload IS NULL OR base.payload->'product'->>'id' IS NULL THEN NULL
        ELSE (base.payload->'product'->>'id')::uuid
      END AS product_id
    FROM base
  ),
  image_values AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'product_id', i.product_id,
          'variant_id', i.variant_id,
          'storage_key', i.storage_key,
          'card_storage_key', i.card_storage_key,
          'thumb_storage_key', i.thumb_storage_key,
          'external_url', i.external_url,
          'image_source', i.image_source,
          'original_filename', i.original_filename,
          'alt_text', i.alt_text,
          'mime_type', i.mime_type,
          'status', i.status,
          'is_primary', i.is_primary,
          'sort_order', i.sort_order,
          'byte_size', i.byte_size,
          'checksum_sha256', i.checksum_sha256,
          'etag', i.etag,
          'width_px', i.width_px,
          'height_px', i.height_px,
          'catalog_source_key', i.catalog_source_key,
          'created_at', i.created_at,
          'updated_at', i.updated_at
        )
        ORDER BY
          (i.variant_id IS NULL) DESC,
          i.is_primary DESC,
          i.sort_order ASC,
          i.created_at ASC,
          i.id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM target t
    JOIN public.product_images i ON i.product_id = t.product_id
    WHERE i.status = 'ready'::public.product_image_status
  )
  SELECT CASE
    WHEN target.payload IS NULL THEN NULL
    ELSE jsonb_set(target.payload, '{images}', image_values.value, true)
  END
  FROM target
  CROSS JOIN image_values;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_detail_v2(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_product_detail_v2(text) TO anon, authenticated;

COMMENT ON COLUMN public.product_images.external_url IS
  'URL HTTPS externa da imagem. Para o novo catálogo, Google Photos usa lh*.googleusercontent.com.';
COMMENT ON COLUMN public.product_images.image_source IS
  'Origem da imagem: r2, google_photos ou external.';
COMMENT ON FUNCTION public.storefront_product_detail_v2(text) IS
  'Detalhe público com galeria compatível com R2 e múltiplas URLs externas.';

COMMIT;
