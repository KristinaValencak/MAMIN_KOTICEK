const CITY_OPTIONS = [
  "Ljubljana",
  "Maribor",
  "Celje",
  "Koper",
  "Kranj",
  "Novo mesto",
  "Domžale",
  "Kamnik",
  "Velenje",
  "Ptuj",
  "Nova Gorica",
  "Jesenice",
  "Murska Sobota",
  "Izola",
  "Sežana",
];

const CITY_CANONICAL_BY_LOWER = new Map(CITY_OPTIONS.map((c) => [c.toLowerCase(), c]));

function normalizeCityOrNull(cityInput) {
  if (cityInput === undefined || cityInput === null) return null;
  const s = String(cityInput).trim();
  if (!s) return null;
  if (s.toLowerCase() === "brez lokacije") return null;
  const canonical = CITY_CANONICAL_BY_LOWER.get(s.toLowerCase());
  return canonical || null;
}

function isAllowedCity(cityInput) {
  if (cityInput === undefined || cityInput === null) return true; // treated as null
  const s = String(cityInput).trim();
  if (!s) return true;
  if (s.toLowerCase() === "brez lokacije") return true;
  return CITY_CANONICAL_BY_LOWER.has(s.toLowerCase());
}

module.exports = {
  CITY_OPTIONS,
  normalizeCityOrNull,
  isAllowedCity,
};

