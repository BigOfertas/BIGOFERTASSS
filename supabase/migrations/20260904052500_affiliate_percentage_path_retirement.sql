BEGIN;

-- A regra percentual foi aposentada. As colunas antigas continuam apenas para
-- preservar snapshots historicos; novas configuracoes usam exclusivamente
-- comissao fixa por peca e suas faixas.

UPDATE public.affiliate_program_settings
SET commission_rate_bps = NULL,
    commission_base_mode = NULL,
    updated_at = now()
WHERE singleton = true;

REVOKE ALL ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric, text)
  FROM PUBLIC, anon, authenticated;

COMMENT ON FUNCTION public.owner_save_affiliate_program_draft(integer, text, integer, numeric, text) IS
  'LEGADO: configuracao percentual aposentada. O programa vigente usa faixas de valor fixo por peca.';
COMMENT ON FUNCTION public.owner_configure_affiliate_program(boolean, integer, text, integer, numeric, text) IS
  'LEGADO: configuracao percentual aposentada. O programa vigente usa faixas de valor fixo por peca.';

COMMIT;
