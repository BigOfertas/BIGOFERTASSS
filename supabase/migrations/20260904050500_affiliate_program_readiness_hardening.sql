BEGIN;

-- Ajustes de integridade identificados na revisão fria do módulo antes de
-- publicar a jornada completa de afiliados.

ALTER TABLE public.affiliate_refund_reviews
  DROP CONSTRAINT IF EXISTS affiliate_refund_reviews_state_consistent;

ALTER TABLE public.affiliate_refund_reviews
  ADD CONSTRAINT affiliate_refund_reviews_state_consistent CHECK (
    (status = 'pending' AND resolved_at IS NULL)
    OR (status = 'resolved' AND resolved_at IS NOT NULL)
  );

-- Evita produto cartesiano entre pedidos e comissões e evita SUM(DISTINCT valor),
-- que subcontaria dois pedidos legítimos com o mesmo total.
CREATE OR REPLACE FUNCTION public.owner_list_affiliate_referrals(
  p_affiliate_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  affiliate_id uuid,
  affiliate_user_id uuid,
  affiliate_name text,
  referred_user_id uuid,
  referred_name text,
  referred_email text,
  referred_at timestamptz,
  orders_count bigint,
  paid_orders_count bigint,
  paid_sales_amount numeric,
  generated_commission_amount numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role('owner'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito ao administrador';
  END IF;

  RETURN QUERY
  WITH order_totals AS (
    SELECT
      o.user_id,
      count(*) AS orders_count,
      count(*) FILTER (
        WHERE o.payment_status = 'paid'::public.order_payment_status
      ) AS paid_orders_count,
      COALESCE(sum(o.total_amount) FILTER (
        WHERE o.payment_status = 'paid'::public.order_payment_status
      ), 0) AS paid_sales_amount
    FROM public.orders AS o
    GROUP BY o.user_id
  ), commission_totals AS (
    SELECT
      c.affiliate_id,
      c.referred_user_id,
      COALESCE(sum(c.commission_amount) FILTER (
        WHERE c.status <> 'cancelled'
      ), 0) AS generated_commission_amount
    FROM public.affiliate_commissions AS c
    GROUP BY c.affiliate_id, c.referred_user_id
  )
  SELECT
    a.id,
    a.user_id,
    ap.full_name,
    r.referred_user_id,
    rp.full_name,
    rp.email,
    r.referred_at,
    COALESCE(ot.orders_count, 0),
    COALESCE(ot.paid_orders_count, 0),
    COALESCE(ot.paid_sales_amount, 0),
    COALESCE(ct.generated_commission_amount, 0)
  FROM public.affiliate_referrals AS r
  JOIN public.affiliates AS a ON a.id = r.affiliate_id
  LEFT JOIN public.profiles AS ap ON ap.id = a.user_id
  LEFT JOIN public.profiles AS rp ON rp.id = r.referred_user_id
  LEFT JOIN order_totals AS ot ON ot.user_id = r.referred_user_id
  LEFT JOIN commission_totals AS ct
    ON ct.affiliate_id = r.affiliate_id
   AND ct.referred_user_id = r.referred_user_id
  WHERE p_affiliate_id IS NULL OR r.affiliate_id = p_affiliate_id
  ORDER BY r.referred_at DESC, r.referred_user_id
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$$;

REVOKE ALL ON FUNCTION public.owner_list_affiliate_referrals(uuid, integer, integer)
FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_list_affiliate_referrals(uuid, integer, integer)
TO authenticated;

COMMENT ON FUNCTION public.owner_list_affiliate_referrals(uuid, integer, integer) IS
  'Lista clientes indicados com totais agregados sem duplicar pedidos ou comissoes.';

COMMIT;
