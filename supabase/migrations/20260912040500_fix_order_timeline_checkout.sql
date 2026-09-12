BEGIN;

-- Hotfix do checkout: a funcao ativa de criacao de pedidos ficou com um trecho
-- legado que tenta gravar colunas inexistentes (status/note) em order_timeline.
-- Preservamos integralmente a funcao atualmente instalada e substituimos apenas
-- esse trecho quando ele estiver presente.
DO $$
DECLARE
  function_oid oid;
  function_sql text;
  patched_sql text;
  old_fragment text := $old$
  INSERT INTO public.order_timeline (order_id,status,note)
  VALUES (created_order.id,'pending'::public.order_status,'Pedido criado');
$old$;
  new_fragment text := $new$
  INSERT INTO public.order_timeline (order_id,event_type,actor_type,message)
  VALUES (created_order.id,'order_created','system'::public.order_actor_type,'Pedido criado');
$new$;
BEGIN
  function_oid := to_regprocedure(
    'public.create_order_core(uuid,uuid,jsonb,jsonb,jsonb,numeric,text)'
  );

  IF function_oid IS NULL THEN
    RAISE EXCEPTION 'create_order_core esperado nao foi encontrado';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'order_timeline'
      AND column_name IN ('event_type', 'actor_type', 'message')
    GROUP BY table_schema, table_name
    HAVING count(*) = 3
  ) THEN
    RAISE EXCEPTION 'Schema atual de order_timeline nao possui as colunas esperadas';
  END IF;

  function_sql := pg_get_functiondef(function_oid);

  IF position(old_fragment IN function_sql) > 0 THEN
    patched_sql := replace(function_sql, old_fragment, new_fragment);

    IF patched_sql = function_sql THEN
      RAISE EXCEPTION 'Hotfix nao alterou create_order_core como esperado';
    END IF;

    EXECUTE patched_sql;
    RAISE NOTICE 'create_order_core corrigida para o modelo atual de order_timeline';
  ELSE
    RAISE NOTICE 'Trecho legado nao esta presente; nenhuma alteracao necessaria';
  END IF;
END
$$;

DO $$
DECLARE
  function_oid oid;
  function_sql text;
BEGIN
  function_oid := to_regprocedure(
    'public.create_order_core(uuid,uuid,jsonb,jsonb,jsonb,numeric,text)'
  );
  function_sql := pg_get_functiondef(function_oid);

  IF position('INSERT INTO public.order_timeline (order_id,status,note)' IN function_sql) > 0 THEN
    RAISE EXCEPTION 'Trecho legado de order_timeline ainda esta ativo';
  END IF;

  IF position('order_created' IN function_sql) = 0
     OR position('event_type' IN function_sql) = 0
     OR position('actor_type' IN function_sql) = 0 THEN
    RAISE EXCEPTION 'create_order_core nao contem o evento moderno de criacao do pedido';
  END IF;
END
$$;

COMMIT;
