BEGIN;

-- Corrige definitivamente as chaves de filtro com mais de uma palavra.
-- A expressão anterior usava \\s em uma string SQL e podia preservar espaços,
-- produzindo valores como "real madrid" e "manchester united". O frontend
-- trabalha com slugs canônicos; portanto banco e cliente passam a usar a mesma regra.
CREATE OR REPLACE FUNCTION public.catalog_filter_key(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = ''
AS $$
  SELECT trim(
    BOTH '-'
    FROM regexp_replace(public.catalog_normalize_text(value), '[[:space:]]+', '-', 'g')
  );
$$;

UPDATE public.products
SET
  campeonato_key = public.catalog_filter_key(campeonato),
  liga_key = public.catalog_filter_key(liga),
  time_key = public.catalog_filter_key(time),
  season_key = public.catalog_filter_key(season),
  brand_key = public.catalog_filter_key(brand),
  audience_key = public.catalog_filter_key(audience)
WHERE campeonato_key IS DISTINCT FROM public.catalog_filter_key(campeonato)
   OR liga_key IS DISTINCT FROM public.catalog_filter_key(liga)
   OR time_key IS DISTINCT FROM public.catalog_filter_key(time)
   OR season_key IS DISTINCT FROM public.catalog_filter_key(season)
   OR brand_key IS DISTINCT FROM public.catalog_filter_key(brand)
   OR audience_key IS DISTINCT FROM public.catalog_filter_key(audience);

UPDATE public.catalog_taxonomy_items
SET
  slug = public.catalog_filter_key(name),
  updated_at = now()
WHERE slug IS DISTINCT FROM public.catalog_filter_key(name);

DO $$
BEGIN
  IF public.catalog_filter_key('Real Madrid') <> 'real-madrid'
     OR public.catalog_filter_key('Manchester United') <> 'manchester-united'
     OR public.catalog_filter_key('São Paulo') <> 'sao-paulo'
     OR public.catalog_filter_key('Premier League') <> 'premier-league' THEN
    RAISE EXCEPTION 'catalog_filter_key não está produzindo slugs canônicos';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.products
    WHERE campeonato_key ~ '[[:space:]]'
       OR liga_key ~ '[[:space:]]'
       OR time_key ~ '[[:space:]]'
       OR season_key ~ '[[:space:]]'
       OR brand_key ~ '[[:space:]]'
       OR audience_key ~ '[[:space:]]'
  ) THEN
    RAISE EXCEPTION 'Ainda existem chaves de filtro de produto com espaços';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.catalog_taxonomy_items
    WHERE slug ~ '[[:space:]]'
  ) THEN
    RAISE EXCEPTION 'Ainda existem slugs de taxonomia com espaços';
  END IF;
END
$$;

COMMIT;
