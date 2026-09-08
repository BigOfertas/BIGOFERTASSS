BEGIN;

-- BIGofertas — Etapa 2: catálogo público com filtros comerciais e facetas dependentes.
-- Mantém as funções antigas por compatibilidade e cria uma versão explícita para o storefront novo.

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
      SELECT i.storage_key
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

REVOKE ALL ON FUNCTION public.catalog_products_page_v2(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page_v2(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.catalog_filter_facets_v2(
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
  p_max_price numeric DEFAULT NULL
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
      CASE WHEN p_max_price IS NULL THEN NULL ELSE GREATEST(p_max_price, 0::numeric) END AS max_price
  ),
  filtered AS (
    SELECT
      p.id,
      p.campeonato,
      p.campeonato_key,
      p.liga,
      p.liga_key,
      p.time,
      p.time_key,
      p.season,
      p.season_key,
      p.brand,
      p.brand_key,
      p.audience,
      p.audience_key,
      COALESCE(pps.commercial_type, 'other') AS commercial_type,
      public.catalog_filter_key(COALESCE(pps.commercial_type, 'other')) AS commercial_type_key,
      COALESCE(p.promotional_price, p.price) AS effective_price
    FROM public.products p
    CROSS JOIN params prm
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    WHERE p.status = 'active'::public.product_status
      AND EXISTS (
        SELECT 1 FROM public.product_images i
        WHERE i.product_id = p.id
          AND i.status = 'ready'::public.product_image_status
      )
      AND (
        prm.query_text IS NULL
        OR p.catalog_search_vector @@ websearch_to_tsquery('simple'::regconfig, prm.query_text)
        OR p.catalog_search_text LIKE '%' || prm.query_text || '%'
      )
      AND (
        prm.category_slug IS NULL
        OR EXISTS (
          SELECT 1 FROM public.product_categories pc
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
      AND (prm.commercial_type_key IS NULL OR public.catalog_filter_key(COALESCE(pps.commercial_type, 'other')) = prm.commercial_type_key)
      AND COALESCE(p.promotional_price, p.price) >= prm.min_price
      AND (prm.max_price IS NULL OR COALESCE(p.promotional_price, p.price) <= prm.max_price)
  ),
  category_values AS (
    SELECT c.slug AS value, c.name AS label, count(DISTINCT f.id)::integer AS count
    FROM filtered f
    JOIN public.product_categories pc ON pc.product_id = f.id
    JOIN public.categories c ON c.id = pc.category_id AND c.is_active
    GROUP BY c.slug, c.name, c.sort_order
    ORDER BY c.sort_order, c.name
  ),
  campeonato_values AS (
    SELECT campeonato_key AS value, min(campeonato) AS label, count(*)::integer AS count
    FROM filtered WHERE campeonato_key <> '' GROUP BY campeonato_key ORDER BY min(campeonato)
  ),
  liga_values AS (
    SELECT liga_key AS value, min(liga) AS label, count(*)::integer AS count
    FROM filtered WHERE liga_key <> '' GROUP BY liga_key ORDER BY min(liga)
  ),
  time_values AS (
    SELECT time_key AS value, min(time) AS label, count(*)::integer AS count
    FROM filtered WHERE time_key <> '' GROUP BY time_key ORDER BY min(time)
  ),
  season_values AS (
    SELECT season_key AS value, min(season) AS label, count(*)::integer AS count
    FROM filtered WHERE season_key <> '' GROUP BY season_key ORDER BY min(season) DESC
  ),
  brand_values AS (
    SELECT brand_key AS value, min(brand) AS label, count(*)::integer AS count
    FROM filtered WHERE brand_key <> '' GROUP BY brand_key ORDER BY min(brand)
  ),
  audience_values AS (
    SELECT audience_key AS value, min(audience) AS label, count(*)::integer AS count
    FROM filtered WHERE audience_key <> '' GROUP BY audience_key ORDER BY min(audience)
  ),
  commercial_values AS (
    SELECT commercial_type_key AS value,
      CASE min(commercial_type)
        WHEN 'torcedor' THEN 'Torcedor'
        WHEN 'jogador' THEN 'Jogador'
        WHEN 'feminino' THEN 'Feminino'
        WHEN 'retro' THEN 'Retrô'
        WHEN 'infantil' THEN 'Kids'
        WHEN 'calcao' THEN 'Shorts / calção'
        WHEN 'basquete' THEN 'Basquete'
        ELSE 'Outros'
      END AS label,
      count(*)::integer AS count
    FROM filtered
    WHERE commercial_type_key <> ''
    GROUP BY commercial_type_key
    ORDER BY label
  )
  SELECT jsonb_build_object(
    'categories', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM category_values), '[]'::jsonb),
    'campeonatos', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM campeonato_values), '[]'::jsonb),
    'ligas', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM liga_values), '[]'::jsonb),
    'times', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM time_values), '[]'::jsonb),
    'seasons', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM season_values), '[]'::jsonb),
    'brands', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM brand_values), '[]'::jsonb),
    'audiences', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM audience_values), '[]'::jsonb),
    'commercialTypes', COALESCE((SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM commercial_values), '[]'::jsonb),
    'priceMin', COALESCE((SELECT min(effective_price) FROM filtered), 0),
    'priceMax', COALESCE((SELECT max(effective_price) FROM filtered), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.catalog_filter_facets_v2(text,text,text,text,text,text,text,text,text,numeric,numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_filter_facets_v2(text,text,text,text,text,text,text,text,text,numeric,numeric) TO anon, authenticated;

COMMENT ON FUNCTION public.catalog_products_page_v2(text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer)
IS 'Catálogo público da etapa 2 com filtros por categoria, competição, time, temporada, marca, público e modelo comercial.';

COMMENT ON FUNCTION public.catalog_filter_facets_v2(text,text,text,text,text,text,text,text,text,numeric,numeric)
IS 'Facetas dependentes da etapa 2: as opções e contagens acompanham a seleção atual do catálogo.';

COMMIT;
