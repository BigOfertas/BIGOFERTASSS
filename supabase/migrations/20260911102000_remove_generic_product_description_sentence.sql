BEGIN;

-- Remove de verdade a frase genérica das descrições já cadastradas e impede
-- que importações futuras voltem a gravá-la. O restante da descrição é preservado.
CREATE OR REPLACE FUNCTION public.clean_product_description(p_description text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT NULLIF(
    btrim(
      regexp_replace(
        regexp_replace(
          COALESCE(p_description, ''),
          'Disponível com as opções( de tamanho e personalização)? configuradas pela (BIGofertas|DropBox)\.',
          '',
          'gi'
        ),
        '[[:space:]]+',
        ' ',
        'g'
      )
    ),
    ''
  );
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
  'Remove frases genéricas de opções/personalização das descrições públicas dos produtos.';

COMMIT;
