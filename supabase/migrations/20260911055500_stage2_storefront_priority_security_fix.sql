BEGIN;

-- A migration de prioridade recriou catalog_products_page_v2 para adicionar a ordem
-- comercial. O RPC já era SECURITY DEFINER após o hardening público; preserve essa
-- propriedade sem reescrever a migration já aplicada.
ALTER FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) SECURITY DEFINER;

REVOKE ALL ON FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.catalog_products_page_v2(
  text,text,text,text,text,text,text,text,text,numeric,numeric,text,integer,integer
) TO anon, authenticated;

COMMIT;
