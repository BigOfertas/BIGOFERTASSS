-- BIGofertas
-- FASE 07
-- Limpeza manual e idempotente do produto usado na validacao funcional.
--
-- Remove somente a identidade de teste BIG-P000001 / produto-000001,
-- devolve a identidade ao pool e restaura o pool para 20 reservas livres.
--
-- IMPORTANTE: o trigger que protege a ultima variante ativa e desabilitado
-- somente durante esta transacao de limpeza do dado de teste e e religado
-- antes do COMMIT. Em caso de erro, o PostgreSQL reverte toda a transacao.

BEGIN;

-- Primeiro retiramos o produto de teste do catalogo ativo.
UPDATE public.products
SET status = 'inactive'::public.product_status
WHERE sku = 'BIG-P000001'
  AND slug = 'produto-000001';

-- A remocao e excepcional: precisamos apagar a variante criada no teste.
-- A protecao continua existindo normalmente depois desta transacao.
ALTER TABLE public.product_variants
  DISABLE TRIGGER block_last_active_variant_removal_before_write;

DELETE FROM public.product_variants
WHERE product_id IN (
  SELECT id
  FROM public.products
  WHERE sku = 'BIG-P000001'
    AND slug = 'produto-000001'
);

ALTER TABLE public.product_variants
  ENABLE TRIGGER block_last_active_variant_removal_before_write;

-- Agora nao existe variante para o FK tentar remover em cascata.
DELETE FROM public.products
WHERE sku = 'BIG-P000001'
  AND slug = 'produto-000001';

-- claimed_product_id usa ON DELETE SET NULL; a identidade pode voltar ao pool.
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

-- O consumo do teste criou uma reserva extra. Mantemos as 20 de menor numero,
-- devolvendo BIG-P000001 para que o primeiro produto real possa usa-la.
DELETE FROM public.product_identity_slots
WHERE id IN (
  SELECT id
  FROM public.product_identity_slots
  WHERE status = 'available'
  ORDER BY serial_number ASC
  OFFSET 20
);

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
