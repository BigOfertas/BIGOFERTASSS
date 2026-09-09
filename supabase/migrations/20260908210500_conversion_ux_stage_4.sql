BEGIN;

-- BIGofertas — Etapa 4: refinamento comercial do catálogo.
-- Preserva a RPC pública v3 e acrescenta apenas a segunda imagem de card.

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
          'image_card_storage_key', main_image.card_storage_key,
          'image_thumb_storage_key', main_image.thumb_storage_key,
          'image_hover_storage_key', hover_image.hover_storage_key
        )
        ORDER BY ordinal
      ),
      '[]'::jsonb
    ) AS items
    FROM base
    CROSS JOIN LATERAL jsonb_array_elements(base.payload->'items') WITH ORDINALITY AS rows(item, ordinal)
    LEFT JOIN public.product_images main_image
      ON main_image.storage_key = rows.item->>'image_storage_key'
    LEFT JOIN LATERAL (
      SELECT COALESCE(i.card_storage_key, i.storage_key) AS hover_storage_key
      FROM public.product_images i
      LEFT JOIN public.product_variants pv ON pv.id = i.variant_id
      WHERE i.product_id = (rows.item->>'id')::uuid
        AND i.status = 'ready'::public.product_image_status
        AND i.storage_key IS DISTINCT FROM rows.item->>'image_storage_key'
      ORDER BY
        (i.variant_id IS NULL) DESC,
        COALESCE(pv.is_default, false) DESC,
        i.is_primary DESC,
        i.sort_order ASC,
        i.created_at ASC,
        i.id ASC
      LIMIT 1
    ) hover_image ON true
  )
  SELECT jsonb_set(base.payload, '{items}', enriched_items.items, true)
  FROM base
  CROSS JOIN enriched_items;
$$;

REVOKE ALL ON FUNCTION public.catalog_products_page_v3(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page_v3(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer) TO anon, authenticated;

COMMENT ON FUNCTION public.catalog_products_page_v3(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer)
IS 'Catálogo público com derivados card/thumb e segunda imagem para hover comercial no desktop.';

COMMIT;
