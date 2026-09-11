BEGIN;

-- Refinamento final da vitrine.
-- 1) Repara produtos infantis conhecidos em que duas versões visuais foram
--    assimiladas como duas imagens da mesma variante, criando a escolha Modelo.
-- 2) Faz a seção Feminino usar uma prioridade global de clubes populares,
--    em vez de empatar os líderes de ligas diferentes.
-- Corta-Vento e demais categorias não são alterados por este reparo.

DO $$
DECLARE
  target_codes text[] := ARRAY[
    'P000801','P000810','P000847','P000898','P000906','P000925','P000940','P000973',
    'P001078','P001148','P001187','P001249','P001274','P001373','P001462','P002087',
    'P002129','P002218','P002280','P002374','P002392','P002417','P002443','P002493'
  ];
  target_code text;
  target_product public.products%ROWTYPE;
  source_variant public.product_variants%ROWTYPE;
  model_option_id uuid;
  model_one_value_id uuid;
  model_two_value_id uuid;
  model_two_variant_id uuid;
  image_ids uuid[];
  active_variant_count integer;
  option_count integer;
  ready_image_count integer;
  repaired_count integer := 0;
BEGIN
  FOREACH target_code IN ARRAY target_codes LOOP
    SELECT p.*
    INTO target_product
    FROM public.products p
    JOIN public.product_purchase_settings settings ON settings.product_id = p.id
    WHERE p.catalog_code = target_code
      AND p.status = 'active'::public.product_status
      AND settings.commercial_type = 'infantil';

    IF target_product.id IS NULL THEN
      RAISE EXCEPTION 'Refinamento de modelos: produto infantil ativo não encontrado: %', target_code;
    END IF;

    SELECT count(*)
    INTO active_variant_count
    FROM public.product_variants v
    WHERE v.product_id = target_product.id
      AND v.status = 'active'::public.product_variant_status;

    SELECT count(*)
    INTO option_count
    FROM public.product_options o
    WHERE o.product_id = target_product.id;

    SELECT count(*), array_agg(i.id ORDER BY i.sort_order, i.created_at, i.id)
    INTO ready_image_count, image_ids
    FROM public.product_images i
    WHERE i.product_id = target_product.id
      AND i.status = 'ready'::public.product_image_status;

    IF active_variant_count <> 1 OR option_count <> 0 OR ready_image_count <> 2 THEN
      RAISE EXCEPTION
        'Refinamento de modelos recusado para %: variantes=%, opções=%, imagens=%',
        target_code, active_variant_count, option_count, ready_image_count;
    END IF;

    SELECT v.*
    INTO source_variant
    FROM public.product_variants v
    WHERE v.product_id = target_product.id
      AND v.status = 'active'::public.product_variant_status
    ORDER BY v.is_default DESC, v.sort_order, v.created_at, v.id
    LIMIT 1;

    IF EXISTS (
      SELECT 1
      FROM public.product_images i
      WHERE i.id = ANY(image_ids)
        AND i.variant_id IS DISTINCT FROM source_variant.id
    ) THEN
      RAISE EXCEPTION 'Refinamento de modelos recusado para %: imagens não pertencem à variante única', target_code;
    END IF;

    INSERT INTO public.product_options(product_id, name, kind, sort_order, is_required)
    VALUES (target_product.id, 'Modelo', 'style'::public.product_option_kind, 0, true)
    RETURNING id INTO model_option_id;

    INSERT INTO public.product_option_values(option_id, value, sort_order, is_active)
    VALUES (model_option_id, 'Modelo 1', 0, true)
    RETURNING id INTO model_one_value_id;

    INSERT INTO public.product_option_values(option_id, value, sort_order, is_active)
    VALUES (model_option_id, 'Modelo 2', 1, true)
    RETURNING id INTO model_two_value_id;

    UPDATE public.product_variants
    SET name = 'Modelo 1',
        is_default = true,
        sort_order = 0,
        updated_at = now()
    WHERE id = source_variant.id;

    INSERT INTO public.product_variants(
      product_id,
      sku,
      name,
      status,
      is_default,
      sort_order,
      price_override,
      promotional_price_override,
      stock_quantity,
      catalog_variant_code
    )
    VALUES (
      target_product.id,
      target_code || '-MODEL-02',
      'Modelo 2',
      source_variant.status,
      false,
      1,
      source_variant.price_override,
      source_variant.promotional_price_override,
      source_variant.stock_quantity,
      'modelo-02'
    )
    RETURNING id INTO model_two_variant_id;

    INSERT INTO public.product_variant_values(variant_id, option_id, option_value_id)
    VALUES
      (source_variant.id, model_option_id, model_one_value_id),
      (model_two_variant_id, model_option_id, model_two_value_id);

    -- A primeira foto continua representando o Modelo 1. A segunda passa a
    -- representar exclusivamente o Modelo 2 e vira a principal dessa variante.
    UPDATE public.product_images
    SET variant_id = model_two_variant_id,
        is_primary = true,
        sort_order = 0,
        updated_at = now()
    WHERE id = image_ids[2];

    UPDATE public.product_images
    SET is_primary = true,
        sort_order = 0,
        updated_at = now()
    WHERE id = image_ids[1];

    repaired_count := repaired_count + 1;
  END LOOP;

  IF repaired_count <> array_length(target_codes, 1) THEN
    RAISE EXCEPTION 'Refinamento de modelos incompleto: % de %', repaired_count, array_length(target_codes, 1);
  END IF;
END;
$$;

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
  -- Feminino é uma seção transversal a várias ligas. Por isso precisa de uma
  -- hierarquia global para que os clubes mais procurados apareçam primeiro.
  IF commercial_key = 'feminino' THEN
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
      WHEN 'bayern-de-munique' THEN 8
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
      WHEN 'inter-miami' THEN 16
      WHEN 'sao-paulo' THEN 17
      WHEN 'santos' THEN 18
      WHEN 'gremio' THEN 19
      WHEN 'internacional' THEN 20
      WHEN 'cruzeiro' THEN 21
      WHEN 'atletico-mineiro' THEN 22
      WHEN 'atletico-mg' THEN 22
      WHEN 'botafogo' THEN 23
      WHEN 'fluminense' THEN 24
      WHEN 'benfica' THEN 25
      WHEN 'porto' THEN 26
      WHEN 'ajax' THEN 27
      ELSE 80
    END;
  ELSIF league_key IN ('brasileirao', 'campeonato-brasileiro')
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
      WHEN 'bayern-de-munique' THEN 8
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

  IF product_name ~ '(^| )camisa (torcedor |jogador |player )?i( |$)' THEN
    shirt_rank := 1;
  ELSIF product_name ~ '(^| )camisa (torcedor |jogador |player )?ii( |$)' THEN
    shirt_rank := 2;
  ELSIF product_name ~ '(^| )camisa (torcedor |jogador |player )?iii( |$)' THEN
    shirt_rank := 3;
  ELSIF commercial_key IN ('torcedor', 'jogador', 'feminino') THEN
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

COMMIT;
