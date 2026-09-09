BEGIN;

-- Catálogo canônico de patches da BIGofertas. A disponibilidade por produto
-- continua sendo controlada por product_purchase_settings.patches; esta lista
-- define apenas os códigos/labels que o storefront pode resolver.
UPDATE public.store_purchase_settings
SET
  patch_default_price = 15.00,
  patch_catalog = '[
    {"code":"brasileirao","label":"Brasileirão"},
    {"code":"copa-do-brasil","label":"Copa do Brasil"},
    {"code":"libertadores","label":"Libertadores"},
    {"code":"sul-americana","label":"Sul-Americana"},
    {"code":"liga-profesional-argentina","label":"Liga Profissional Argentina"},
    {"code":"copa-argentina","label":"Copa Argentina"},
    {"code":"liga-mx","label":"Liga MX"},
    {"code":"mundial-de-clubes","label":"Mundial de Clubes"},
    {"code":"premier-league","label":"Premier League"},
    {"code":"premier-league-champions","label":"Premier League — Campeão"},
    {"code":"fa-cup","label":"FA Cup"},
    {"code":"laliga","label":"LaLiga"},
    {"code":"copa-del-rey","label":"Copa del Rey"},
    {"code":"serie-a","label":"Serie A"},
    {"code":"coppa-italia","label":"Coppa Italia"},
    {"code":"bundesliga","label":"Bundesliga"},
    {"code":"dfb-pokal","label":"DFB-Pokal"},
    {"code":"ligue-1","label":"Ligue 1"},
    {"code":"coupe-de-france","label":"Coupe de France"},
    {"code":"mls","label":"MLS"},
    {"code":"leagues-cup","label":"Leagues Cup"},
    {"code":"concacaf-champions-cup","label":"Concacaf Champions Cup"},
    {"code":"liga-portugal","label":"Liga Portugal"},
    {"code":"taca-de-portugal","label":"Taça de Portugal"},
    {"code":"eredivisie","label":"Eredivisie"},
    {"code":"knvb-beker","label":"KNVB Beker"},
    {"code":"scottish-premiership","label":"Scottish Premiership"},
    {"code":"scottish-cup","label":"Scottish Cup"},
    {"code":"super-lig","label":"Süper Lig"},
    {"code":"turkish-cup","label":"Copa da Turquia"},
    {"code":"saudi-pro-league","label":"Saudi Pro League"},
    {"code":"kings-cup","label":"King''s Cup"},
    {"code":"afc-champions-league-elite","label":"AFC Champions League Elite"},
    {"code":"afc-champions-league-two","label":"AFC Champions League Two"},
    {"code":"caf-champions-league","label":"CAF Champions League"},
    {"code":"caf-confederation-cup","label":"CAF Confederation Cup"},
    {"code":"champions-league","label":"Champions League"},
    {"code":"europa-league","label":"Europa League"},
    {"code":"conference-league","label":"Conference League"},
    {"code":"fifa-club-world-champions","label":"FIFA — Campeão Mundial de Clubes"},
    {"code":"fifa-world-cup-2026","label":"Copa do Mundo FIFA 2026"},
    {"code":"fifa-world-champions","label":"FIFA — Campeão Mundial"},
    {"code":"euro","label":"UEFA EURO"},
    {"code":"uefa-nations-league","label":"UEFA Nations League"},
    {"code":"copa-america","label":"Copa América"},
    {"code":"afcon","label":"Copa Africana de Nações"},
    {"code":"afc-asian-cup","label":"Copa da Ásia AFC"},
    {"code":"concacaf-gold-cup","label":"Concacaf Gold Cup"},
    {"code":"concacaf-nations-league","label":"Concacaf Nations League"},
    {"code":"ofc-nations-cup","label":"OFC Nations Cup"}
  ]'::jsonb,
  updated_at = now()
WHERE singleton = true;

COMMIT;
