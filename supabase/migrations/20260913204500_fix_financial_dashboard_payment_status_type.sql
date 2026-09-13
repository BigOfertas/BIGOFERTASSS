BEGIN;

-- Corrige a RPC financeira sem reescrever migrations já aplicadas.
-- O schema real usa public.order_payment_status em orders.payment_status e
-- public.order_items.product_name para o snapshot textual do produto.
-- A primeira versão da RPC referenciava public.payment_status (tipo inexistente)
-- e order_items.product_name_snapshot (coluna inexistente), falhando em runtime.
DO $fix$
DECLARE
  dashboard_proc regprocedure := to_regprocedure(
    'public.owner_get_financial_dashboard(text,timestamptz,timestamptz)'
  );
  dashboard_definition text;
  original_definition text;
BEGIN
  IF dashboard_proc IS NULL THEN
    RAISE EXCEPTION 'owner_get_financial_dashboard não existe';
  END IF;

  dashboard_definition := pg_get_functiondef(dashboard_proc);
  original_definition := dashboard_definition;

  dashboard_definition := replace(
    dashboard_definition,
    'public.payment_status',
    'public.order_payment_status'
  );
  dashboard_definition := replace(
    dashboard_definition,
    'oi.product_name_snapshot',
    'oi.product_name'
  );

  IF dashboard_definition = original_definition THEN
    IF position('public.order_payment_status' IN dashboard_definition) > 0
      AND position('oi.product_name' IN dashboard_definition) > 0
      AND position('public.payment_status' IN dashboard_definition) = 0
      AND position('oi.product_name_snapshot' IN dashboard_definition) = 0 THEN
      RETURN;
    END IF;

    RAISE EXCEPTION 'Definição inesperada de owner_get_financial_dashboard';
  END IF;

  EXECUTE dashboard_definition;

  dashboard_definition := pg_get_functiondef(
    'public.owner_get_financial_dashboard(text,timestamptz,timestamptz)'::regprocedure
  );

  IF position('public.payment_status' IN dashboard_definition) > 0
    OR position('public.order_payment_status' IN dashboard_definition) = 0
    OR position('oi.product_name_snapshot' IN dashboard_definition) > 0
    OR position('oi.product_name' IN dashboard_definition) = 0 THEN
    RAISE EXCEPTION 'A correção de compatibilidade do Financeiro não foi aplicada';
  END IF;
END;
$fix$;

-- Preserva a superfície administrativa já aprovada: somente usuários
-- autenticados chegam à função, e a própria RPC continua exigindo role owner.
REVOKE EXECUTE ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.owner_get_financial_dashboard(text,timestamptz,timestamptz) IS
  'Resumo financeiro owner-only baseado exclusivamente em pedidos pagos, válidos e com snapshot financeiro completo.';

-- Smoke test transacional da função com um owner real, sem alterar dados.
-- Exercita todos os filtros atualmente expostos pela interface e também o
-- caminho customizado suportado pela RPC.
DO $smoke$
DECLARE
  owner_id uuid;
  non_owner_id uuid;
  period_key text;
  dashboard jsonb;
BEGIN
  SELECT ur.user_id
    INTO owner_id
  FROM public.user_roles ur
  WHERE ur.role = 'owner'::public.app_role
  ORDER BY ur.user_id
  LIMIT 1;

  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum owner disponível para validar o Financeiro';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  FOREACH period_key IN ARRAY ARRAY['today', '7d', '30d', 'month', 'previous_month', 'year']
  LOOP
    dashboard := public.owner_get_financial_dashboard(period_key, NULL, NULL);

    IF dashboard IS NULL
      OR NOT (dashboard ? 'summary')
      OR NOT (dashboard ? 'trend')
      OR NOT (dashboard ? 'products')
      OR NOT (dashboard ? 'categories')
      OR NOT (dashboard ? 'excludedOrders') THEN
      RAISE EXCEPTION 'Resposta financeira incompleta para período %', period_key;
    END IF;

    IF COALESCE((dashboard #>> '{summary,revenue}')::numeric, 0) = 0
      AND COALESCE((dashboard #>> '{summary,margin}')::numeric, 0) <> 0 THEN
      RAISE EXCEPTION 'Margem inválida com faturamento zero no período %', period_key;
    END IF;

    IF round(
      COALESCE((dashboard #>> '{summary,profit}')::numeric, 0) * 0.05,
      2
    ) <> round(COALESCE((dashboard #>> '{summary,share5}')::numeric, 0), 2) THEN
      RAISE EXCEPTION 'Participação de 5%% divergente do lucro no período %', period_key;
    END IF;
  END LOOP;

  dashboard := public.owner_get_financial_dashboard(
    'custom',
    '2099-01-01T00:00:00-03:00'::timestamptz,
    '2099-01-02T00:00:00-03:00'::timestamptz
  );

  IF dashboard IS NULL
    OR COALESCE((dashboard #>> '{summary,revenue}')::numeric, 0) <> 0
    OR COALESCE((dashboard #>> '{summary,cost}')::numeric, 0) <> 0
    OR COALESCE((dashboard #>> '{summary,profit}')::numeric, 0) <> 0
    OR COALESCE((dashboard #>> '{summary,margin}')::numeric, 0) <> 0 THEN
    RAISE EXCEPTION 'Período sem vendas não retornou resumo zerado';
  END IF;

  -- Confirma também que a autorização interna da RPC continua bloqueando
  -- um usuário autenticado que não seja owner, quando houver um disponível.
  SELECT u.id
    INTO non_owner_id
  FROM auth.users u
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
      AND ur.role = 'owner'::public.app_role
  )
  ORDER BY u.id
  LIMIT 1;

  IF non_owner_id IS NOT NULL THEN
    PERFORM set_config('request.jwt.claim.sub', non_owner_id::text, true);
    PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

    BEGIN
      PERFORM public.owner_get_financial_dashboard('30d', NULL, NULL);
      RAISE EXCEPTION 'Usuário não-owner conseguiu executar o Financeiro';
    EXCEPTION
      WHEN OTHERS THEN
        IF SQLERRM = 'Usuário não-owner conseguiu executar o Financeiro' THEN
          RAISE;
        END IF;
        IF position('Acesso restrito ao administrador' IN SQLERRM) = 0 THEN
          RAISE EXCEPTION 'Falha inesperada ao validar bloqueio não-owner: %', SQLERRM;
        END IF;
    END;
  END IF;
END;
$smoke$;

COMMIT;
