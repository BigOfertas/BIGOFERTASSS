-- BIGofertas
-- FASE 07
-- Limpeza manual e idempotente do produto usado na validacao funcional.
--
-- Remove somente a identidade de teste BIG-P000001 / produto-000001,
-- devolve a identidade ao pool e restaura o pool para 20 reservas livres.

BEGIN;

DO $$
DECLARE
  target_product_id uuid;
BEGIN
  SELECT p.id
  INTO target_product_id
  FROM public.products p
  WHERE p.sku = 'BIG-P000001'
    AND p.slug = 'produto-000001'
  LIMIT 1;

  IF target_product_id IS NOT NULL THEN
    -- A integridade da Fase 02 impede remover a ultima variante ativa
    -- enquanto o produto pai ainda estiver ativo. Primeiro retiramos o
    -- produto do catalogo ativo; depois o DELETE pode cascatar com seguranca.
    UPDATE public.products
    SET status = 'inactive'::public.product_status
    WHERE id = target_product_id;

    DELETE FROM public.products
    WHERE id = target_product_id;
  END IF;

  -- O FK claimed_product_id usa ON DELETE SET NULL. Depois que o produto
  -- some, a reserva pode ser devolvida ao estado available.
  UPDATE public.product_identity_slots
  SET
    status = 'available',
    reserved_by = NULL,
    reserved_at = NULL,
    claimed_product_id = NULL,
    claimed_at = NULL
  WHERE product_sku = 'BIG-P000001'
    AND product_slug = 'produto-000001'
    AND claimed_product_id IS NULL;

  PERFORM public.ensure_product_identity_pool(20);

  -- A criacao do produto de teste repôs uma reserva extra. Ao devolver a
  -- primeira identidade, mantemos apenas as 20 reservas livres de menor numero.
  DELETE FROM public.product_identity_slots
  WHERE id IN (
    SELECT s.id
    FROM public.product_identity_slots s
    WHERE s.status = 'available'
    ORDER BY s.serial_number ASC
    OFFSET 20
  );
END;
$$;

COMMIT;

SELECT
  EXISTS (
    SELECT 1
    FROM public.products
    WHERE sku = 'BIG-P000001'
       OR slug = 'produto-000001'
  ) AS produto_teste_ainda_existe,
  count(*) FILTER (WHERE status = 'available') AS reservas_disponiveis,
  count(*) FILTER (WHERE status = 'reserved') AS reservas_reservadas,
  count(*) FILTER (WHERE status = 'claimed') AS reservas_utilizadas,
  min(product_sku) FILTER (WHERE status = 'available') AS primeiro_sku,
  max(product_sku) FILTER (WHERE status = 'available') AS ultimo_sku
FROM public.product_identity_slots;
