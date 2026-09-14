BEGIN;

-- Etapa 5: a descrição persistida passa a conter apenas conteúdo editorial.
-- A frase de versões é montada no storefront a partir das variantes ativas reais.
-- O domínio técnico bigofertas.net é preservado; somente a marca textual legada
-- fora do domínio é convertida para DropBox.
CREATE OR REPLACE FUNCTION public.clean_product_description(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
DECLARE
  cleaned text := COALESCE(p_description, '');
BEGIN
  cleaned := regexp_replace(
    cleaned,
    'Disponível com as opções( de tamanho e personalização)? configuradas pela (BIGofertas|DropBox)\.',
    '',
    'gi'
  );

  cleaned := regexp_replace(
    cleaned,
    'bigofertas(?![.]net)',
    'DropBox',
    'gi'
  );

  -- Remove metadados legados de versão; a informação atual vem das variantes reais.
  cleaned := regexp_replace(
    cleaned,
    '(^|[.!?][[:space:]]+|[[:space:]]+)Vers(ões|oes)[[:space:]]+dispon[ií]veis[[:space:]]*:[[:space:]]*[^.!?]{1,180}[.!?]?',
    '\1',
    'gi'
  );
  cleaned := regexp_replace(
    cleaned,
    '(^|[.!?][[:space:]]+|[[:space:]]+)Vers(ã|a)o[[:space:]]*:[[:space:]]*[^.!?]{1,120}[.!?]?',
    '\1',
    'gi'
  );
  cleaned := regexp_replace(
    cleaned,
    '(^|[.!?][[:space:]]+)Vers(ã|a)o[[:space:]]+[^.!?]{1,80}[.!?]',
    '\1',
    'gi'
  );

  cleaned := regexp_replace(cleaned, '[[:space:]]+', ' ', 'g');
  cleaned := regexp_replace(cleaned, '[[:space:]]+([,.;:!?])', '\1', 'g');
  cleaned := btrim(cleaned);

  RETURN NULLIF(cleaned, '');
END;
$$;

UPDATE public.products
SET description = public.clean_product_description(description)
WHERE description IS DISTINCT FROM public.clean_product_description(description);

CREATE OR REPLACE FUNCTION public.enforce_clean_product_description()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.description := public.clean_product_description(NEW.description);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS clean_product_description_before_write ON public.products;
CREATE TRIGGER clean_product_description_before_write
BEFORE INSERT OR UPDATE OF description ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.enforce_clean_product_description();

REVOKE ALL ON FUNCTION public.clean_product_description(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.enforce_clean_product_description() FROM PUBLIC;

COMMENT ON FUNCTION public.clean_product_description(text) IS
  'Etapa 5: preserva texto editorial, troca marca pública legada por DropBox e remove metadados de versão derivados.';

COMMIT;
