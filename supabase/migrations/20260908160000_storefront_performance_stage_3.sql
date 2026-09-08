BEGIN;

-- BIGofertas — Etapa 3
-- Derivados de imagem, detalhe público em uma RPC e metadados públicos de compartilhamento.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS card_storage_key text,
  ADD COLUMN IF NOT EXISTS thumb_storage_key text,
  ADD COLUMN IF NOT EXISTS card_width_px integer,
  ADD COLUMN IF NOT EXISTS card_height_px integer,
  ADD COLUMN IF NOT EXISTS thumb_width_px integer,
  ADD COLUMN IF NOT EXISTS thumb_height_px integer,
  ADD COLUMN IF NOT EXISTS card_byte_size bigint,
  ADD COLUMN IF NOT EXISTS thumb_byte_size bigint;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_card_storage_key_relative'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_card_storage_key_relative
      CHECK (
        card_storage_key IS NULL
        OR (
          length(btrim(card_storage_key)) BETWEEN 3 AND 512
          AND card_storage_key !~ '^/'
          AND card_storage_key !~ '(^|/)\.\.(/|$)'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_thumb_storage_key_relative'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_thumb_storage_key_relative
      CHECK (
        thumb_storage_key IS NULL
        OR (
          length(btrim(thumb_storage_key)) BETWEEN 3 AND 512
          AND thumb_storage_key !~ '^/'
          AND thumb_storage_key !~ '(^|/)\.\.(/|$)'
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_card_dimensions_valid'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_card_dimensions_valid
      CHECK (
        (card_width_px IS NULL AND card_height_px IS NULL)
        OR (card_width_px > 0 AND card_height_px > 0)
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'product_images_thumb_dimensions_valid'
      AND conrelid = 'public.product_images'::regclass
  ) THEN
    ALTER TABLE public.product_images
      ADD CONSTRAINT product_images_thumb_dimensions_valid
      CHECK (
        (thumb_width_px IS NULL AND thumb_height_px IS NULL)
        OR (thumb_width_px > 0 AND thumb_height_px > 0)
      );
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_card_storage_key_unique
  ON public.product_images (card_storage_key)
  WHERE card_storage_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_thumb_storage_key_unique
  ON public.product_images (thumb_storage_key)
  WHERE thumb_storage_key IS NOT NULL;

CREATE OR REPLACE FUNCTION public.catalog_products_page_v2(
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
  WITH params AS (
    SELECT
      NULLIF(public.catalog_normalize_text(p_query), '') AS query_text,
      NULLIF(btrim(lower(COALESCE(p_category, ''))), '') AS category_slug,
      NULLIF(public.catalog_filter_key(p_campeonato), '') AS campeonato_key,
      NULLIF(public.catalog_filter_key(p_liga), '') AS liga_key,
      NULLIF(public.catalog_filter_key(p_time), '') AS time_key,
      NULLIF(public.catalog_filter_key(p_season), '') AS season_key,
      NULLIF(public.catalog_filter_key(p_brand), '') AS brand_key,
      NULLIF(public.catalog_filter_key(p_audience), '') AS audience_key,
      NULLIF(public.catalog_filter_key(p_commercial_type), '') AS commercial_type_key,
      GREATEST(COALESCE(p_min_price, 0), 0::numeric) AS min_price,
      CASE WHEN p_max_price IS NULL THEN NULL ELSE GREATEST(p_max_price, 0::numeric) END AS max_price,
      CASE WHEN p_sort IN ('newest','price_asc','price_desc','name_asc','name_desc') THEN p_sort ELSE 'newest' END AS sort_key,
      GREATEST(COALESCE(p_page, 1), 1) AS page_number,
      LEAST(GREATEST(COALESCE(p_page_size, 24), 1), 48) AS page_size
  ),
  filtered AS (
    SELECT
      p.id,
      p.slug,
      p.name,
      p.price,
      p.promotional_price,
      COALESCE(p.promotional_price, p.price) AS effective_price,
      p.stock,
      p.category,
      p.campeonato,
      p.liga,
      p.time,
      p.season,
      p.brand,
      p.audience,
      p.created_at,
      COALESCE(pps.commercial_type, 'other') AS commercial_type,
      image.storage_key AS image_storage_key,
      p.image_url AS fallback_image_url
    FROM public.products p
    CROSS JOIN params prm
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    JOIN LATERAL (
      SELECT COALESCE(i.card_storage_key, i.storage_key) AS storage_key
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
      AND (
        prm.query_text IS NULL
        OR p.catalog_search_vector @@ websearch_to_tsquery('simple'::regconfig, prm.query_text)
        OR p.catalog_search_text LIKE '%' || prm.query_text || '%'
      )
      AND (
        prm.category_slug IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.product_categories pc
          JOIN public.categories c ON c.id = pc.category_id
          WHERE pc.product_id = p.id AND c.is_active AND c.slug = prm.category_slug
        )
      )
      AND (prm.campeonato_key IS NULL OR p.campeonato_key = prm.campeonato_key)
      AND (prm.liga_key IS NULL OR p.liga_key = prm.liga_key)
      AND (prm.time_key IS NULL OR p.time_key = prm.time_key)
      AND (prm.season_key IS NULL OR p.season_key = prm.season_key)
      AND (prm.brand_key IS NULL OR p.brand_key = prm.brand_key)
      AND (prm.audience_key IS NULL OR p.audience_key = prm.audience_key)
      AND (
        prm.commercial_type_key IS NULL
        OR public.catalog_filter_key(COALESCE(pps.commercial_type, 'other')) = prm.commercial_type_key
      )
      AND COALESCE(p.promotional_price, p.price) >= prm.min_price
      AND (prm.max_price IS NULL OR COALESCE(p.promotional_price, p.price) <= prm.max_price)
  ),
  ordered AS (
    SELECT f.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN prm.sort_key = 'price_asc' THEN f.effective_price END ASC,
          CASE WHEN prm.sort_key = 'price_desc' THEN f.effective_price END DESC,
          CASE WHEN prm.sort_key = 'name_asc' THEN lower(f.name) END ASC,
          CASE WHEN prm.sort_key = 'name_desc' THEN lower(f.name) END DESC,
          CASE WHEN prm.sort_key = 'newest' THEN f.created_at END DESC,
          f.id ASC
      ) AS ordinal
    FROM filtered f CROSS JOIN params prm
  ),
  page_rows AS (
    SELECT o.* FROM ordered o CROSS JOIN params prm
    WHERE o.ordinal > ((prm.page_number - 1) * prm.page_size)
      AND o.ordinal <= (prm.page_number * prm.page_size)
  ),
  items AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'slug', pr.slug,
      'name', pr.name,
      'price', pr.price,
      'promotional_price', pr.promotional_price,
      'stock', pr.stock,
      'category', pr.category,
      'campeonato', pr.campeonato,
      'liga', pr.liga,
      'time', pr.time,
      'season', pr.season,
      'brand', pr.brand,
      'audience', pr.audience,
      'commercial_type', pr.commercial_type,
      'created_at', pr.created_at,
      'image_storage_key', pr.image_storage_key,
      'fallback_image_url', pr.fallback_image_url
    ) ORDER BY pr.ordinal), '[]'::jsonb) AS value
    FROM page_rows pr
  )
  SELECT jsonb_build_object(
    'items', items.value,
    'total', (SELECT count(*) FROM filtered),
    'page', prm.page_number,
    'pageSize', prm.page_size,
    'totalPages', CASE
      WHEN (SELECT count(*) FROM filtered) = 0 THEN 0
      ELSE ceil((SELECT count(*) FROM filtered)::numeric / prm.page_size)::integer
    END
  )
  FROM params prm CROSS JOIN items;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_detail_v1(p_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH params AS (
    SELECT
      NULLIF(btrim(COALESCE(p_identifier, '')), '') AS identifier,
      CASE
        WHEN btrim(COALESCE(p_identifier, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN btrim(p_identifier)::uuid
        ELSE NULL
      END AS identifier_uuid
  ),
  target AS (
    SELECT p.*
    FROM public.products p
    CROSS JOIN params prm
    WHERE p.status = 'active'::public.product_status
      AND prm.identifier IS NOT NULL
      AND (p.slug = prm.identifier OR p.id = prm.identifier_uuid)
      AND EXISTS (
        SELECT 1
        FROM public.product_images i
        WHERE i.product_id = p.id
          AND i.status = 'ready'::public.product_image_status
      )
    LIMIT 1
  ),
  product_json AS (
    SELECT jsonb_build_object(
      'id', p.id,
      'slug', p.slug,
      'name', p.name,
      'description', p.description,
      'price', p.price,
      'promotional_price', p.promotional_price,
      'status', p.status,
      'primary_category_id', p.primary_category_id,
      'weight_grams', p.weight_grams,
      'length_cm', p.length_cm,
      'width_cm', p.width_cm,
      'height_cm', p.height_cm,
      'image_url', p.image_url,
      'stock', p.stock,
      'category', p.category,
      'campeonato', p.campeonato,
      'liga', p.liga,
      'time', p.time,
      'season', p.season,
      'brand', p.brand,
      'audience', p.audience,
      'specifications', p.specifications,
      'created_at', p.created_at,
      'updated_at', p.updated_at,
      'campeonato_key', p.campeonato_key,
      'liga_key', p.liga_key,
      'time_key', p.time_key,
      'season_key', p.season_key,
      'brand_key', p.brand_key,
      'audience_key', p.audience_key
    ) AS value
    FROM target p
  ),
  category_json AS (
    SELECT to_jsonb(c) AS value
    FROM target p
    JOIN public.categories c ON c.id = p.primary_category_id AND c.is_active
    LIMIT 1
  ),
  images_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', i.id,
        'product_id', i.product_id,
        'variant_id', i.variant_id,
        'storage_key', i.storage_key,
        'card_storage_key', i.card_storage_key,
        'thumb_storage_key', i.thumb_storage_key,
        'original_filename', i.original_filename,
        'alt_text', i.alt_text,
        'mime_type', i.mime_type,
        'status', i.status,
        'is_primary', i.is_primary,
        'sort_order', i.sort_order,
        'width_px', i.width_px,
        'height_px', i.height_px,
        'byte_size', i.byte_size,
        'card_width_px', i.card_width_px,
        'card_height_px', i.card_height_px,
        'card_byte_size', i.card_byte_size,
        'thumb_width_px', i.thumb_width_px,
        'thumb_height_px', i.thumb_height_px,
        'thumb_byte_size', i.thumb_byte_size,
        'etag', i.etag,
        'checksum_sha256', i.checksum_sha256,
        'created_at', i.created_at,
        'updated_at', i.updated_at
      )
      ORDER BY
        (i.variant_id IS NULL) DESC,
        i.is_primary DESC,
        i.sort_order ASC,
        i.created_at ASC,
        i.id ASC
    ), '[]'::jsonb) AS value
    FROM target p
    JOIN public.product_images i ON i.product_id = p.id
      AND i.status = 'ready'::public.product_image_status
  ),
  options_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', o.id,
        'product_id', o.product_id,
        'name', o.name,
        'kind', o.kind,
        'sort_order', o.sort_order,
        'is_required', o.is_required,
        'created_at', o.created_at,
        'updated_at', o.updated_at,
        'values', COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', ov.id,
              'option_id', ov.option_id,
              'value', ov.value,
              'sort_order', ov.sort_order,
              'is_active', ov.is_active,
              'created_at', ov.created_at,
              'updated_at', ov.updated_at
            )
            ORDER BY ov.sort_order, ov.value, ov.id
          )
          FROM public.product_option_values ov
          WHERE ov.option_id = o.id AND ov.is_active
        ), '[]'::jsonb)
      )
      ORDER BY o.sort_order, o.name, o.id
    ), '[]'::jsonb) AS value
    FROM target p
    JOIN public.product_options o ON o.product_id = p.id
  ),
  variants_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', v.id,
        'product_id', v.product_id,
        'name', v.name,
        'status', v.status,
        'is_default', v.is_default,
        'sort_order', v.sort_order,
        'price_override', v.price_override,
        'promotional_price_override', v.promotional_price_override,
        'stock_quantity', v.stock_quantity,
        'created_at', v.created_at,
        'updated_at', v.updated_at,
        'optionValueIds', COALESCE((
          SELECT jsonb_object_agg(rv.option_id::text, rv.option_value_id::text)
          FROM public.product_variant_values rv
          WHERE rv.variant_id = v.id
        ), '{}'::jsonb)
      )
      ORDER BY v.sort_order, v.created_at, v.id
    ), '[]'::jsonb) AS value
    FROM target p
    JOIN public.product_variants v ON v.product_id = p.id
      AND v.status = 'active'::public.product_variant_status
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM target) THEN NULL
    ELSE jsonb_build_object(
      'product', (SELECT value FROM product_json),
      'category', (SELECT value FROM category_json),
      'images', (SELECT value FROM images_json),
      'options', (SELECT value FROM options_json),
      'variants', (SELECT value FROM variants_json)
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.storefront_product_share_v1(p_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH params AS (
    SELECT
      NULLIF(btrim(COALESCE(p_identifier, '')), '') AS identifier,
      CASE
        WHEN btrim(COALESCE(p_identifier, '')) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
          THEN btrim(p_identifier)::uuid
        ELSE NULL
      END AS identifier_uuid
  ),
  target AS (
    SELECT p.*
    FROM public.products p
    CROSS JOIN params prm
    WHERE p.status = 'active'::public.product_status
      AND prm.identifier IS NOT NULL
      AND (p.slug = prm.identifier OR p.id = prm.identifier_uuid)
    LIMIT 1
  ),
  image AS (
    SELECT i.storage_key, i.card_storage_key, i.alt_text
    FROM target p
    JOIN public.product_images i ON i.product_id = p.id
      AND i.status = 'ready'::public.product_image_status
    LEFT JOIN public.product_variants pv ON pv.id = i.variant_id
    ORDER BY
      (i.variant_id IS NULL) DESC,
      COALESCE(pv.is_default, false) DESC,
      i.is_primary DESC,
      i.sort_order,
      i.created_at,
      i.id
    LIMIT 1
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM target) OR NOT EXISTS (SELECT 1 FROM image) THEN NULL
    ELSE (
      SELECT jsonb_build_object(
        'id', p.id,
        'slug', p.slug,
        'name', p.name,
        'description', p.description,
        'price', COALESCE(p.promotional_price, p.price),
        'currency', 'BRL',
        'category', p.category,
        'campeonato', p.campeonato,
        'time', p.time,
        'season', p.season,
        'brand', p.brand,
        'audience', p.audience,
        'image_storage_key', image.storage_key,
        'card_storage_key', image.card_storage_key,
        'image_alt_text', COALESCE(image.alt_text, p.name),
        'in_stock', EXISTS (
          SELECT 1 FROM public.product_variants v
          WHERE v.product_id = p.id
            AND v.status = 'active'::public.product_variant_status
        )
      )
      FROM target p CROSS JOIN image
    )
  END;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_detail_v1(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.storefront_product_share_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_product_detail_v1(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.storefront_product_share_v1(text) TO anon, authenticated;

COMMENT ON FUNCTION public.storefront_product_detail_v1(text)
IS 'Retorna em uma chamada o produto público, categoria, imagens, opções e variações sem expor SKU.';

COMMENT ON FUNCTION public.storefront_product_share_v1(text)
IS 'Payload público mínimo para Open Graph, WhatsApp, canonical e dados estruturados.';

COMMIT;
