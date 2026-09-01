-- BIGofertas - Fase 01: saneamento da base atual
-- Remove exclusivamente o produto de demonstração criado pela migration inicial
-- do catálogo. A modelagem definitiva dos produtos será tratada na Fase 02.

DELETE FROM public.products
WHERE name = 'Camisa Profissional BIGofertas 2024'
  AND image_url = 'https://placehold.co/600x800/dc2626/ffffff?text=Camisa+BIGofertas';
