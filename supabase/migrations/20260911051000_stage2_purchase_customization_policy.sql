BEGIN;

-- Fase 2 da vitrine: todos os produtos continuam personalizáveis, exceto Shorts/calção.
-- Patches existentes dos demais produtos são preservados; o storefront só resolve códigos
-- que existam no catálogo canônico e, portanto, não inventamos patches incompatíveis.
UPDATE public.product_purchase_settings
SET
  personalization_enabled = commercial_type <> 'calcao',
  phrase_enabled = commercial_type <> 'calcao',
  patches = CASE
    WHEN commercial_type = 'calcao' THEN '[]'::jsonb
    ELSE patches
  END,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.enforce_product_purchase_customization_policy()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.commercial_type = 'calcao' THEN
    NEW.personalization_enabled := false;
    NEW.phrase_enabled := false;
    NEW.patches := '[]'::jsonb;
  ELSE
    NEW.personalization_enabled := true;
    NEW.phrase_enabled := true;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_product_purchase_customization_policy
ON public.product_purchase_settings;

CREATE TRIGGER enforce_product_purchase_customization_policy
BEFORE INSERT OR UPDATE OF commercial_type, personalization_enabled, phrase_enabled, patches
ON public.product_purchase_settings
FOR EACH ROW
EXECUTE FUNCTION public.enforce_product_purchase_customization_policy();

COMMIT;
