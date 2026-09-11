BEGIN;

-- Fase 2 — ordenação comercial determinística do catálogo.
-- Não altera produtos, códigos, imagens ou estoque. Corta-Vento permanece intocado.
CREATE OR REPLACE FUNCTION public.storefront_product_priority(
  p_time text,
  p_liga text,
  p_campeonato text,
  p_category text,
  p_commercial_type text,
  p_name text
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
DECLARE
  team_key text := public.catalog_filter_key(p_time);
  league_key text := public.catalog_filter_key(p_liga);
  championship_key text := public.catalog_filter_key(p_campeonato);
  category_key text := public.catalog_filter_key(p_category);
  commercial_key text := public.catalog_filter_key(p_commercial_type);
  product_name text := public.catalog_normalize_text(p_name);
  team_rank integer := 80;
  shirt_rank integer := 8;
  commercial_rank integer := 5;
BEGIN
  -- Brasil: os clubes exibidos pelos escudos da home recebem prioridade comercial.
  IF league_key IN ('brasileirao', 'campeonato-brasileiro')
     OR championship_key IN ('brasileirao', 'campeonato-brasileiro') THEN
    team_rank := CASE team_key
      WHEN 'flamengo' THEN 1
      WHEN 'corinthians' THEN 2
      WHEN 'palmeiras' THEN 3
      WHEN 'sao-paulo' THEN 4
      WHEN 'santos' THEN 5
      WHEN 'gremio' THEN 6
      WHEN 'internacional' THEN 7
      WHEN 'cruzeiro' THEN 8
      WHEN 'atletico-mineiro' THEN 9
      WHEN 'atletico-mg' THEN 9
      WHEN 'botafogo' THEN 10
      WHEN 'fluminense' THEN 11
      ELSE 50
    END;
  ELSIF league_key IN ('la-liga', 'laliga') OR championship_key IN ('la-liga', 'laliga') THEN
    team_rank := CASE team_key
      WHEN 'real-madrid' THEN 1
      WHEN 'barcelona' THEN 2
      WHEN 'atletico-madrid' THEN 3
      WHEN 'athletic-bilbao' THEN 4
      WHEN 'athletic-club' THEN 4
      WHEN 'real-betis' THEN 5
      WHEN 'sevilla' THEN 6
      WHEN 'valencia' THEN 7
      WHEN 'villarreal' THEN 8
      WHEN 'real-sociedad' THEN 9
      ELSE 50
    END;
  ELSIF league_key = 'premier-league' OR championship_key = 'premier-league' THEN
    team_rank := CASE team_key
      WHEN 'manchester-united' THEN 1
      WHEN 'man-united' THEN 1
      WHEN 'liverpool' THEN 2
      WHEN 'arsenal' THEN 3
      WHEN 'manchester-city' THEN 4
      WHEN 'man-city' THEN 4
      WHEN 'chelsea' THEN 5
      WHEN 'tottenham' THEN 6
      WHEN 'tottenham-hotspur' THEN 6
      WHEN 'aston-villa' THEN 7
      WHEN 'newcastle' THEN 8
      WHEN 'newcastle-united' THEN 8
      ELSE 50
    END;
  ELSIF league_key IN ('serie-a', 'serie-a-italia') OR championship_key IN ('serie-a', 'serie-a-italia') THEN
    team_rank := CASE team_key
      WHEN 'milan' THEN 1
      WHEN 'ac-milan' THEN 1
      WHEN 'inter-de-milao' THEN 2
      WHEN 'inter-milan' THEN 2
      WHEN 'internazionale' THEN 2
      WHEN 'juventus' THEN 3
      WHEN 'napoli' THEN 4
      WHEN 'roma' THEN 5
      WHEN 'lazio' THEN 6
      WHEN 'atalanta' THEN 7
      WHEN 'fiorentina' THEN 8
      ELSE 50
    END;
  ELSIF league_key = 'bundesliga' OR championship_key = 'bundesliga' THEN
    team_rank := CASE team_key
      WHEN 'bayern' THEN 1
      WHEN 'bayern-munich' THEN 1
      WHEN 'bayern-de-munique' THEN 1
      WHEN 'borussia-dortmund' THEN 2
      WHEN 'dortmund' THEN 2
      WHEN 'bayer-leverkusen' THEN 3
      WHEN 'leverkusen' THEN 3
      WHEN 'rb-leipzig' THEN 4
      WHEN 'leipzig' THEN 4
      WHEN 'stuttgart' THEN 5
      WHEN 'eintracht-frankfurt' THEN 6
      WHEN 'werder-bremen' THEN 7
      ELSE 50
    END;
  ELSIF league_key = 'ligue-1' OR championship_key = 'ligue-1' THEN
    team_rank := CASE team_key
      WHEN 'psg' THEN 1
      WHEN 'paris-saint-germain' THEN 1
      WHEN 'marseille' THEN 2
      WHEN 'olympique-marseille' THEN 2
      WHEN 'lyon' THEN 3
      WHEN 'olympique-lyon' THEN 3
      WHEN 'monaco' THEN 4
      WHEN 'lille' THEN 5
      WHEN 'lens' THEN 6
      ELSE 50
    END;
  ELSIF league_key IN ('mls', 'mls-soccer', 'major-league-soccer')
     OR championship_key IN ('mls', 'mls-soccer', 'major-league-soccer') THEN
    team_rank := CASE team_key
      WHEN 'inter-miami' THEN 1
      WHEN 'la-galaxy' THEN 2
      WHEN 'lafc' THEN 3
      WHEN 'los-angeles-fc' THEN 3
      WHEN 'seattle-sounders' THEN 4
      WHEN 'atlanta-united' THEN 5
      ELSE 50
    END;
  ELSIF league_key IN ('liga-portugal', 'primeira-liga') OR championship_key IN ('liga-portugal', 'primeira-liga') THEN
    team_rank := CASE team_key
      WHEN 'benfica' THEN 1
      WHEN 'porto' THEN 2
      WHEN 'sporting-cp' THEN 3
      WHEN 'sporting' THEN 3
      WHEN 'braga' THEN 4
      ELSE 50
    END;
  ELSIF league_key = 'eredivisie' OR championship_key = 'eredivisie' THEN
    team_rank := CASE team_key
      WHEN 'ajax' THEN 1
      WHEN 'psv' THEN 2
      WHEN 'feyenoord' THEN 3
      ELSE 50
    END;
  ELSIF league_key IN ('super-lig', 'turkish-super-lig') OR championship_key IN ('super-lig', 'turkish-super-lig') THEN
    team_rank := CASE team_key
      WHEN 'galatasaray' THEN 1
      WHEN 'fenerbahce' THEN 2
      WHEN 'besiktas' THEN 3
      ELSE 50
    END;
  ELSIF league_key = 'saudi-pro-league' OR championship_key = 'saudi-pro-league' THEN
    team_rank := CASE team_key
      WHEN 'al-hilal' THEN 1
      WHEN 'al-nassr' THEN 2
      WHEN 'al-ittihad' THEN 3
      WHEN 'al-ahli' THEN 4
      ELSE 50
    END;
  ELSE
    -- Fallback global também ordena retrôs e categorias sem liga preenchida.
    team_rank := CASE team_key
      WHEN 'real-madrid' THEN 1
      WHEN 'barcelona' THEN 2
      WHEN 'manchester-united' THEN 3
      WHEN 'man-united' THEN 3
      WHEN 'liverpool' THEN 4
      WHEN 'flamengo' THEN 5
      WHEN 'corinthians' THEN 6
      WHEN 'palmeiras' THEN 7
      WHEN 'bayern' THEN 8
      WHEN 'bayern-munich' THEN 8
      WHEN 'milan' THEN 9
      WHEN 'ac-milan' THEN 9
      WHEN 'inter-de-milao' THEN 10
      WHEN 'inter-milan' THEN 10
      WHEN 'internazionale' THEN 10
      WHEN 'juventus' THEN 11
      WHEN 'arsenal' THEN 12
      WHEN 'chelsea' THEN 13
      WHEN 'manchester-city' THEN 14
      WHEN 'man-city' THEN 14
      WHEN 'psg' THEN 15
      WHEN 'paris-saint-germain' THEN 15
      WHEN 'boca-juniors' THEN 16
      WHEN 'river-plate' THEN 17
      WHEN 'sao-paulo' THEN 18
      WHEN 'santos' THEN 19
      WHEN 'gremio' THEN 20
      WHEN 'internacional' THEN 21
      WHEN 'cruzeiro' THEN 22
      WHEN 'atletico-mineiro' THEN 23
      WHEN 'atletico-mg' THEN 23
      WHEN 'botafogo' THEN 24
      WHEN 'fluminense' THEN 25
      WHEN 'inter-miami' THEN 26
      WHEN 'benfica' THEN 27
      WHEN 'porto' THEN 28
      WHEN 'ajax' THEN 29
      ELSE 80
    END;
  END IF;

  -- Dentro do clube: uniforme principal antes das alternativas e itens periféricos.
  IF product_name ~ '(^| )camisa (torcedor |jogador |player )?i( |$)' THEN
    shirt_rank := 1;
  ELSIF product_name ~ '(^| )camisa (torcedor |jogador |player )?ii( |$)' THEN
    shirt_rank := 2;
  ELSIF product_name ~ '(^| )camisa (torcedor |jogador |player )?iii( |$)' THEN
    shirt_rank := 3;
  ELSIF commercial_key IN ('torcedor', 'jogador') THEN
    shirt_rank := 4;
  ELSIF commercial_key = 'retro' OR category_key = 'retro' THEN
    shirt_rank := 5;
  ELSE
    shirt_rank := 8;
  END IF;

  commercial_rank := CASE commercial_key
    WHEN 'torcedor' THEN 1
    WHEN 'jogador' THEN 2
    WHEN 'feminino' THEN 3
    WHEN 'retro' THEN 4
    WHEN 'infantil' THEN 5
    WHEN 'basquete' THEN 6
    WHEN 'calcao' THEN 7
    ELSE 8
  END;

  RETURN (team_rank * 100) + (shirt_rank * 10) + commercial_rank;
END;
$$;

REVOKE ALL ON FUNCTION public.storefront_product_priority(text,text,text,text,text,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.storefront_product_priority(text,text,text,text,text,text) TO anon, authenticated, service_role;

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
      CASE WHEN p_sort IN ('featured','newest','price_asc','price_desc','name_asc','name_desc') THEN p_sort ELSE 'featured' END AS sort_key,
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
      public.storefront_product_priority(
        p.time,
        p.liga,
        p.campeonato,
        p.category,
        COALESCE(pps.commercial_type, 'other'),
        p.name
      ) AS featured_priority,
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
          CASE WHEN prm.sort_key = 'featured' THEN f.featured_priority END ASC,
          CASE WHEN prm.sort_key = 'price_asc' THEN f.effective_price END ASC,
          CASE WHEN prm.sort_key = 'price_desc' THEN f.effective_price END DESC,
          CASE WHEN prm.sort_key = 'name_asc' THEN lower(f.name) END ASC,
          CASE WHEN prm.sort_key = 'name_desc' THEN lower(f.name) END DESC,
          CASE WHEN prm.sort_key IN ('featured','newest') THEN f.created_at END DESC,
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

COMMENT ON FUNCTION public.storefront_product_priority(text,text,text,text,text,text)
IS 'Prioridade comercial da Fase 2 para clubes relevantes e uniformes principais, sem alterar dados do catálogo.';

COMMIT;
