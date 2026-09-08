BEGIN;

-- BIGofertas — Etapa 1 do catálogo definitivo.
-- Objetivos: taxonomia administrável, metadados próprios, admin paginado,
-- variações reais, imagens por variação, catálogo público apenas com imagem pronta
-- e remoção do SKU das respostas públicas do catálogo.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS season text,
  ADD COLUMN IF NOT EXISTS brand text,
  ADD COLUMN IF NOT EXISTS audience text,
  ADD COLUMN IF NOT EXISTS season_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS brand_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS audience_key text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_season_length'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_season_length
      CHECK (season IS NULL OR length(btrim(season)) BETWEEN 1 AND 40);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_brand_length'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_brand_length
      CHECK (brand IS NULL OR length(btrim(brand)) BETWEEN 1 AND 80);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_audience_length'
      AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_audience_length
      CHECK (audience IS NULL OR length(btrim(audience)) BETWEEN 1 AND 80);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS products_active_season_idx
  ON public.products (season_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status AND season_key <> '';
CREATE INDEX IF NOT EXISTS products_active_brand_idx
  ON public.products (brand_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status AND brand_key <> '';
CREATE INDEX IF NOT EXISTS products_active_audience_idx
  ON public.products (audience_key, created_at DESC, id)
  WHERE status = 'active'::public.product_status AND audience_key <> '';

-- ---------------------------------------------------------------------------
-- Taxonomia administrável: não depende mais de listas fechadas no frontend.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.catalog_taxonomy_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  context text,
  storage_field text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT catalog_taxonomy_kind_valid
    CHECK (kind IN ('competition','team','brand','season','audience')),
  CONSTRAINT catalog_taxonomy_name_not_blank CHECK (length(btrim(name)) > 0),
  CONSTRAINT catalog_taxonomy_slug_not_blank CHECK (length(btrim(slug)) > 0),
  CONSTRAINT catalog_taxonomy_context_valid
    CHECK (context IS NULL OR context IN ('club','national','other')),
  CONSTRAINT catalog_taxonomy_storage_valid
    CHECK (storage_field IS NULL OR storage_field IN ('campeonato','liga'))
);

CREATE UNIQUE INDEX IF NOT EXISTS catalog_taxonomy_kind_slug_unique
  ON public.catalog_taxonomy_items (kind, slug);
CREATE INDEX IF NOT EXISTS catalog_taxonomy_kind_name_idx
  ON public.catalog_taxonomy_items (kind, name);

CREATE TABLE IF NOT EXISTS public.catalog_taxonomy_relations (
  parent_id uuid NOT NULL REFERENCES public.catalog_taxonomy_items(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.catalog_taxonomy_items(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (parent_id, child_id),
  CONSTRAINT catalog_taxonomy_relation_not_self CHECK (parent_id <> child_id)
);

ALTER TABLE public.catalog_taxonomy_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.catalog_taxonomy_relations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalog_taxonomy_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.catalog_taxonomy_relations FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_taxonomy_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.catalog_taxonomy_relations TO service_role;

CREATE OR REPLACE FUNCTION public.touch_catalog_taxonomy_item()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.name := btrim(NEW.name);
  NEW.slug := public.catalog_filter_key(COALESCE(NULLIF(btrim(NEW.slug), ''), NEW.name));
  NEW.context := NULLIF(btrim(NEW.context), '');
  NEW.storage_field := NULLIF(btrim(NEW.storage_field), '');
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS touch_catalog_taxonomy_item_before_write ON public.catalog_taxonomy_items;
CREATE TRIGGER touch_catalog_taxonomy_item_before_write
BEFORE INSERT OR UPDATE ON public.catalog_taxonomy_items
FOR EACH ROW EXECUTE FUNCTION public.touch_catalog_taxonomy_item();

-- Backfill da taxonomia já existente sem criar uma lista fixa de seleções/clubes.
INSERT INTO public.catalog_taxonomy_items (kind, name, slug, context, storage_field)
SELECT DISTINCT
  'competition',
  btrim(p.campeonato),
  public.catalog_filter_key(p.campeonato),
  CASE WHEN p.campeonato ~* '(copa|sele[cç][aã]o|mundo|euro)' THEN 'national' ELSE 'club' END,
  'campeonato'
FROM public.products p
WHERE p.campeonato IS NOT NULL AND btrim(p.campeonato) <> ''
ON CONFLICT (kind, slug) DO NOTHING;

INSERT INTO public.catalog_taxonomy_items (kind, name, slug, context, storage_field)
SELECT DISTINCT
  'competition',
  btrim(p.liga),
  public.catalog_filter_key(p.liga),
  'club',
  'liga'
FROM public.products p
WHERE p.liga IS NOT NULL AND btrim(p.liga) <> ''
ON CONFLICT (kind, slug) DO NOTHING;

INSERT INTO public.catalog_taxonomy_items (kind, name, slug, context)
SELECT DISTINCT
  'team',
  btrim(p.time),
  public.catalog_filter_key(p.time),
  CASE
    WHEN COALESCE(p.campeonato, '') ~* '(copa|sele[cç][aã]o|mundo|euro)' THEN 'national'
    ELSE 'club'
  END
FROM public.products p
WHERE p.time IS NOT NULL AND btrim(p.time) <> ''
ON CONFLICT (kind, slug) DO NOTHING;

INSERT INTO public.catalog_taxonomy_relations (parent_id, child_id)
SELECT DISTINCT competition.id, team.id
FROM public.products p
JOIN public.catalog_taxonomy_items competition
  ON competition.kind = 'competition'
 AND competition.slug = public.catalog_filter_key(COALESCE(NULLIF(btrim(p.liga), ''), p.campeonato))
JOIN public.catalog_taxonomy_items team
  ON team.kind = 'team'
 AND team.slug = public.catalog_filter_key(p.time)
WHERE p.time IS NOT NULL AND btrim(p.time) <> ''
  AND COALESCE(NULLIF(btrim(p.liga), ''), NULLIF(btrim(p.campeonato), '')) IS NOT NULL
ON CONFLICT DO NOTHING;

-- Migra temporada que antes ficava escondida dentro de specifications.
UPDATE public.products
SET season = NULLIF(btrim((regexp_match(specifications, '(?im)^Temporada:\s*([^\n\r]+)'))[1]), '')
WHERE season IS NULL
  AND specifications IS NOT NULL
  AND specifications ~* '(?m)^Temporada:';

-- ---------------------------------------------------------------------------
-- Índice de busca passa a conhecer os novos metadados.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.refresh_product_catalog_index()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.campeonato_key := public.catalog_filter_key(NEW.campeonato);
  NEW.liga_key := public.catalog_filter_key(NEW.liga);
  NEW.time_key := public.catalog_filter_key(NEW.time);
  NEW.season := NULLIF(btrim(NEW.season), '');
  NEW.brand := NULLIF(btrim(NEW.brand), '');
  NEW.audience := NULLIF(btrim(NEW.audience), '');
  NEW.season_key := public.catalog_filter_key(NEW.season);
  NEW.brand_key := public.catalog_filter_key(NEW.brand);
  NEW.audience_key := public.catalog_filter_key(NEW.audience);

  NEW.catalog_search_text := public.catalog_normalize_text(
    concat_ws(
      ' ',
      NEW.name,
      NEW.slug,
      NEW.description,
      NEW.specifications,
      NEW.category,
      NEW.campeonato,
      NEW.liga,
      NEW.time,
      NEW.season,
      NEW.brand,
      NEW.audience
    )
  );
  NEW.catalog_search_vector := to_tsvector('simple'::regconfig, NEW.catalog_search_text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS refresh_product_catalog_index_before_write ON public.products;
CREATE TRIGGER refresh_product_catalog_index_before_write
BEFORE INSERT OR UPDATE OF
  name, slug, description, specifications, category, campeonato, liga, time, season, brand, audience
ON public.products
FOR EACH ROW EXECUTE FUNCTION public.refresh_product_catalog_index();

UPDATE public.products
SET
  season = season,
  brand = brand,
  audience = audience;

-- ---------------------------------------------------------------------------
-- Catálogo público: sem SKU e somente produtos com imagem pronta.
-- ---------------------------------------------------------------------------

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
        WHEN p_sort IN ('newest','price_asc','price_desc','name_asc','name_desc') THEN p_sort
        ELSE 'newest'
      END AS sort_key,
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
      p.created_at,
      p.season,
      p.brand,
      p.audience,
      pps.commercial_type,
      image.storage_key AS image_storage_key,
      p.image_url AS fallback_image_url
    FROM public.products p
    CROSS JOIN params prm
    LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
    JOIN LATERAL (
      SELECT i.storage_key
      FROM public.product_images i
      WHERE i.product_id = p.id
        AND i.variant_id IS NULL
        AND i.status = 'ready'::public.product_image_status
      ORDER BY i.is_primary DESC, i.sort_order ASC, i.created_at ASC, i.id ASC
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

REVOKE ALL ON FUNCTION public.catalog_products_page(
  text,text,text,text,text,numeric,numeric,text,integer,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page(
  text,text,text,text,text,numeric,numeric,text,integer,integer
) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Administração paginada para ~1000+ produtos.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.owner_catalog_products_page(
  p_query text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 25
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  page_number integer := GREATEST(COALESCE(p_page, 1), 1);
  page_size_value integer := LEAST(GREATEST(COALESCE(p_page_size, 25), 10), 100);
  query_text text := NULLIF(public.catalog_normalize_text(p_query), '');
  status_text text := NULLIF(btrim(COALESCE(p_status, '')), '');
  total_value bigint;
  items_value jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT count(*) INTO total_value
  FROM public.products p
  WHERE (status_text IS NULL OR p.status::text = status_text)
    AND (
      query_text IS NULL
      OR p.catalog_search_text LIKE '%' || query_text || '%'
      OR public.catalog_normalize_text(p.name) LIKE '%' || query_text || '%'
    );

  SELECT COALESCE(jsonb_agg(row_data ORDER BY updated_at DESC, id), '[]'::jsonb)
  INTO items_value
  FROM (
    SELECT
      p.updated_at,
      p.id,
      jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'status', p.status,
        'category', p.category,
        'competition', COALESCE(NULLIF(p.liga, ''), p.campeonato),
        'team', p.time,
        'season', p.season,
        'brand', p.brand,
        'audience', p.audience,
        'price', p.price,
        'promotionalPrice', p.promotional_price,
        'variantCount', (SELECT count(*) FROM public.product_variants v WHERE v.product_id = p.id AND v.status <> 'archived'::public.product_variant_status),
        'readyImageCount', (SELECT count(*) FROM public.product_images i WHERE i.product_id = p.id AND i.status = 'ready'::public.product_image_status),
        'updatedAt', p.updated_at
      ) AS row_data
    FROM public.products p
    WHERE (status_text IS NULL OR p.status::text = status_text)
      AND (
        query_text IS NULL
        OR p.catalog_search_text LIKE '%' || query_text || '%'
        OR public.catalog_normalize_text(p.name) LIKE '%' || query_text || '%'
      )
    ORDER BY p.updated_at DESC, p.id
    OFFSET (page_number - 1) * page_size_value
    LIMIT page_size_value
  ) page_rows;

  RETURN jsonb_build_object(
    'items', items_value,
    'total', total_value,
    'page', page_number,
    'pageSize', page_size_value,
    'totalPages', CASE WHEN total_value = 0 THEN 0 ELSE ceil(total_value::numeric / page_size_value)::integer END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_products_page(text,text,integer,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_products_page(text,text,integer,integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_catalog_taxonomy()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN jsonb_build_object(
    'items', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'kind', i.kind,
        'name', i.name,
        'slug', i.slug,
        'context', i.context,
        'storageField', i.storage_field,
        'parents', COALESCE((
          SELECT jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'slug', p.slug))
          FROM public.catalog_taxonomy_relations r
          JOIN public.catalog_taxonomy_items p ON p.id = r.parent_id
          WHERE r.child_id = i.id
        ), '[]'::jsonb)
      ) ORDER BY i.kind, i.name)
      FROM public.catalog_taxonomy_items i
      WHERE i.is_active
    ), '[]'::jsonb),
    'categories', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'slug', c.slug) ORDER BY c.sort_order, c.name)
      FROM public.categories c WHERE c.is_active
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_taxonomy() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_taxonomy() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_upsert_catalog_taxonomy(
  p_kind text,
  p_name text,
  p_context text DEFAULT NULL,
  p_storage_field text DEFAULT NULL,
  p_parent_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  item_id uuid;
  item_slug text := public.catalog_filter_key(p_name);
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_kind NOT IN ('competition','team','brand','season','audience') OR item_slug = '' THEN
    RAISE EXCEPTION 'Taxonomia inválida';
  END IF;

  INSERT INTO public.catalog_taxonomy_items(kind, name, slug, context, storage_field)
  VALUES (p_kind, btrim(p_name), item_slug, NULLIF(btrim(p_context), ''), NULLIF(btrim(p_storage_field), ''))
  ON CONFLICT (kind, slug) DO UPDATE
    SET name = EXCLUDED.name,
        context = COALESCE(EXCLUDED.context, public.catalog_taxonomy_items.context),
        storage_field = COALESCE(EXCLUDED.storage_field, public.catalog_taxonomy_items.storage_field),
        is_active = true
  RETURNING id INTO item_id;

  IF p_parent_id IS NOT NULL THEN
    INSERT INTO public.catalog_taxonomy_relations(parent_id, child_id)
    VALUES (p_parent_id, item_id)
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN item_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_upsert_catalog_taxonomy(text,text,text,text,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_upsert_catalog_taxonomy(text,text,text,text,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_catalog_product_detail(p_product_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  product_json jsonb;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  SELECT jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'description', p.description,
    'price', p.price,
    'promotionalPrice', p.promotional_price,
    'status', p.status,
    'primaryCategoryId', p.primary_category_id,
    'category', p.category,
    'campeonato', p.campeonato,
    'liga', p.liga,
    'time', p.time,
    'season', p.season,
    'brand', p.brand,
    'audience', p.audience,
    'commercialType', COALESCE(pps.commercial_type, 'other'),
    'weightGrams', p.weight_grams,
    'lengthCm', p.length_cm,
    'widthCm', p.width_cm,
    'heightCm', p.height_cm,
    'variants', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', v.id,
        'name', v.name,
        'status', v.status,
        'isDefault', v.is_default,
        'sortOrder', v.sort_order,
        'priceOverride', v.price_override,
        'promotionalPriceOverride', v.promotional_price_override,
        'stockQuantity', v.stock_quantity,
        'options', COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'optionId', o.id,
            'name', o.name,
            'kind', o.kind,
            'valueId', ov.id,
            'value', ov.value
          ) ORDER BY o.sort_order, o.name)
          FROM public.product_variant_values rv
          JOIN public.product_options o ON o.id = rv.option_id
          JOIN public.product_option_values ov ON ov.id = rv.option_value_id
          WHERE rv.variant_id = v.id
        ), '[]'::jsonb)
      ) ORDER BY v.sort_order, v.created_at)
      FROM public.product_variants v
      WHERE v.product_id = p.id AND v.status <> 'archived'::public.product_variant_status
    ), '[]'::jsonb),
    'images', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', i.id,
        'variantId', i.variant_id,
        'storageKey', i.storage_key,
        'altText', i.alt_text,
        'isPrimary', i.is_primary,
        'sortOrder', i.sort_order,
        'status', i.status
      ) ORDER BY i.variant_id NULLS FIRST, i.is_primary DESC, i.sort_order, i.created_at)
      FROM public.product_images i
      WHERE i.product_id = p.id AND i.status = 'ready'::public.product_image_status
    ), '[]'::jsonb)
  ) INTO product_json
  FROM public.products p
  LEFT JOIN public.product_purchase_settings pps ON pps.product_id = p.id
  WHERE p.id = p_product_id;

  IF product_json IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  RETURN product_json;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_product_detail(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_product_detail(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_save_catalog_product(
  p_product_id uuid,
  p_name text,
  p_description text,
  p_price numeric,
  p_promotional_price numeric,
  p_status text,
  p_primary_category_id uuid,
  p_campeonato text,
  p_liga text,
  p_time text,
  p_season text,
  p_brand text,
  p_audience text,
  p_commercial_type text,
  p_weight_grams integer,
  p_length_cm numeric,
  p_width_cm numeric,
  p_height_cm numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id uuid := p_product_id;
  identity_record record;
  resolved_category text;
  competition_id uuid;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF NULLIF(btrim(p_name), '') IS NULL OR p_price < 0 THEN
    RAISE EXCEPTION 'Dados do produto inválidos';
  END IF;
  IF p_promotional_price IS NOT NULL AND (p_promotional_price < 0 OR p_promotional_price >= p_price) THEN
    RAISE EXCEPTION 'Preço promocional inválido';
  END IF;
  IF p_status NOT IN ('draft','active','inactive','archived') THEN
    RAISE EXCEPTION 'Status inválido';
  END IF;
  IF p_commercial_type NOT IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete','other') THEN
    RAISE EXCEPTION 'Modelo comercial inválido';
  END IF;

  IF p_primary_category_id IS NOT NULL THEN
    SELECT c.name INTO resolved_category FROM public.categories c WHERE c.id = p_primary_category_id AND c.is_active;
    IF resolved_category IS NULL THEN RAISE EXCEPTION 'Categoria inválida'; END IF;
  END IF;

  IF target_id IS NULL THEN
    SELECT * INTO identity_record FROM public.allocate_product_identity() LIMIT 1;
    INSERT INTO public.products(
      name, description, price, promotional_price, status, primary_category_id, category,
      campeonato, liga, time, season, brand, audience,
      weight_grams, length_cm, width_cm, height_cm, sku, slug
    ) VALUES (
      btrim(p_name), NULLIF(btrim(p_description), ''), p_price, p_promotional_price,
      'draft'::public.product_status, p_primary_category_id, resolved_category,
      NULLIF(btrim(p_campeonato), ''), NULLIF(btrim(p_liga), ''), NULLIF(btrim(p_time), ''),
      NULLIF(btrim(p_season), ''), NULLIF(btrim(p_brand), ''), NULLIF(btrim(p_audience), ''),
      p_weight_grams, p_length_cm, p_width_cm, p_height_cm,
      identity_record.product_sku, identity_record.product_slug
    ) RETURNING id INTO target_id;

    INSERT INTO public.product_variants(product_id, sku, name, status, is_default, sort_order, stock_quantity)
    VALUES (target_id, identity_record.default_variant_sku, 'Padrão', 'active'::public.product_variant_status, true, 0, 0);
  ELSE
    UPDATE public.products SET
      name = btrim(p_name), description = NULLIF(btrim(p_description), ''),
      price = p_price, promotional_price = p_promotional_price,
      status = p_status::public.product_status,
      primary_category_id = p_primary_category_id, category = resolved_category,
      campeonato = NULLIF(btrim(p_campeonato), ''), liga = NULLIF(btrim(p_liga), ''),
      time = NULLIF(btrim(p_time), ''), season = NULLIF(btrim(p_season), ''),
      brand = NULLIF(btrim(p_brand), ''), audience = NULLIF(btrim(p_audience), ''),
      weight_grams = p_weight_grams, length_cm = p_length_cm, width_cm = p_width_cm, height_cm = p_height_cm
    WHERE id = target_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;
  END IF;

  INSERT INTO public.product_purchase_settings(product_id, commercial_type, updated_by)
  VALUES (target_id, p_commercial_type, auth.uid())
  ON CONFLICT (product_id) DO UPDATE
    SET commercial_type = EXCLUDED.commercial_type, updated_at = now(), updated_by = auth.uid();

  IF NULLIF(btrim(COALESCE(NULLIF(p_liga, ''), p_campeonato)), '') IS NOT NULL THEN
    competition_id := public.owner_upsert_catalog_taxonomy(
      'competition', COALESCE(NULLIF(btrim(p_liga), ''), btrim(p_campeonato)),
      CASE WHEN p_liga IS NOT NULL AND btrim(p_liga) <> '' THEN 'club'
           WHEN COALESCE(p_campeonato, '') ~* '(copa|sele[cç][aã]o|mundo|euro)' THEN 'national'
           ELSE 'club' END,
      CASE WHEN p_liga IS NOT NULL AND btrim(p_liga) <> '' THEN 'liga' ELSE 'campeonato' END,
      NULL
    );
  END IF;
  IF NULLIF(btrim(p_time), '') IS NOT NULL THEN
    PERFORM public.owner_upsert_catalog_taxonomy('team', p_time, NULL, NULL, competition_id);
  END IF;
  IF NULLIF(btrim(p_brand), '') IS NOT NULL THEN
    PERFORM public.owner_upsert_catalog_taxonomy('brand', p_brand, NULL, NULL, NULL);
  END IF;
  IF NULLIF(btrim(p_season), '') IS NOT NULL THEN
    PERFORM public.owner_upsert_catalog_taxonomy('season', p_season, NULL, NULL, NULL);
  END IF;
  IF NULLIF(btrim(p_audience), '') IS NOT NULL THEN
    PERFORM public.owner_upsert_catalog_taxonomy('audience', p_audience, NULL, NULL, NULL);
  END IF;

  -- Produto novo só assume o status solicitado depois que toda a estrutura mínima existe.
  IF p_product_id IS NULL AND p_status <> 'draft' THEN
    UPDATE public.products SET status = p_status::public.product_status WHERE id = target_id;
  END IF;

  RETURN target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_catalog_product(
  uuid,text,text,numeric,numeric,text,uuid,text,text,text,text,text,text,text,integer,numeric,numeric,numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_catalog_product(
  uuid,text,text,numeric,numeric,text,uuid,text,text,text,text,text,text,text,integer,numeric,numeric,numeric
) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_save_catalog_variant(
  p_product_id uuid,
  p_variant_id uuid,
  p_name text,
  p_status text,
  p_is_default boolean,
  p_price_override numeric,
  p_promotional_price_override numeric,
  p_stock_quantity integer,
  p_options jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id uuid := p_variant_id;
  product_sku_value text;
  option_row jsonb;
  option_id_value uuid;
  option_value_id_value uuid;
  option_kind_value public.product_option_kind;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_status NOT IN ('active','inactive','archived') OR p_stock_quantity < 0 OR jsonb_typeof(p_options) <> 'array' THEN
    RAISE EXCEPTION 'Dados da variação inválidos';
  END IF;

  SELECT p.sku INTO product_sku_value FROM public.products p WHERE p.id = p_product_id;
  IF product_sku_value IS NULL THEN RAISE EXCEPTION 'Produto não encontrado'; END IF;

  IF p_is_default THEN
    UPDATE public.product_variants SET is_default = false WHERE product_id = p_product_id AND is_default;
  END IF;

  IF target_id IS NULL THEN
    INSERT INTO public.product_variants(
      product_id, sku, name, status, is_default, sort_order,
      price_override, promotional_price_override, stock_quantity
    ) VALUES (
      p_product_id,
      product_sku_value || '-V' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      NULLIF(btrim(p_name), ''), p_status::public.product_variant_status, p_is_default,
      COALESCE((SELECT max(sort_order) + 1 FROM public.product_variants WHERE product_id = p_product_id), 0),
      p_price_override, p_promotional_price_override, p_stock_quantity
    ) RETURNING id INTO target_id;
  ELSE
    UPDATE public.product_variants SET
      name = NULLIF(btrim(p_name), ''), status = p_status::public.product_variant_status,
      is_default = p_is_default, price_override = p_price_override,
      promotional_price_override = p_promotional_price_override,
      stock_quantity = p_stock_quantity
    WHERE id = target_id AND product_id = p_product_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Variação não encontrada'; END IF;
  END IF;

  DELETE FROM public.product_variant_values WHERE variant_id = target_id;

  FOR option_row IN SELECT value FROM jsonb_array_elements(p_options)
  LOOP
    IF NULLIF(btrim(option_row->>'name'), '') IS NULL OR NULLIF(btrim(option_row->>'value'), '') IS NULL THEN
      CONTINUE;
    END IF;
    BEGIN
      option_kind_value := COALESCE(NULLIF(option_row->>'kind', ''), 'other')::public.product_option_kind;
    EXCEPTION WHEN invalid_text_representation THEN
      option_kind_value := 'other'::public.product_option_kind;
    END;

    INSERT INTO public.product_options(product_id, name, kind, sort_order, is_required)
    VALUES (p_product_id, btrim(option_row->>'name'), option_kind_value,
      COALESCE((option_row->>'sortOrder')::integer, 0), true)
    ON CONFLICT (product_id, lower(name)) DO UPDATE SET kind = EXCLUDED.kind
    RETURNING id INTO option_id_value;

    INSERT INTO public.product_option_values(option_id, value, sort_order, is_active)
    VALUES (option_id_value, btrim(option_row->>'value'), 0, true)
    ON CONFLICT (option_id, lower(value)) DO UPDATE SET is_active = true
    RETURNING id INTO option_value_id_value;

    INSERT INTO public.product_variant_values(variant_id, option_id, option_value_id)
    VALUES (target_id, option_id_value, option_value_id_value)
    ON CONFLICT (variant_id, option_id) DO UPDATE SET option_value_id = EXCLUDED.option_value_id;
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM public.product_variants WHERE product_id = p_product_id AND is_default AND status <> 'archived'::public.product_variant_status) THEN
    UPDATE public.product_variants
    SET is_default = true
    WHERE id = (
      SELECT id FROM public.product_variants
      WHERE product_id = p_product_id AND status <> 'archived'::public.product_variant_status
      ORDER BY sort_order, created_at LIMIT 1
    );
  END IF;

  RETURN target_id;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_save_catalog_variant(uuid,uuid,text,text,boolean,numeric,numeric,integer,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_save_catalog_variant(uuid,uuid,text,text,boolean,numeric,numeric,integer,jsonb) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.owner_assign_catalog_image_variant(
  p_product_id uuid,
  p_image_id uuid,
  p_variant_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;
  IF p_variant_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.product_variants v WHERE v.id = p_variant_id AND v.product_id = p_product_id
  ) THEN
    RAISE EXCEPTION 'Variação inválida';
  END IF;

  UPDATE public.product_images
  SET variant_id = p_variant_id, is_primary = false
  WHERE id = p_image_id AND product_id = p_product_id AND status = 'ready'::public.product_image_status;
  IF NOT FOUND THEN RAISE EXCEPTION 'Imagem não encontrada'; END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_assign_catalog_image_variant(uuid,uuid,uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_assign_catalog_image_variant(uuid,uuid,uuid) TO authenticated, service_role;

COMMENT ON TABLE public.catalog_taxonomy_items IS
  'Taxonomia administrável do catálogo. Novas seleções, clubes, competições, marcas, temporadas e públicos não exigem deploy.';
COMMENT ON FUNCTION public.owner_catalog_products_page(text,text,integer,integer) IS
  'Admin paginado e pesquisável para catálogos com milhares de produtos.';

COMMIT;
