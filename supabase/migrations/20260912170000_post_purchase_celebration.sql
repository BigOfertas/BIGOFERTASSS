BEGIN;

-- One-time post-purchase experience. Existing orders are marked as already seen
-- so the new celebration only applies to orders created after this migration.
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS post_purchase_seen_at timestamptz;

UPDATE public.orders
SET post_purchase_seen_at = now()
WHERE post_purchase_seen_at IS NULL;

COMMENT ON COLUMN public.orders.post_purchase_seen_at IS
  'First time the customer claimed the post-purchase confirmation experience.';

CREATE OR REPLACE FUNCTION public.claim_my_order_celebration(p_public_number text)
RETURNS text
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_public_number text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Autenticacao necessaria' USING ERRCODE = '42501';
  END IF;

  UPDATE public.orders AS o
  SET post_purchase_seen_at = now()
  WHERE o.user_id = v_user_id
    AND o.public_number = upper(btrim(p_public_number))
    AND o.post_purchase_seen_at IS NULL
    AND o.payment_status = 'paid'::public.order_payment_status
    AND o.status IN (
      'paid'::public.order_status,
      'in_production'::public.order_status,
      'shipped'::public.order_status,
      'delivered'::public.order_status
    )
  RETURNING o.public_number INTO v_public_number;

  RETURN v_public_number;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_my_order_celebration(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_my_order_celebration(text) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_my_order_celebration(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_my_order_celebration(text) TO service_role;

COMMIT;
