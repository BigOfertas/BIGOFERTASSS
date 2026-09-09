BEGIN;

-- BIGofertas — corrige a execução pública das RPCs de catálogo.
-- As funções expõem somente dados públicos agregados/filtrados, mas dependem
-- de product_purchase_settings, cuja tabela permanece privada e protegida por RLS.
-- SECURITY DEFINER evita conceder SELECT direto nessa tabela ao papel anon.

ALTER FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) SECURITY DEFINER;

ALTER FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) SET search_path = '';

ALTER FUNCTION public.catalog_filter_facets_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric
) SECURITY DEFINER;

ALTER FUNCTION public.catalog_filter_facets_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric
) SET search_path = '';

REVOKE ALL ON FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.catalog_filter_facets_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_filter_facets_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric
) TO anon, authenticated;

COMMENT ON FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) IS 'Catálogo público paginado. SECURITY DEFINER permite ler configuração comercial privada sem expor product_purchase_settings diretamente.';

COMMENT ON FUNCTION public.catalog_filter_facets_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric
) IS 'Facetas públicas do catálogo. SECURITY DEFINER permite ler configuração comercial privada sem expor product_purchase_settings diretamente.';

COMMIT;
