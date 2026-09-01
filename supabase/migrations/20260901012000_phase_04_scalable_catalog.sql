BEGIN;

-- BIGofertas — Fase 04
-- Arquitetura escalavel do catalogo para milhares de produtos.
-- Esta migration nao carrega produtos reais em massa e nao depende da conexao
-- imediata com o projeto Supabase remoto.

CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.catalog_normalize_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT trim(
    regexp_replace(
      translate(
        lower(COALESCE(value, '')),
        'áàãâäéèêëíìîïóòõôöúùûüçñýÿ',
        'aaaaaeeeeiiiiooooouuuucnyy'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.catalog_filter_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT trim(
    BOTH '-'
    FROM regexp_replace(public.catalog_normalize_text(value), '\\s+', '-', 'g')
  );
$$;

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS catalog_search_text text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS catalog_search_vector tsvector NOT NULL DEFAULT ''::tsvector,
  ADD COLUMN IF NOT EXISTS campeonato_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS liga_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS time_key text NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION public.refresh_product_catalog_index()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.campeonato_key := public.catalog_filter_key(NEW.campeonato);
  NEW.liga_key := public.catalog_filter_key(NEW.liga);
  NEW.time_key := public.catalog_filter_key(NEW.time);

  NEW.catalog_search_text := public.catalog_normalize_text(
    concat_ws(
      ' ',
      NEW.name,
      NEW.sku,
      NEW.slug,
      NEW.description,
      NEW.specifications,
      NEW.category,
      NEW.campeonato,
      NEW.liga,
      NEW.time
    )
  );

  NEW.catalog_search_vector := to_tsvector(
    'simple'::regconfig,
    NEW.catalog_search_text
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_product_catalog_index_before_write ON public.products;
CREATE TRIGGER refresh_product_catalog_index_before_write
BEFORE INSERT OR UPDATE OF
  name,
  sku,
  slug,
  description,
  specifications,
  category,
  campeonato,
  liga,
  time
ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.refresh_product_catalog_index();

UPDATE public.products
SET
  catalog_search_text = public.catalog_normalize_text(
    concat_ws(
      ' ',
      name,
      sku,
      slug,
      description,
      specifications,
      category,
      campeonato,
      liga,
      time
    )
  ),
  catalog_search_vector = to_tsvector(
    'simple'::regconfig,
    public.catalog_normalize_text(
      concat_ws(
        ' ',
        name,
        sku,
        slug,
        description,
        specifications,
        category,
        campeonato,
        liga,
        time
      )
    )
  ),
  campeonato_key = public.catalog_filter_key(campeonato),
  liga_key = public.catalog_filter_key(liga),
  time_key = public.catalog_filter_key(time);

CREATE INDEX IF NOT EXISTS products_catalog_search_vector_idx
  ON public.products USING gin (catalog_search_vector);

CREATE INDEX IF NOT EXISTS products_catalog_search_trgm_idx
  ON public.products USING gin (catalog_search_text extensions.gin_trgm_ops);

CREATE INDEX IF NOT EXISTS products_active_newest_idx
  ON public.products (created_at DESC, id)
  WHERE status = 'active'::public.product_status;

CREATE INDEX IF NOT EXISTS products_active_name_idx
  ON public.products (name, id)
  WHERE status = 'active'::public.product_status;

CREATE INDEX IF NOT EXISTS products_active_effective_price_idx
  ON public.products ((COALESCE(promotional_price, price)), id)
  WHERE status = 'active'::public.product_status;

CREATE INDEX IF NOT EXISTS products_active_campeonato_idx
  ON public.products (campeonato_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status
    AND campeonato_key <> '';

CREATE INDEX IF NOT EXISTS products_active_liga_idx
  ON public.products (liga_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status
    AND liga_key <> '';

CREATE INDEX IF NOT EXISTS products_active_time_idx
  ON public.products (time_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status
    AND time_key <> '';

CREATE INDEX IF NOT EXISTS products_active_competition_team_idx
  ON public.products (campeonato_key, liga_key, time_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status;

CREATE INDEX IF NOT EXISTS product_categories_product_category_idx
  ON public.product_categories (product_id, category_id);

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
      CASE
        WHEN p_max_price IS NULL THEN NULL
        ELSE GREATEST(p_max_price, 0::numeric)
      END AS max_price,
      CASE
        WHEN p_sort IN ('newest', 'price_asc', 'price_desc', 'name_asc', 'name_desc')
          THEN p_sort
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
      p.created_at
    FROM public.products p
    CROSS JOIN params prm
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

CREATE OR REPLACE FUNCTION public.catalog_filter_facets()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH active_products AS (
    SELECT
      p.id,
      p.campeonato,
      p.campeonato_key,
      p.liga,
      p.liga_key,
      p.time,
      p.time_key,
      COALESCE(p.promotional_price, p.price) AS effective_price
    FROM public.products p
    WHERE p.status = 'active'::public.product_status
  ),
  category_values AS (
    SELECT
      c.slug AS value,
      c.name AS label,
      count(DISTINCT pc.product_id)::integer AS count
    FROM public.categories c
    JOIN public.product_categories pc ON pc.category_id = c.id
    JOIN active_products p ON p.id = pc.product_id
    WHERE c.is_active
    GROUP BY c.slug, c.name, c.sort_order
    ORDER BY c.sort_order ASC, c.name ASC
  ),
  campeonato_values AS (
    SELECT
      p.campeonato_key AS value,
      min(p.campeonato) AS label,
      count(*)::integer AS count
    FROM active_products p
    WHERE p.campeonato_key <> ''
    GROUP BY p.campeonato_key
    ORDER BY min(p.campeonato) ASC
  ),
  liga_values AS (
    SELECT
      p.liga_key AS value,
      min(p.liga) AS label,
      count(*)::integer AS count
    FROM active_products p
    WHERE p.liga_key <> ''
    GROUP BY p.liga_key
    ORDER BY min(p.liga) ASC
  ),
  time_values AS (
    SELECT
      p.time_key AS value,
      min(p.time) AS label,
      count(*)::integer AS count
    FROM active_products p
    WHERE p.time_key <> ''
    GROUP BY p.time_key
    ORDER BY min(p.time) ASC
  )
  SELECT jsonb_build_object(
    'categories', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM category_values),
      '[]'::jsonb
    ),
    'campeonatos', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM campeonato_values),
      '[]'::jsonb
    ),
    'ligas', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM liga_values),
      '[]'::jsonb
    ),
    'times', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object('value', value, 'label', label, 'count', count)) FROM time_values),
      '[]'::jsonb
    ),
    'priceMin', COALESCE((SELECT min(effective_price) FROM active_products), 0),
    'priceMax', COALESCE((SELECT max(effective_price) FROM active_products), 0)
  );
$$;

REVOKE ALL ON FUNCTION public.catalog_products_page(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.catalog_filter_facets() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.catalog_products_page(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.catalog_filter_facets() TO anon, authenticated;

COMMENT ON FUNCTION public.catalog_products_page(
  text, text, text, text, text, numeric, numeric, text, integer, integer
) IS 'Retorna somente uma pagina enxuta do catalogo ativo, com filtros, busca, ordenacao, total e imagem principal.';

COMMENT ON FUNCTION public.catalog_filter_facets() IS
  'Retorna facetas globais do catalogo ativo com valores canonicos, rotulos e contagens, sem depender da pagina atual.';

COMMIT;
