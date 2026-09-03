export type ProductContextType = "club" | "national" | "other";
export type CompetitionStorageField = "campeonato" | "liga";

export type CompetitionOption = {
  label: string;
  context: Exclude<ProductContextType, "other">;
  storageField: CompetitionStorageField;
  teams: readonly string[];
};

const BRAZILIAN_CLUBS = [
  "Atlético Mineiro",
  "Bahia",
  "Botafogo",
  "Corinthians",
  "Cruzeiro",
  "Flamengo",
  "Fluminense",
  "Fortaleza",
  "Grêmio",
  "Internacional",
  "Palmeiras",
  "Santos",
  "São Paulo",
  "Vasco da Gama",
] as const;

const PREMIER_LEAGUE_CLUBS = [
  "Arsenal",
  "Aston Villa",
  "Chelsea",
  "Liverpool",
  "Manchester City",
  "Manchester United",
  "Newcastle United",
  "Nottingham Forest",
  "Tottenham",
  "West Ham",
] as const;

const LA_LIGA_CLUBS = [
  "Athletic Bilbao",
  "Atlético de Madrid",
  "Barcelona",
  "Real Betis",
  "Real Madrid",
  "Real Sociedad",
  "Sevilla",
  "Valencia",
  "Villarreal",
] as const;

const SERIE_A_CLUBS = [
  "Atalanta",
  "Fiorentina",
  "Inter de Milão",
  "Juventus",
  "Lazio",
  "Milan",
  "Napoli",
  "Roma",
] as const;

const BUNDESLIGA_CLUBS = [
  "Bayer Leverkusen",
  "Bayern de Munique",
  "Borussia Dortmund",
  "Eintracht Frankfurt",
  "RB Leipzig",
  "Stuttgart",
] as const;

const LIGUE_1_CLUBS = [
  "Lille",
  "Lyon",
  "Marseille",
  "Monaco",
  "Paris Saint-Germain",
] as const;

const OTHER_EUROPEAN_CLUBS = [
  "Ajax",
  "Benfica",
  "Celtic",
  "Feyenoord",
  "Galatasaray",
  "Porto",
  "PSV",
  "Sporting",
] as const;

const SOUTH_AMERICAN_CLUBS = [
  ...BRAZILIAN_CLUBS,
  "Boca Juniors",
  "Colo-Colo",
  "Nacional",
  "Peñarol",
  "Racing Club",
  "River Plate",
] as const;

const EUROPEAN_CLUBS = [
  ...PREMIER_LEAGUE_CLUBS,
  ...LA_LIGA_CLUBS,
  ...SERIE_A_CLUBS,
  ...BUNDESLIGA_CLUBS,
  ...LIGUE_1_CLUBS,
  ...OTHER_EUROPEAN_CLUBS,
] as const;

const NATIONAL_TEAMS = [
  "Alemanha",
  "Argentina",
  "Bélgica",
  "Brasil",
  "Colômbia",
  "Coreia do Sul",
  "Croácia",
  "Espanha",
  "Estados Unidos",
  "França",
  "Holanda",
  "Inglaterra",
  "Itália",
  "Japão",
  "Marrocos",
  "México",
  "Portugal",
  "Uruguai",
] as const;

export const PRODUCT_CONTEXT_OPTIONS = [
  { value: "club", label: "Clube" },
  { value: "national", label: "Seleção" },
  { value: "other", label: "Sem vínculo com time ou seleção" },
] as const satisfies ReadonlyArray<{
  value: ProductContextType;
  label: string;
}>;

export const COMPETITION_OPTIONS: readonly CompetitionOption[] = [
  {
    label: "Brasileirão",
    context: "club",
    storageField: "campeonato",
    teams: BRAZILIAN_CLUBS,
  },
  {
    label: "Premier League",
    context: "club",
    storageField: "liga",
    teams: PREMIER_LEAGUE_CLUBS,
  },
  {
    label: "La Liga",
    context: "club",
    storageField: "liga",
    teams: LA_LIGA_CLUBS,
  },
  {
    label: "Serie A",
    context: "club",
    storageField: "liga",
    teams: SERIE_A_CLUBS,
  },
  {
    label: "Bundesliga",
    context: "club",
    storageField: "liga",
    teams: BUNDESLIGA_CLUBS,
  },
  {
    label: "Ligue 1",
    context: "club",
    storageField: "liga",
    teams: LIGUE_1_CLUBS,
  },
  {
    label: "Champions League",
    context: "club",
    storageField: "campeonato",
    teams: EUROPEAN_CLUBS,
  },
  {
    label: "Libertadores",
    context: "club",
    storageField: "campeonato",
    teams: SOUTH_AMERICAN_CLUBS,
  },
  {
    label: "Copa do Mundo",
    context: "national",
    storageField: "campeonato",
    teams: NATIONAL_TEAMS,
  },
  {
    label: "Copa América",
    context: "national",
    storageField: "campeonato",
    teams: NATIONAL_TEAMS,
  },
  {
    label: "Eurocopa",
    context: "national",
    storageField: "campeonato",
    teams: NATIONAL_TEAMS,
  },
  {
    label: "Seleções",
    context: "national",
    storageField: "campeonato",
    teams: NATIONAL_TEAMS,
  },
];

export const PRODUCT_SEASON_OPTIONS = [
  "2026/27",
  "2025/26",
  "2024/25",
  "2023/24",
  "2022/23",
  "2021/22",
  "2020/21",
  "2026",
  "2025",
  "2024",
  "Retrô",
] as const;

export function getCompetitionOption(value: string) {
  return COMPETITION_OPTIONS.find((option) => option.label === value) ?? null;
}

export function inferProductContext(
  campeonato: string | null | undefined,
  liga: string | null | undefined,
): ProductContextType {
  const current = liga?.trim() || campeonato?.trim() || "";
  const known = getCompetitionOption(current);
  if (known) return known.context;

  if (liga?.trim()) return "club";
  if (/copa|euro|seleç|mundo/i.test(campeonato ?? "")) return "national";
  if (campeonato?.trim()) return "club";
  return "other";
}

export function getCompetitionOptionsForContext(context: ProductContextType) {
  if (context === "other") return [];
  return COMPETITION_OPTIONS.filter((option) => option.context === context);
}

export function extractSeasonFromSpecifications(value: string | null | undefined) {
  const source = value ?? "";
  const lines = source.split(/\r?\n/);
  const seasonLine = lines.find((line) => /^Temporada:\s*/i.test(line.trim()));
  const season = seasonLine?.replace(/^Temporada:\s*/i, "").trim() ?? "";
  const specifications = lines
    .filter((line) => !/^Temporada:\s*/i.test(line.trim()))
    .join("\n")
    .trim();

  return { season, specifications };
}

export function mergeSeasonIntoSpecifications(specifications: string, season: string) {
  const clean = specifications
    .split(/\r?\n/)
    .filter((line) => !/^Temporada:\s*/i.test(line.trim()))
    .join("\n")
    .trim();

  if (!season.trim()) return clean;
  return clean ? `Temporada: ${season.trim()}\n${clean}` : `Temporada: ${season.trim()}`;
}
