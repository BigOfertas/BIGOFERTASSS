BEGIN;

-- BIGofertas — Etapa 3: derivados de imagem e detalhe público em uma única RPC.

ALTER TABLE public.product_images
  ADD COLUMN IF NOT EXISTS card_storage_key text,
  ADD COLUMN IF NOT EXISTS thumb_storage_key text;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_card_storage_key_uidx
  ON public.product_images (card_storage_key)
  WHERE card_storage_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS product_images_thumb_storage_key_uidx
  ON public.product_images (thumb_storage_key)
  WHERE thumb_storage_key IS NOT NULL;

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
      p_query,
      p_category,
      p_campeonato,
      p_liga,
      p_time,
      p_season,
      p_brand,
      p_audience,
      p_commercial_type,
      p_min_price,
      p_max_price,
      p_sort,
      p_page,
      p_page_size
    ) AS payload
  ),
  enriched_items AS (
    SELECT COALESCE(
      jsonb_agg(
        item || jsonb_build_object(
          'image_card_storage_key', image.card_storage_key,
          'image_thumb_storage_key', image.thumb_storage_key
        )
        ORDER BY ordinal
      ),
      '[]'::jsonb
    ) AS items
    FROM base
    CROSS JOIN LATERAL jsonb_array_elements(base.payload->'items') WITH ORDINALITY AS rows(item, ordinal)
    LEFT JOIN public.product_images image
      ON image.storage_key = rows.item->>'image_storage_key'
  )
  SELECT jsonb_set(
    base.payload,
    '{items}',
    enriched_items.items,
    true
  )
  FROM base
  CROSS JOIN enriched_items;
$$;

REVOKE ALL ON FUNCTION public.catalog_products_page_v3(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page_v3(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer) TO anon, authenticated;

COMMENT ON FUNCTION public.catalog_products_page_v3(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer)
IS 'Catálogo público da etapa 3, preservando filtros da etapa 2 e incluindo derivados card/thumb das imagens.';

CREATE OR REPLACE FUNCTION public.storefront_product_detail_v1(p_identifier text)
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH target AS (
    SELECT p.*
    FROM public.products p
    WHERE p.status = 'active'::public.product_status
      AND (p.id::text = btrim(p_identifier) OR p.slug = btrim(p_identifier))
      AND EXISTS (
        SELECT 1
        FROM public.product_images i
        WHERE i.product_id = p.id
          AND i.status = 'ready'::public.product_image_status
      )
    LIMIT 1
  ),
  category_value AS (
    SELECT CASE
      WHEN c.id IS NULL THEN NULL
      ELSE jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'slug', c.slug,
        'is_active', c.is_active,
        'sort_order', c.sort_order,
        'created_at', c.created_at,
        'updated_at', c.updated_at
      )
    END AS value
    FROM target t
    LEFT JOIN public.categories c
      ON c.id = t.primary_category_id
     AND c.is_active
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
    JOIN public.product_images i ON i.product_id = t.id
    WHERE i.status = 'ready'::public.product_image_status
  ),
  option_values AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'product_id', o.product_id,
          'name', o.name,
          'kind', o.kind,
          'is_required', o.is_required,
          'sort_order', o.sort_order,
          'created_at', o.created_at,
          'updated_at', o.updated_at,
          'values', COALESCE((
            SELECT jsonb_agg(
              jsonb_build_object(
                'id', v.id,
                'option_id', v.option_id,
                'value', v.value,
                'is_active', v.is_active,
                'sort_order', v.sort_order,
                'created_at', v.created_at,
                'updated_at', v.updated_at
              )
              ORDER BY v.sort_order ASC, v.value ASC, v.id ASC
            )
            FROM public.product_option_values v
            WHERE v.option_id = o.id
              AND v.is_active
          ), '[]'::jsonb)
        )
        ORDER BY o.sort_order ASC, o.name ASC, o.id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM target t
    JOIN public.product_options o ON o.product_id = t.id
  ),
  variant_values AS (
    SELECT COALESCE(
      jsonb_agg(
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
            SELECT jsonb_object_agg(vv.option_id::text, vv.option_value_id::text)
            FROM public.product_variant_values vv
            WHERE vv.variant_id = v.id
          ), '{}'::jsonb)
        )
        ORDER BY v.sort_order ASC, v.created_at ASC, v.id ASC
      ),
      '[]'::jsonb
    ) AS value
    FROM target t
    JOIN public.product_variants v ON v.product_id = t.id
    WHERE v.status = 'active'::public.product_variant_status
  )
  SELECT jsonb_build_object(
    'product', jsonb_build_object(
      'id', t.id,
      'slug', t.slug,
      'name', t.name,
      'description', t.description,
      'price', t.price,
      'promotional_price', t.promotional_price,
      'status', t.status,
      'primary_category_id', t.primary_category_id,
      'weight_grams', t.weight_grams,
      'length_cm', t.length_cm,
      'width_cm', t.width_cm,
      'height_cm', t.height_cm,
      'image_url', t.image_url,
      'stock', t.stock,
      'category', t.category,
      'campeonato', t.campeonato,
      'liga', t.liga,
      'time', t.time,
      'season', t.season,
      'brand', t.brand,
      'audience', t.audience,
      'specifications', t.specifications,
      'created_at', t.created_at,
      'updated_at', t.updated_at,
      'campeonato_key', t.campeonato_key,
      'liga_key', t.liga_key,
      'time_key', t.time_key,
      'season_key', t.season_key,
      'brand_key', t.brand_key,
      'audience_key', t.audience_key
    ),
    'category', (SELECT value FROM category_value),
    'images', (SELECT value FROM image_values),
    'options', (SELECT value FROM option_values),
    'variants', (SELECT value FROM variant_values)
  )
  FROM target t;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_detail_v1(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_product_detail_v1(text) TO anon, authenticated;

COMMENT ON FUNCTION public.storefront_product_detail_v1(text)
IS 'Detalhe público completo do produto em uma única chamada, sem SKU e somente para produtos ativos com imagem pronta.';

COMMIT;
