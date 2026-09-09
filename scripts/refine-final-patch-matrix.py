from pathlib import Path

rules = Path("scripts/catalog-business-rules.mjs")
value = rules.read_text()

def once(old: str, new: str, label: str):
    global value
    if old not in value:
        raise SystemExit(f"missing rules fragment: {label}")
    value = value.replace(old, new, 1)

once(
    '  Object.freeze({ code: "premier-league-champions", label: "Premier League — Campeão" }),\n',
    '  Object.freeze({ code: "premier-league-champions", label: "Premier League — Campeão" }),\n'
    '  Object.freeze({ code: "laliga-champions", label: "LaLiga — Campeão" }),\n'
    '  Object.freeze({ code: "ligue-1-champions", label: "Ligue 1 — Campeão" }),\n'
    '  Object.freeze({ code: "scudetto", label: "Scudetto" }),\n'
    '  Object.freeze({ code: "mls-cup-champions", label: "MLS — Campeão" }),\n',
    "domestic champion codes",
)
once(
    '  Object.freeze({ code: "champions-league-titleholder", label: "Champions League — Campeão" }),\n',
    '  Object.freeze({ code: "champions-league-titleholder", label: "Champions League — Campeão" }),\n'
    '  Object.freeze({ code: "champions-league-multiple-winner", label: "Champions League — Múltiplos vencedores" }),\n'
    '  Object.freeze({ code: "uefa-campaign", label: "UEFA — Campanha oficial" }),\n',
    "UEFA auxiliary codes",
)
once(
    "const CONMEBOL_2026 = Object.freeze({",
    'const UCL_MULTIPLE_WINNERS = Object.freeze(["REAL MADRID", "MILAN", "AC MILAN", "BAYERN", "LIVERPOOL", "BARCELONA"]);\n\nconst CONMEBOL_2026 = Object.freeze({',
    "multiple winner teams",
)
once(
    '  const uefaPatch = inferUefa2627Patch(source);\n  if (uefaPatch) addPatch(codes, uefaPatch);\n  return codes;',
    '  const uefaPatch = inferUefa2627Patch(source);\n  if (uefaPatch) {\n    addPatch(codes, uefaPatch);\n    addPatch(codes, "uefa-campaign");\n    if (uefaPatch === "champions-league" && anyAlias(source, UCL_MULTIPLE_WINNERS))\n      addPatch(codes, "champions-league-multiple-winner");\n  }\n  return codes;',
    "UEFA badges",
)
once(
    '  if (national.key === "ESPANHA" && currentSeason2627(source)) {\n    addPatch(codes, "fifa-world-champions");\n    addPatch(codes, "euro-titleholder");\n  }',
    '  if (national.key === "ESPANHA" && currentSeason2627(source)) {\n    addPatch(codes, "euro-titleholder");\n  }',
    "Spain world champion correction",
)
once(
    '  if (national.key === "ARGENTINA" && currentSeason2627(source))\n    addPatch(codes, "copa-america-titleholder");',
    '  if (national.key === "ARGENTINA" && currentSeason2627(source)) {\n    addPatch(codes, "fifa-world-champions");\n    addPatch(codes, "copa-america-titleholder");\n  }',
    "Argentina champion badges",
)
old_special = '''function inferSpecialClubPatches(source) {
  const codes = new Set();
  if (currentSeason2627(source) && aliasInSource(source, "CHELSEA"))
    addPatch(codes, "fifa-club-world-champions");
  if (currentSeason2627(source) && aliasInSource(source, "ARSENAL"))
    addPatch(codes, "premier-league-champions");
  if (currentSeason2627(source) && anyAlias(source, ["PSG", "PARIS SAINT GERMAIN"]))
    addPatch(codes, "champions-league-titleholder");
  return codes;
}'''
new_special = '''function inferSpecialClubPatches(source) {
  const codes = new Set();
  if (!currentSeason2627(source)) return codes;
  if (aliasInSource(source, "CHELSEA")) addPatch(codes, "fifa-club-world-champions");
  if (aliasInSource(source, "ARSENAL")) addPatch(codes, "premier-league-champions");
  if (aliasInSource(source, "BARCELONA")) addPatch(codes, "laliga-champions");
  if (anyAlias(source, ["PSG", "PARIS SAINT GERMAIN"])) {
    addPatch(codes, "ligue-1-champions");
    addPatch(codes, "champions-league-titleholder");
  }
  if (anyAlias(source, ["INTER DE MILAO", "INTER MILAN", "INTERNAZIONALE"]))
    addPatch(codes, "scudetto");
  if (aliasInSource(source, "INTER MIAMI")) addPatch(codes, "mls-cup-champions");
  if (aliasInSource(source, "ASTON VILLA")) addPatch(codes, "europa-league-titleholder");
  if (aliasInSource(source, "CRYSTAL PALACE")) addPatch(codes, "conference-league-titleholder");
  return codes;
}'''
once(old_special, new_special, "special club badges")
once(
    '  if (codes.has("conference-league-titleholder")) codes.delete("conference-league");\n}',
    '  if (codes.has("conference-league-titleholder")) codes.delete("conference-league");\n  if (codes.has("laliga-champions")) codes.delete("laliga");\n  if (codes.has("ligue-1-champions")) codes.delete("ligue-1");\n  if (codes.has("mls-cup-champions")) codes.delete("mls");\n}',
    "champion replacement rules",
)
rules.write_text(value)

migration = Path("supabase/migrations/20260909143000_global_patch_matrix.sql")
m = migration.read_text()
m = m.replace(
    '    {"code":"premier-league-champions","label":"Premier League — Campeão"},\n',
    '    {"code":"premier-league-champions","label":"Premier League — Campeão"},\n'
    '    {"code":"laliga-champions","label":"LaLiga — Campeão"},\n'
    '    {"code":"ligue-1-champions","label":"Ligue 1 — Campeão"},\n'
    '    {"code":"scudetto","label":"Scudetto"},\n'
    '    {"code":"mls-cup-champions","label":"MLS — Campeão"},\n',
    1,
)
m = m.replace(
    '    {"code":"champions-league-titleholder","label":"Champions League — Campeão"},\n',
    '    {"code":"champions-league-titleholder","label":"Champions League — Campeão"},\n'
    '    {"code":"champions-league-multiple-winner","label":"Champions League — Múltiplos vencedores"},\n'
    '    {"code":"uefa-campaign","label":"UEFA — Campanha oficial"},\n',
    1,
)
migration.write_text(m)

test = Path("scripts/validate-catalog-business-rules.mjs")
t = test.read_text()
start = t.index("const vasco = patchCodes")
end = t.index("const nationalCases = [")
replacement = '''const vasco = patchCodes({ name: "CAMISA I VASCO 26/27 ADIDAS", team: "VASCO" });
hasAll(vasco, ["brasileirao", "copa-do-brasil", "sul-americana"], "Vasco");
hasNone(vasco, ["libertadores", "mundial-de-clubes"], "Vasco");

const flamengo = patchCodes({ name: "CAMISA I FLAMENGO 26/27 ADIDAS", team: "FLAMENGO" });
hasAll(flamengo, ["brasileirao", "copa-do-brasil", "libertadores"], "Flamengo");
hasNone(flamengo, ["sul-americana", "mundial-de-clubes"], "Flamengo");

const manCity = patchCodes({ name: "CAMISA II MANCHESTER CITY 26/27 PUMA", league: "Premier League" });
hasAll(manCity, ["premier-league", "fa-cup", "champions-league", "uefa-campaign"], "Man City");
hasNone(manCity, ["europa-league", "conference-league", "mundial-de-clubes"], "Man City");

const chelsea = patchCodes({ name: "CAMISA I CHELSEA 26/27 NIKE", league: "Premier League" });
hasAll(chelsea, ["premier-league", "fa-cup", "fifa-club-world-champions"], "Chelsea");
hasNone(chelsea, ["mundial-de-clubes", "champions-league", "europa-league", "conference-league"], "Chelsea");

const arsenal = patchCodes({ name: "CAMISA I ARSENAL 26/27 ADIDAS", league: "Premier League" });
hasAll(arsenal, ["premier-league", "premier-league-champions", "fa-cup", "champions-league", "uefa-campaign"], "Arsenal");

const bayern = patchCodes({ name: "CAMISA I BAYERN 26/27 ADIDAS", league: "Bundesliga" });
hasAll(bayern, ["bundesliga", "dfb-pokal", "champions-league", "champions-league-multiple-winner", "uefa-campaign"], "Bayern");

const psg = patchCodes({ name: "CAMISA I PSG 26/27 NIKE", league: "Ligue 1" });
hasAll(psg, ["ligue-1-champions", "coupe-de-france", "champions-league-titleholder", "uefa-campaign"], "PSG");
hasNone(psg, ["ligue-1", "champions-league"], "PSG");

const astonVilla = patchCodes({ name: "CAMISA I ASTON VILLA 26/27 ADIDAS", league: "Premier League" });
hasAll(astonVilla, ["premier-league", "fa-cup", "champions-league", "europa-league-titleholder", "uefa-campaign"], "Aston Villa");

const crystalPalace = patchCodes({ name: "CAMISA I CRYSTAL PALACE 26/27 MACRON", league: "Premier League" });
hasAll(crystalPalace, ["premier-league", "fa-cup", "europa-league", "conference-league-titleholder", "uefa-campaign"], "Crystal Palace");

const barcelona = patchCodes({ name: "CAMISA II BARCELONA 26/27 NIKE", league: "LaLiga" });
hasAll(barcelona, ["laliga-champions", "copa-del-rey", "champions-league", "champions-league-multiple-winner", "uefa-campaign"], "Barcelona");
hasNone(barcelona, ["laliga"], "Barcelona");

const milan = patchCodes({ name: "CAMISA II MILAN 26/27 PUMA", league: "Serie A Italia" });
hasAll(milan, ["serie-a", "coppa-italia", "europa-league", "uefa-campaign"], "Milan");
hasNone(milan, ["champions-league", "mundial-de-clubes", "champions-league-multiple-winner"], "Milan");

const lyon = patchCodes({ name: "CAMISA II LYON 26/27 ADIDAS", league: "Ligue 1" });
hasAll(lyon, ["ligue-1", "coupe-de-france", "europa-league", "uefa-campaign"], "Lyon");

const benfica = patchCodes({ name: "CAMISA I BENFICA 26/27 ADIDAS", league: "Liga Portugal" });
hasAll(benfica, ["liga-portugal", "taca-de-portugal", "europa-league", "uefa-campaign"], "Benfica");
hasNone(benfica, ["mundial-de-clubes"], "Benfica");

const argentinaClub = patchCodes({ name: "CAMISA I RIVER PLATE 26/27 ADIDAS" });
hasAll(argentinaClub, ["liga-profesional-argentina", "copa-argentina"], "River Plate");
hasNone(argentinaClub, ["libertadores", "sul-americana", "mundial-de-clubes"], "River Plate");

const interMiami = patchCodes({ name: "CAMISA I INTER MIAMI 26/27 ADIDAS", league: "MLS" });
hasAll(interMiami, ["leagues-cup", "mls-cup-champions"], "Inter Miami");
hasNone(interMiami, ["mls", "concacaf-champions-cup", "mundial-de-clubes"], "Inter Miami");

'''
t = t[:start] + replacement + t[end:]
t = t.replace(
    '[\n      "fifa-world-cup-2026",\n      "fifa-world-champions",\n      "euro",',
    '[\n      "fifa-world-cup-2026",\n      "euro",',
    1,
)
t = t.replace(
    'patchCodes({ name: "CAMISA I ARGENTINA 26/27 ADIDAS", selecao: "Argentina" }),\n  ["copa-america-titleholder"],',
    'patchCodes({ name: "CAMISA I ARGENTINA 26/27 ADIDAS", selecao: "Argentina" }),\n  ["fifa-world-champions", "copa-america-titleholder"],',
    1,
)
t = t.replace("assert.ok(PATCH_CATALOG.length >= 50", "assert.ok(PATCH_CATALOG.length >= 56", 1)
test.write_text(t)

print("FINAL_PATCH_MATRIX_REFINED")
