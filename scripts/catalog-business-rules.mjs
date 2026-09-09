const clean = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();

export function normalizeCatalogText(value) {
  return clean(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
}

export const CATALOG_SIZES = Object.freeze(["P", "M", "G", "GG", "2GG", "3GG", "4XL"]);

export const COMMERCIAL_TYPE_PRICES = Object.freeze({
  torcedor: 184.9,
  feminino: 184.9,
  jogador: 219.9,
  retro: 219.9,
  infantil: 169.9,
  calcao: 159.9,
  basquete: 229.9,
});

export const PERSONALIZATION_RULES = Object.freeze({
  normalPrice: 25,
  normalNameMax: 12,
  phrasePrice: 45,
  phraseMax: 50,
  patchPrice: 15,
});

export const PATCH_CATALOG = Object.freeze([
  Object.freeze({ code: "brasileirao", label: "Brasileirão" }),
  Object.freeze({ code: "copa-do-brasil", label: "Copa do Brasil" }),
  Object.freeze({ code: "libertadores", label: "Libertadores" }),
  Object.freeze({ code: "sul-americana", label: "Sul-Americana" }),
  Object.freeze({ code: "liga-profesional-argentina", label: "Liga Profissional Argentina" }),
  Object.freeze({ code: "copa-argentina", label: "Copa Argentina" }),
  Object.freeze({ code: "liga-mx", label: "Liga MX" }),
  Object.freeze({ code: "copa-mx", label: "Copa do México" }),
  Object.freeze({ code: "mundial-de-clubes", label: "Mundial de Clubes" }),
  Object.freeze({ code: "premier-league", label: "Premier League" }),
  Object.freeze({ code: "premier-league-champions", label: "Premier League — Campeão" }),
  Object.freeze({ code: "fa-cup", label: "FA Cup" }),
  Object.freeze({ code: "laliga", label: "LaLiga" }),
  Object.freeze({ code: "copa-del-rey", label: "Copa del Rey" }),
  Object.freeze({ code: "serie-a", label: "Serie A" }),
  Object.freeze({ code: "coppa-italia", label: "Coppa Italia" }),
  Object.freeze({ code: "bundesliga", label: "Bundesliga" }),
  Object.freeze({ code: "dfb-pokal", label: "DFB-Pokal" }),
  Object.freeze({ code: "ligue-1", label: "Ligue 1" }),
  Object.freeze({ code: "coupe-de-france", label: "Coupe de France" }),
  Object.freeze({ code: "mls", label: "MLS" }),
  Object.freeze({ code: "leagues-cup", label: "Leagues Cup" }),
  Object.freeze({ code: "concacaf-champions-cup", label: "Concacaf Champions Cup" }),
  Object.freeze({ code: "liga-portugal", label: "Liga Portugal" }),
  Object.freeze({ code: "taca-de-portugal", label: "Taça de Portugal" }),
  Object.freeze({ code: "eredivisie", label: "Eredivisie" }),
  Object.freeze({ code: "knvb-beker", label: "KNVB Beker" }),
  Object.freeze({ code: "scottish-premiership", label: "Scottish Premiership" }),
  Object.freeze({ code: "scottish-cup", label: "Scottish Cup" }),
  Object.freeze({ code: "super-lig", label: "Süper Lig" }),
  Object.freeze({ code: "turkish-cup", label: "Copa da Turquia" }),
  Object.freeze({ code: "saudi-pro-league", label: "Saudi Pro League" }),
  Object.freeze({ code: "kings-cup", label: "King's Cup" }),
  Object.freeze({ code: "afc-champions-league-elite", label: "AFC Champions League Elite" }),
  Object.freeze({ code: "afc-champions-league-two", label: "AFC Champions League Two" }),
  Object.freeze({ code: "caf-champions-league", label: "CAF Champions League" }),
  Object.freeze({ code: "caf-confederation-cup", label: "CAF Confederation Cup" }),
  Object.freeze({ code: "champions-league", label: "Champions League" }),
  Object.freeze({ code: "europa-league", label: "Europa League" }),
  Object.freeze({ code: "conference-league", label: "Conference League" }),
  Object.freeze({ code: "fifa-club-world-champions", label: "FIFA — Campeão Mundial de Clubes" }),
  Object.freeze({ code: "fifa-world-cup-2026", label: "Copa do Mundo FIFA 2026" }),
  Object.freeze({ code: "fifa-world-champions", label: "FIFA — Campeão Mundial" }),
  Object.freeze({ code: "euro", label: "UEFA EURO" }),
  Object.freeze({ code: "uefa-nations-league", label: "UEFA Nations League" }),
  Object.freeze({ code: "copa-america", label: "Copa América" }),
  Object.freeze({ code: "afcon", label: "Copa Africana de Nações" }),
  Object.freeze({ code: "afc-asian-cup", label: "Copa da Ásia AFC" }),
  Object.freeze({ code: "concacaf-gold-cup", label: "Concacaf Gold Cup" }),
  Object.freeze({ code: "concacaf-nations-league", label: "Concacaf Nations League" }),
  Object.freeze({ code: "ofc-nations-cup", label: "OFC Nations Cup" }),
]);

const PATCH_ORDER = new Map(PATCH_CATALOG.map((patch, index) => [patch.code, index]));

const NATIONAL_TEAMS = Object.freeze([
  ["UEFA", "ALEMANHA", ["ALEMANHA", "GERMANY"]],
  ["CONMEBOL", "ARGENTINA", ["ARGENTINA"]],
  ["AFC", "AUSTRALIA", ["AUSTRALIA"]],
  ["CAF", "ARGELIA", ["ARGELIA", "ALGERIA"]],
  ["CAF", "AFRICA DO SUL", ["AFRICA DO SUL", "SOUTH AFRICA"]],
  ["UEFA", "AUSTRIA", ["AUSTRIA"]],
  ["UEFA", "ALBANIA", ["ALBANIA"]],
  ["UEFA", "BELGICA", ["BELGICA", "BELGIUM"]],
  ["CONMEBOL", "BOLIVIA", ["BOLIVIA"]],
  ["CONMEBOL", "BRASIL", ["BRASIL", "BRAZIL"]],
  ["CONCACAF", "CANADA", ["CANADA"]],
  ["CONMEBOL", "CHILE", ["CHILE"]],
  ["CONMEBOL", "COLOMBIA", ["COLOMBIA"]],
  ["CAF", "COSTA DO MARFIM", ["COSTA DO MARFIM", "C. DO MARFIM", "IVORY COAST", "COTE D IVOIRE"]],
  ["AFC", "COREIA", ["COREIA", "COREIA DO SUL", "SOUTH KOREA", "KOREA REPUBLIC"]],
  ["UEFA", "CROACIA", ["CROACIA", "CROATIA"]],
  ["UEFA", "DINAMARCA", ["DINAMARCA", "DENMARK"]],
  ["CONMEBOL", "EQUADOR", ["EQUADOR", "ECUADOR"]],
  ["CAF", "EGITO", ["EGITO", "EGYPT"]],
  ["UEFA", "ESCOCIA", ["ESCOCIA", "SCOTLAND"]],
  ["CONCACAF", "ESTADOS UNIDOS", ["ESTADOS UNIDOS", "EUA", "USA", "UNITED STATES"]],
  ["UEFA", "ESPANHA", ["ESPANHA", "SPAIN"]],
  ["UEFA", "FRANCA", ["FRANCA", "FRANCE"]],
  ["UEFA", "GALES", ["GALES", "WALES"]],
  ["CAF", "GHANA", ["GHANA", "GANA"]],
  ["UEFA", "HOLANDA", ["HOLANDA", "NETHERLANDS", "PAISES BAIXOS"]],
  ["UEFA", "INGLATERRA", ["INGLATERRA", "ENGLAND"]],
  ["UEFA", "IRLANDA", ["IRLANDA", "IRELAND"]],
  ["UEFA", "ITALIA", ["ITALIA", "ITALY"]],
  ["CONCACAF", "JAMAICA", ["JAMAICA"]],
  ["AFC", "JAPAO", ["JAPAO", "JAPAN"]],
  ["CAF", "MARROCOS", ["MARROCOS", "MOROCCO"]],
  ["CAF", "MALI", ["MALI"]],
  ["CONCACAF", "MEXICO", ["MEXICO"]],
  ["CAF", "NIGERIA", ["NIGERIA"]],
  ["UEFA", "NORUEGA", ["NORUEGA", "NORWAY"]],
  ["OFC", "NOVA ZELANDIA", ["NOVA ZELANDIA", "NEW ZEALAND"]],
  ["CONMEBOL", "PARAGUAI", ["PARAGUAI", "PARAGUAY"]],
  ["CONMEBOL", "PERU", ["PERU"]],
  ["UEFA", "POLONIA", ["POLONIA", "POLAND"]],
  ["UEFA", "PORTUGAL", ["PORTUGAL"]],
  ["UEFA", "SUECIA", ["SUECIA", "SWEDEN"]],
  ["UEFA", "SERVIA", ["SERVIA", "SERBIA"]],
  ["UEFA", "SUICA", ["SUICA", "SWITZERLAND"]],
  ["CAF", "SENEGAL", ["SENEGAL"]],
  ["UEFA", "TURQUIA", ["TURQUIA", "TURKEY", "TURKIYE"]],
  ["CONMEBOL", "URUGUAI", ["URUGUAI", "URUGUAY"]],
  ["CONMEBOL", "VENEZUELA", ["VENEZUELA"]],
]);

const WORLD_CUP_2026_TEAMS = new Set([
  "ALEMANHA",
  "ARGENTINA",
  "AUSTRALIA",
  "ARGELIA",
  "AFRICA DO SUL",
  "AUSTRIA",
  "BELGICA",
  "BRASIL",
  "CANADA",
  "COLOMBIA",
  "COSTA DO MARFIM",
  "COREIA",
  "CROACIA",
  "EQUADOR",
  "EGITO",
  "ESCOCIA",
  "ESTADOS UNIDOS",
  "ESPANHA",
  "FRANCA",
  "GHANA",
  "HOLANDA",
  "INGLATERRA",
  "JAPAO",
  "MARROCOS",
  "MEXICO",
  "NORUEGA",
  "NOVA ZELANDIA",
  "PARAGUAI",
  "PORTUGAL",
  "SUECIA",
  "SUICA",
  "SENEGAL",
  "TURQUIA",
  "URUGUAI",
]);

const CLUB_WORLD_CUP_2025 = Object.freeze([
  "PALMEIRAS",
  "PORTO",
  "AL AHLY",
  "INTER MIAMI",
  "PSG",
  "PARIS SAINT GERMAIN",
  "ATLETICO MADRID",
  "BOTAFOGO",
  "SEATTLE SOUNDERS",
  "BAYERN",
  "AUCKLAND CITY",
  "BOCA JUNIORS",
  "BENFICA",
  "FLAMENGO",
  "ESPERANCE",
  "CHELSEA",
  "LAFC",
  "LOS ANGELES FC",
  "RIVER PLATE",
  "URAWA",
  "MONTERREY",
  "INTER DE MILAO",
  "INTER MILAN",
  "INTERNAZIONALE",
  "FLUMINENSE",
  "DORTMUND",
  "BORUSSIA DORTMUND",
  "ULSAN",
  "MAMELODI SUNDOWNS",
  "MANCHESTER CITY",
  "MAN CITY",
  "WYDAD",
  "AL AIN",
  "JUVENTUS",
  "REAL MADRID",
  "AL HILAL",
  "PACHUCA",
  "SALZBURG",
]);

const UEFA_2627 = Object.freeze({
  "champions-league": Object.freeze([
    "ARSENAL",
    "ASTON VILLA",
    "LIVERPOOL",
    "MANCHESTER CITY",
    "MAN CITY",
    "MANCHESTER UNITED",
    "MAN UNITED",
    "LENS",
    "LILLE",
    "PSG",
    "PARIS SAINT GERMAIN",
    "BAYERN",
    "DORTMUND",
    "BORUSSIA DORTMUND",
    "LEIPZIG",
    "STUTTGART",
    "COMO",
    "INTER DE MILAO",
    "INTER MILAN",
    "INTERNAZIONALE",
    "NAPOLI",
    "ROMA",
    "FEYENOORD",
    "PSV",
    "PORTO",
    "SPORTING CP",
    "ATLETICO MADRID",
    "BARCELONA",
    "REAL BETIS",
    "REAL MADRID",
    "VILLARREAL",
    "FENERBAHCE",
    "GALATASARAY",
    "CLUB BRUGGE",
    "SLAVIA PRAHA",
    "AEK ATHENS",
    "BODO GLIMT",
    "VIKING",
    "SLOVAN BRATISLAVA",
    "SABAH",
    "LASK",
  ]),
  "europa-league": Object.freeze([
    "CRYSTAL PALACE",
    "BOURNEMOUTH",
    "SUNDERLAND",
    "MILAN",
    "AC MILAN",
    "JUVENTUS",
    "REAL SOCIEDAD",
    "CELTA",
    "HOFFENHEIM",
    "LEVERKUSEN",
    "BAYER LEVERKUSEN",
    "MARSEILLE",
    "RENNES",
    "AZ ALKMAAR",
    "CELTIC",
    "LYON",
    "OLYMPIQUE LYON",
    "OLYMPIACOS",
    "SPARTA PRAHA",
    "STURM GRAZ",
    "UNION SG",
    "ANDERLECHT",
    "BENFICA",
    "BESIKTAS",
    "FERENCVAROS",
    "SALZBURG",
    "VIKTORIA PLZEN",
    "GNK DINAMO",
    "LECH POZNAN",
    "OMONIA",
  ]),
  "conference-league": Object.freeze([
    "BRIGHTON",
    "ATALANTA",
    "GETAFE",
    "FREIBURG",
    "MONACO",
    "BRAGA",
    "AJAX",
    "TWENTE",
    "GENT",
    "TRABZONSPOR",
    "PANATHINAIKOS",
    "COPENHAGEN",
    "MIDTJYLLAND",
    "BRANN",
    "PAFOS",
    "LUGANO",
    "HEARTS",
    "HAJDUK SPLIT",
    "CRVENA ZVEZDA",
    "RED STAR",
    "KAIRAT",
    "CSKA SOFIA",
    "KUOPIO",
    "BORAC",
    "RIGA",
  ]),
});

const CLUB_DOMESTIC_RULES = Object.freeze([
  {
    patches: [
      "brasileirao",
      "libertadores",
      "sul-americana",
      "copa-do-brasil",
      "mundial-de-clubes",
    ],
    leagueMarkers: ["BRASILEIRAO", "CAMPEONATO BRASILEIRO", "SERIE A BRASIL"],
    clubs: [
      "ATLETICO MINEIRO",
      "BAHIA",
      "BOTAFOGO",
      "CORINTHIANS",
      "CRUZEIRO",
      "FLAMENGO",
      "FLUMINENSE",
      "FORTALEZA",
      "GREMIO",
      "INTERNACIONAL",
      "PALMEIRAS",
      "SANTOS",
      "SAO PAULO",
      "VASCO",
    ],
  },
  {
    patches: ["liga-profesional-argentina", "copa-argentina", "libertadores", "sul-americana"],
    leagueMarkers: ["LIGA PROFESIONAL ARGENTINA", "PRIMERA DIVISION ARGENTINA"],
    clubs: [
      "BOCA JUNIORS",
      "RIVER PLATE",
      "RACING CLUB",
      "INDEPENDIENTE",
      "SAN LORENZO",
      "ESTUDIANTES",
      "VELEZ SARSFIELD",
    ],
  },
  {
    patches: ["premier-league", "fa-cup"],
    leagueMarkers: ["PREMIER LEAGUE"],
    clubs: [
      "ARSENAL",
      "ASTON VILLA",
      "BOURNEMOUTH",
      "BRENTFORD",
      "BRIGHTON",
      "BURNLEY",
      "CHELSEA",
      "CRYSTAL PALACE",
      "EVERTON",
      "FULHAM",
      "LEEDS",
      "LIVERPOOL",
      "MANCHESTER CITY",
      "MAN CITY",
      "MANCHESTER UNITED",
      "MAN UNITED",
      "NEWCASTLE",
      "NOTTINGHAM FOREST",
      "SUNDERLAND",
      "TOTTENHAM",
      "WEST HAM",
      "WOLVES",
      "WOLVERHAMPTON",
    ],
  },
  {
    patches: ["laliga", "copa-del-rey"],
    leagueMarkers: ["LA LIGA", "LALIGA"],
    clubs: [
      "ALAVES",
      "ATHLETIC BILBAO",
      "ATHLETIC CLUB",
      "ATLETICO MADRID",
      "BARCELONA",
      "CELTA",
      "ELCHE",
      "ESPANYOL",
      "GETAFE",
      "GIRONA",
      "LEVANTE",
      "MALLORCA",
      "OSASUNA",
      "OVIEDO",
      "RAYO VALLECANO",
      "REAL BETIS",
      "REAL MADRID",
      "REAL SOCIEDAD",
      "SEVILLA",
      "VALENCIA",
      "VILLARREAL",
    ],
  },
  {
    patches: ["serie-a", "coppa-italia"],
    leagueMarkers: ["SERIE A ITALIA"],
    clubs: [
      "ATALANTA",
      "BOLOGNA",
      "CAGLIARI",
      "COMO",
      "FIORENTINA",
      "GENOA",
      "INTER DE MILAO",
      "INTER MILAN",
      "INTERNAZIONALE",
      "JUVENTUS",
      "LAZIO",
      "LECCE",
      "MILAN",
      "AC MILAN",
      "NAPOLI",
      "PARMA",
      "ROMA",
      "SASSUOLO",
      "TORINO",
      "UDINESE",
    ],
  },
  {
    patches: ["bundesliga", "dfb-pokal"],
    leagueMarkers: ["BUNDESLIGA"],
    clubs: [
      "AUGSBURG",
      "BAYERN",
      "DORTMUND",
      "BORUSSIA DORTMUND",
      "BORUSSIA MONCHENGLADBACH",
      "EINTRACHT FRANKFURT",
      "FREIBURG",
      "HAMBURG",
      "HEIDENHEIM",
      "HOFFENHEIM",
      "KOLN",
      "COLOGNE",
      "LEIPZIG",
      "LEVERKUSEN",
      "BAYER LEVERKUSEN",
      "MAINZ",
      "ST PAULI",
      "STUTTGART",
      "UNION BERLIN",
      "WERDER BREMEN",
      "WOLFSBURG",
    ],
  },
  {
    patches: ["ligue-1", "coupe-de-france"],
    leagueMarkers: ["LIGUE 1"],
    clubs: [
      "AUXERRE",
      "BREST",
      "LENS",
      "LILLE",
      "LORIENT",
      "LYON",
      "OLYMPIQUE LYON",
      "MARSEILLE",
      "MONACO",
      "NANTES",
      "NICE",
      "PARIS FC",
      "PSG",
      "PARIS SAINT GERMAIN",
      "RENNES",
      "STRASBOURG",
      "TOULOUSE",
    ],
  },
  {
    patches: ["mls", "leagues-cup", "concacaf-champions-cup"],
    leagueMarkers: ["MLS", "MAJOR LEAGUE SOCCER"],
    clubs: [
      "ATLANTA UNITED",
      "AUSTIN FC",
      "CHARLOTTE FC",
      "CHICAGO FIRE",
      "CINCINNATI",
      "COLORADO RAPIDS",
      "COLUMBUS CREW",
      "DC UNITED",
      "FC DALLAS",
      "HOUSTON DYNAMO",
      "INTER MIAMI",
      "LA GALAXY",
      "LAFC",
      "LOS ANGELES FC",
      "MINNESOTA UNITED",
      "MONTREAL",
      "NASHVILLE",
      "NEW ENGLAND REVOLUTION",
      "NEW YORK CITY",
      "NYCFC",
      "NEW YORK RED BULLS",
      "ORLANDO CITY",
      "PHILADELPHIA UNION",
      "PORTLAND TIMBERS",
      "REAL SALT LAKE",
      "SAN DIEGO FC",
      "SAN JOSE EARTHQUAKES",
      "SEATTLE SOUNDERS",
      "SPORTING KANSAS CITY",
      "ST LOUIS CITY",
      "TORONTO FC",
      "VANCOUVER WHITECAPS",
    ],
  },
  {
    patches: ["liga-mx", "leagues-cup", "concacaf-champions-cup"],
    leagueMarkers: ["LIGA MX"],
    clubs: [
      "AMERICA MEXICO",
      "CLUB AMERICA",
      "CHIVAS",
      "GUADALAJARA",
      "CRUZ AZUL",
      "MONTERREY",
      "PACHUCA",
      "PUMAS",
      "TIGRES",
    ],
  },
  {
    patches: ["liga-portugal", "taca-de-portugal"],
    leagueMarkers: ["LIGA PORTUGAL", "PRIMEIRA LIGA"],
    clubs: ["BENFICA", "PORTO", "SPORTING CP", "BRAGA", "VITORIA GUIMARAES"],
  },
  {
    patches: ["eredivisie", "knvb-beker"],
    leagueMarkers: ["EREDIVISIE"],
    clubs: ["AJAX", "PSV", "FEYENOORD", "AZ ALKMAAR", "TWENTE"],
  },
  {
    patches: ["scottish-premiership", "scottish-cup"],
    leagueMarkers: ["SCOTTISH PREMIERSHIP"],
    clubs: ["CELTIC", "RANGERS", "HEARTS", "HIBERNIAN"],
  },
  {
    patches: ["super-lig", "turkish-cup"],
    leagueMarkers: ["SUPER LIG"],
    clubs: ["GALATASARAY", "FENERBAHCE", "BESIKTAS", "TRABZONSPOR"],
  },
  {
    patches: ["saudi-pro-league", "kings-cup", "afc-champions-league-elite"],
    leagueMarkers: ["SAUDI PRO LEAGUE"],
    clubs: ["AL HILAL", "AL NASSR", "AL ITTIHAD", "AL AHLI"],
  },
]);

const NO_PATCH_PRODUCT =
  /\b(BASQUETE|BASKET|NBA|SHORTS?|CALCAO|TREINO|VIAGEM|CORTA VENTO|WINDBREAKER|JAQUETA|CASACO|AGASALHO)\b/;

const EXPLICIT_PATCH_PATTERNS = Object.freeze([
  ["champions-league", /\b(CHAMPIONS LEAGUE|UCL)\b/],
  ["europa-league", /\b(EUROPA LEAGUE|UEL)\b/],
  ["conference-league", /\b(CONFERENCE LEAGUE|UECL)\b/],
  ["libertadores", /\bLIBERTADORES\b/],
  ["sul-americana", /\b(SUL AMERICANA|SUDAMERICANA)\b/],
  ["copa-do-brasil", /\bCOPA DO BRASIL\b/],
  ["brasileirao", /\b(BRASILEIRAO|CAMPEONATO BRASILEIRO)\b/],
  ["mundial-de-clubes", /\b(MUNDIAL DE CLUBES|CLUB WORLD CUP)\b/],
  ["fifa-world-cup-2026", /\b(COPA DO MUNDO|WORLD CUP)\b/],
  ["euro", /\b(UEFA EURO|EUROCOPA)\b/],
  ["uefa-nations-league", /\bNATIONS LEAGUE\b/],
  ["copa-america", /\bCOPA AMERICA\b/],
  ["afcon", /\b(AFCON|COPA AFRICANA)\b/],
  ["afc-asian-cup", /\b(ASIAN CUP|COPA DA ASIA)\b/],
  ["concacaf-gold-cup", /\b(GOLD CUP|COPA OURO)\b/],
  ["concacaf-nations-league", /\bCONCACAF NATIONS LEAGUE\b/],
  ["ofc-nations-cup", /\bOFC NATIONS CUP\b/],
]);

function sourceText(product) {
  return normalizeCatalogText(
    [
      product?.name,
      product?.nome,
      product?.tipo_produto,
      product?.type,
      product?.audience,
      product?.publico,
      product?.competition,
      product?.campeonato,
      product?.league,
      product?.liga,
      product?.team,
      product?.time,
      product?.selecao,
      product?.season,
      product?.temporada,
      product?.category,
      product?.categoria,
    ]
      .filter(Boolean)
      .join(" "),
  );
}

function aliasInSource(source, alias) {
  const normalized = normalizeCatalogText(alias);
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^A-Z0-9])${escaped}([^A-Z0-9]|$)`).test(source);
}

function anyAlias(source, aliases) {
  return aliases.some((alias) => aliasInSource(source, alias));
}

function addPatch(target, code) {
  if (PATCH_ORDER.has(code)) target.add(code);
}

function finalizePatches(codes) {
  return [...codes]
    .sort((a, b) => (PATCH_ORDER.get(a) ?? 999) - (PATCH_ORDER.get(b) ?? 999))
    .map((code) => ({ code, enabled: true }));
}

function currentSeason2627(source) {
  return /\b(26[/-]27|2026[/-]27|2026 27)\b/.test(source);
}

function explicitPatches(source) {
  const result = new Set();
  for (const [code, pattern] of EXPLICIT_PATCH_PATTERNS) {
    if (pattern.test(source)) addPatch(result, code);
  }
  return result;
}

function identifyNationalTeam(source, product) {
  const explicitSelection = normalizeCatalogText(product?.selecao ?? "");
  for (const [confed, key, aliases] of NATIONAL_TEAMS) {
    if ((explicitSelection && anyAlias(explicitSelection, aliases)) || anyAlias(source, aliases)) {
      return { confed, key };
    }
  }
  return null;
}

function inferDomesticClubPatches(source) {
  const codes = new Set();
  for (const rule of CLUB_DOMESTIC_RULES) {
    if (!anyAlias(source, rule.leagueMarkers) && !anyAlias(source, rule.clubs)) continue;
    for (const code of rule.patches) addPatch(codes, code);
  }
  return codes;
}

function inferNationalPatches(source, national) {
  const codes = new Set();
  if (WORLD_CUP_2026_TEAMS.has(national.key)) addPatch(codes, "fifa-world-cup-2026");
  if (national.confed === "UEFA") {
    addPatch(codes, "euro");
    addPatch(codes, "uefa-nations-league");
  } else if (national.confed === "CONMEBOL") {
    addPatch(codes, "copa-america");
  } else if (national.confed === "CONCACAF") {
    addPatch(codes, "concacaf-gold-cup");
    addPatch(codes, "concacaf-nations-league");
  } else if (national.confed === "CAF") {
    addPatch(codes, "afcon");
  } else if (national.confed === "AFC") {
    addPatch(codes, "afc-asian-cup");
  } else if (national.confed === "OFC") {
    addPatch(codes, "ofc-nations-cup");
  }
  if (national.key === "ESPANHA" && currentSeason2627(source))
    addPatch(codes, "fifa-world-champions");
  return codes;
}

function inferUefa2627Patch(source) {
  if (!currentSeason2627(source)) return null;
  for (const [code, clubs] of Object.entries(UEFA_2627)) {
    if (anyAlias(source, clubs)) return code;
  }
  return null;
}

function inferSpecialClubPatches(source) {
  const codes = new Set();
  if (anyAlias(source, CLUB_WORLD_CUP_2025)) addPatch(codes, "mundial-de-clubes");
  if (currentSeason2627(source) && aliasInSource(source, "CHELSEA"))
    addPatch(codes, "fifa-club-world-champions");
  if (currentSeason2627(source) && aliasInSource(source, "ARSENAL"))
    addPatch(codes, "premier-league-champions");
  const uefaPatch = inferUefa2627Patch(source);
  if (uefaPatch) addPatch(codes, uefaPatch);
  return codes;
}

export function inferCommercialType(product) {
  const source = sourceText(product);
  if (/\b(BASQUETE|BASKET|NBA)\b/.test(source)) return "basquete";
  if (/\b(SHORT|SHORTS|CALCAO)\b/.test(source)) return "calcao";
  if (/\b(INFANTIL|KIDS?|CRIANCA)\b/.test(source)) return "infantil";
  if (/\bRETRO\b/.test(source)) return "retro";
  if (/\b(PLAYER|JOGADOR)\b/.test(source)) return "jogador";
  if (/\bFEMININ[AO]\b/.test(source)) return "feminino";
  if (/\b(TORCEDOR|FAN|CAMISA|REGATA)\b/.test(source)) return "torcedor";
  return "other";
}

export function resolveCommercialPrice(commercialType, explicitPrice = null, fallbackPrice = null) {
  const fixed = COMMERCIAL_TYPE_PRICES[commercialType];
  if (Number.isFinite(fixed)) return fixed;
  if (Number.isFinite(explicitPrice)) return Number(explicitPrice);
  return Number.isFinite(fallbackPrice) ? Number(fallbackPrice) : null;
}

const UNIFORM_LABELS = Object.freeze({
  I: "Primeiro uniforme",
  II: "Segundo uniforme",
  III: "Terceiro uniforme",
});

export function inferUniform(productOrTitle) {
  const source = normalizeCatalogText(
    typeof productOrTitle === "string" ? productOrTitle : sourceText(productOrTitle),
  );
  const match = source.match(/\b(?:CAMISA|REGATA)\s+(III|II|I)\b/);
  if (!match) return { model: null, label: null };
  return { model: match[1], label: UNIFORM_LABELS[match[1]] ?? null };
}

export function appendUniformSpecification(existingSpecifications, productOrTitle) {
  const existing = clean(existingSpecifications);
  if (/\bUniforme\s*:/i.test(existing)) return existing;
  const uniform = inferUniform(productOrTitle);
  if (!uniform.label) return existing;
  return [existing, `Uniforme: ${uniform.label}`].filter(Boolean).join(" | ");
}

export function inferPurchasePatches(product) {
  const source = sourceText(product);
  if (NO_PATCH_PRODUCT.test(source)) return [];
  const explicit = explicitPatches(source);
  if (/\bRETRO\b/.test(source)) return finalizePatches(explicit);

  const domestic = inferDomesticClubPatches(source);
  if (domestic.size > 0) {
    for (const code of inferSpecialClubPatches(source)) domestic.add(code);
    for (const code of explicit) domestic.add(code);
    return finalizePatches(domestic);
  }

  const national = identifyNationalTeam(source, product);
  if (national) {
    const codes = inferNationalPatches(source, national);
    for (const code of explicit) codes.add(code);
    return finalizePatches(codes);
  }

  const codes = inferSpecialClubPatches(source);
  for (const code of explicit) codes.add(code);
  return finalizePatches(codes);
}

export function buildCatalogBusinessProfile(product, options = {}) {
  const commercialType = inferCommercialType(product);
  const uniform = inferUniform(product);
  const price = resolveCommercialPrice(
    commercialType,
    options.explicitPrice ?? null,
    options.fallbackPrice ?? null,
  );
  return {
    commercialType,
    price,
    uniform,
    specifications: appendUniformSpecification(options.specifications ?? "", product),
    patches: inferPurchasePatches(product),
    sizes: [...CATALOG_SIZES],
  };
}
