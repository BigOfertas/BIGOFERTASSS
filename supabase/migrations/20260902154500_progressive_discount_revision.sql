BEGIN;

-- Revisao comercial solicitada pelo cliente em 2026-09-02.
-- Esta migration e incremental e supersede somente os degraus comerciais
-- definidos em 20260902153000_progressive_discount_and_free_shipping.sql.
-- A partir de 8 pecas o frete cobrado do cliente e zero, mas o custo real da
-- transportadora continua preservado em shipping_base_amount + shipping_additional_amount.

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_discount_percent_allowed;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_discount_percent_allowed
  CHECK (discount_percent IN (0, 5, 10, 15, 20, 30));

CREATE OR REPLACE FUNCTION public.bigofertas_progressive_discount_percent(p_units integer)
RETURNS smallint
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = ''
AS $$
  SELECT CASE
    WHEN p_units >= 35 THEN 30
    WHEN p_units >= 25 THEN 20
    WHEN p_units >= 15 THEN 15
    WHEN p_units >= 8 THEN 10
    WHEN p_units >= 5 THEN 5
    ELSE 0
  END::smallint;
$$;

REVOKE ALL ON FUNCTION public.bigofertas_progressive_discount_percent(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bigofertas_progressive_discount_percent(integer) TO service_role;

-- A migration anterior ja faz create_order_core calcular o percentual pelo
-- helper acima. Este trigger corrige de forma autoritativa a regra de frete
-- gratis a partir de 8 pecas sem perder o custo operacional real da cotacao.
CREATE OR REPLACE FUNCTION public.enforce_bigofertas_progressive_pricing_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.discount_amount := round(NEW.subtotal_amount * NEW.discount_percent::numeric / 100, 2);

  IF NEW.discount_percent >= 10 THEN
    NEW.shipping_discount_amount := NEW.shipping_base_amount + NEW.shipping_additional_amount;
    NEW.shipping_amount := 0;
  ELSE
    NEW.shipping_discount_amount := 0;
    NEW.shipping_amount := NEW.shipping_base_amount + NEW.shipping_additional_amount;
  END IF;

  NEW.total_amount := NEW.subtotal_amount - NEW.discount_amount + NEW.shipping_amount;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_bigofertas_progressive_pricing_before_insert ON public.orders;
CREATE TRIGGER enforce_bigofertas_progressive_pricing_before_insert
BEFORE INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.enforce_bigofertas_progressive_pricing_on_insert();

COMMENT ON FUNCTION public.bigofertas_progressive_discount_percent(integer) IS
  'Regra vigente: 5 pecas=5%; 8=10% + frete gratis; 15=15%; 25=20%; 35+=30%. Frete gratis permanece para todas as faixas a partir de 8 pecas.';

COMMIT;
