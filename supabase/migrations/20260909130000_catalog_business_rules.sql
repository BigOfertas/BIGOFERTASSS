BEGIN;

-- Regras comerciais definitivas informadas para o catálogo BIGofertas.
UPDATE public.store_purchase_settings
SET
  sizes = ARRAY['P','M','G','GG','2GG','3GG','4XL'],
  personalization_price = 25.00,
  personalization_name_max = 12,
  phrase_price = 45.00,
  phrase_max = 50,
  patch_default_price = 15.00,
  patch_catalog = '[
    {"code":"brasileirao","label":"Brasileirão"},
    {"code":"libertadores","label":"Libertadores"},
    {"code":"sul-americana","label":"Sul Americana"},
    {"code":"copa-do-brasil","label":"Copa do Brasil"},
    {"code":"mundial-de-clubes","label":"Mundial de Clubes"}
  ]'::jsonb,
  product_type_prices = '{
    "torcedor":184.90,
    "feminino":184.90,
    "jogador":219.90,
    "retro":219.90,
    "infantil":169.90,
    "calcao":159.90,
    "basquete":229.90
  }'::jsonb,
  updated_at = now()
WHERE singleton = true;

-- Garante que produtos já classificados também obedeçam à tabela fixa.
UPDATE public.products p
SET
  price = (s.product_type_prices ->> pps.commercial_type)::numeric,
  promotional_price = NULL,
  updated_at = now()
FROM public.product_purchase_settings pps
CROSS JOIN public.store_purchase_settings s
WHERE s.singleton = true
  AND pps.product_id = p.id
  AND pps.commercial_type IN ('torcedor','feminino','jogador','retro','infantil','calcao','basquete')
  AND s.product_type_prices ? pps.commercial_type;

-- O importador usa esta função para registrar a leitura I/II/III como a última
-- característica do produto sem expor escrita direta na tabela pública.
CREATE OR REPLACE FUNCTION public.owner_catalog_import_set_specifications(
  p_product_id uuid,
  p_specifications text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_specs text := NULLIF(btrim(COALESCE(p_specifications, '')), '');
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.products
    WHERE id = p_product_id
      AND status <> 'archived'::public.product_status
  ) THEN
    RAISE EXCEPTION 'Produto não encontrado';
  END IF;

  UPDATE public.products
  SET specifications = normalized_specs,
      updated_at = now()
  WHERE id = p_product_id;

  RETURN normalized_specs;
END;
$$;

REVOKE ALL ON FUNCTION public.owner_catalog_import_set_specifications(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.owner_catalog_import_set_specifications(uuid,text) TO authenticated, service_role;

COMMIT;
