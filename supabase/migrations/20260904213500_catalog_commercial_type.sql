BEGIN;

CREATE OR REPLACE FUNCTION public.catalog_products_page(
  p_query text,
  p_category text,
  p_campeonato text,
  p_liga text,
  p_time text,
  p_min_price numeric,
  p_max_price numeric,
  p_sort text,
  p_page integer,
  p_page_size integer
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
      GREATEST(COALESCE(p_min_price, 0), 0::numeric) AS min_price,
      CASE WHEN p_max_price IS NULL THEN NULL ELSE GREATEST(p_max_price, 0::numeric) END AS max_price,
      CASE
        WHEN p_sort IN ('newest', 'price_asc', 'price_desc', 'name_asc', 'name_desc') THEN p_sort
        ELSE 'newest'
      END AS sort_key,
      GREATEST(COALESCE(p_page, 1), 1) AS page_number,
      LEAST(GREATEST(COALESCE(p_page_size, 24), 1), 48) AS page_size
  ),
  filtered AS (
    SELECT
      p.id,
      p.sku,
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
      p.image_url,
      p.created_at,
      pps.commercial_type
    FROM public.products p
    CROSS JOIN params prm
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
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
          WHERE pc.product_id = p.id
            AND c.is_active
            AND c.slug = prm.category_slug
        )
      )
      AND (prm.campeonato_key IS NULL OR p.campeonato_key = prm.campeonato_key)
      AND (prm.liga_key IS NULL OR p.liga_key = prm.liga_key)
      AND (prm.time_key IS NULL OR p.time_key = prm.time_key)
      AND COALESCE(p.promotional_price, p.price) >= prm.min_price
      AND (prm.max_price IS NULL OR COALESCE(p.promotional_price, p.price) <= prm.max_price)
  ),
  ordered AS (
    SELECT
      f.*,
      row_number() OVER (
        ORDER BY
          CASE WHEN prm.sort_key = 'price_asc' THEN f.effective_price END ASC,
          CASE WHEN prm.sort_key = 'price_desc' THEN f.effective_price END DESC,
          CASE WHEN prm.sort_key = 'name_asc' THEN lower(f.name) END ASC,
          CASE WHEN prm.sort_key = 'name_desc' THEN lower(f.name) END DESC,
          CASE WHEN prm.sort_key = 'newest' THEN f.created_at END DESC,
          f.id ASC
      ) AS ordinal
    FROM filtered f
    CROSS JOIN params prm
  ),
  page_rows AS (
    SELECT o.*
    FROM ordered o
    CROSS JOIN params prm
    WHERE o.ordinal > ((prm.page_number - 1) * prm.page_size)
      AND o.ordinal <= (prm.page_number * prm.page_size)
  ),
  items AS (
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', pr.id,
          'sku', pr.sku,
          'slug', pr.slug,
          'name', pr.name,
          'price', pr.price,
          'promotional_price', pr.promotional_price,
          'stock', pr.stock,
          'category', pr.category,
          'campeonato', pr.campeonato,
          'liga', pr.liga,
          'time', pr.time,
          'commercial_type', pr.commercial_type,
          'created_at', pr.created_at,
          'image_storage_key', image.storage_key,
          'fallback_image_url', pr.image_url
        )
        ORDER BY pr.ordinal
      ),
      '[]'::jsonb
    ) AS value
    FROM page_rows pr
    LEFT JOIN LATERAL (
      SELECT i.storage_key
      FROM public.product_images i
      WHERE i.product_id = pr.id
        AND i.variant_id IS NULL
        AND i.status = 'ready'::public.product_image_status
      ORDER BY i.is_primary DESC, i.sort_order ASC, i.created_at ASC, i.id ASC
      LIMIT 1
    ) image ON true
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
  FROM params prm
  CROSS JOIN items;
$$;

REVOKE ALL ON FUNCTION public.catalog_products_page(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) TO anon, authenticated;

COMMENT ON FUNCTION public.catalog_products_page(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) IS 'Retorna uma pagina enxuta do catalogo ativo com busca, filtros, imagem principal e tipo comercial para apresentacao automatica.';

COMMIT;