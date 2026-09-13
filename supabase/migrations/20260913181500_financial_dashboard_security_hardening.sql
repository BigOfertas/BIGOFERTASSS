BEGIN;

-- Supabase pode aplicar grants padrão diretamente aos papéis de API ao criar funções.
-- Este hardening remove explicitamente qualquer execução anônima das funções financeiras
-- e também impede clientes autenticados de chamar helpers que revelam regras de custo.

REVOKE EXECUTE ON FUNCTION public.owner_get_finance_settings() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owner_save_finance_settings(numeric,numeric,numeric,numeric,numeric,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owner_finance_products_page(text,integer,integer) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owner_save_product_finance(uuid,numeric) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.owner_get_finance_settings() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_save_finance_settings(numeric,numeric,numeric,numeric,numeric,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_finance_products_page(text,integer,integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_save_product_finance(uuid,numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.finance_default_product_cost(numeric,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.finance_default_category(numeric,text,text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.capture_order_item_financial_snapshot() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_order_item_financial_snapshot() FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.finance_default_product_cost(numeric,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.finance_default_category(numeric,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.capture_order_item_financial_snapshot() TO service_role;
GRANT EXECUTE ON FUNCTION public.protect_order_item_financial_snapshot() TO service_role;

COMMIT;