const TAGS_BY_CATEGORY_SLUG = {
  nosecnost: [
    "prvi trimester",
    "drugi trimester",
    "tretji trimester",
    "pregledi",
    "ginekolog",
    "slabost",
    "gibanje otroka",
    "priprava na porod",
    "torba za porodnišnico",
    "porod",
    "carski rez",
    "strahovi",
    "prehrana",
  ],
  "dojencki-0-12m": [
    "spanje",
    "hranjenje",
    "kolike",
    "krči",
    "razvoj",
    "cepljenje",
    "zobki",
    "rutina",
    "dojenje",
    "adaptirano mleko",
    "jok",
    "nočno zbujanje",
  ],
  "otroci-1-6": [
    "vzgoja",
    "trma",
    "vrtec",
    "razvoj",
    "igra",
    "govor",
    "socializacija",
    "rutina",
    "spanje",
    "prehrana",
    "meje",
    "navade",
  ],
  "sola-6-plus": [
    "šola",
    "domače naloge",
    "učne težave",
    "sošolci",
    "bullying",
    "učitelji",
    "motivacija",
    "učenje",
    "ocene",
    "disciplina",
  ],
  spanje: [
    "nočno zbujanje",
    "uspavanje",
    "rutina",
    "spanje dojenčka",
    "spanje otrok",
    "spanje staršev",
    "spanje v vrtcu",
    "težave s spanjem",
    "spanje brez jokanja",
  ],
  "dojenje-hranjenje": [
    "dojenje",
    "težave z dojenjem",
    "pristavljanje",
    "črpanje mleka",
    "adaptirano mleko",
    "uvajanje hrane",
    "alergije",
    "gosta hrana",
    "urnik hranjenja",
    "odstavljanje",
  ],
  "hrana-recepti": [
    "recepti",
    "otroška prehrana",
    "zdrava prehrana",
    "hitri obroki",
    "prigrizki",
    "zajtrk",
    "kosilo",
    "večerja",
    "alergije",
    "brez sladkorja",
  ],
  zdravje: [
    "bolezen",
    "vročina",
    "zdravila",
    "pediater",
    "prehlad",
    "kašelj",
    "alergije",
    "izpuščaji",
    "zobki",
    "imunski sistem",
  ],
  "psiholoska-podpora": [
    "stres",
    "izčrpanost",
    "poporodna depresija",
    "anksioznost",
    "samopodoba",
    "izgorelost",
    "podpora",
    "osamljenost",
    "mentalno zdravje",
    "čas zase",
  ],
  "partnerstvo-druzina": [
    "partnerstvo",
    "odnosi",
    "komunikacija",
    "prepiri",
    "vzgoja",
    "družinski čas",
    "ločitve",
    "sorodniki",
    "podpora partnerja",
  ],
  "oprema-nakupi": [
    "voziček",
    "avtosedež",
    "posteljica",
    "obleke",
    "igrače",
    "priporočila",
    "kaj kupiti",
    "rabljeno",
    "akcije",
    "kakovost",
  ],
  "denar-pravice": [
    "porodniška",
    "otroški dodatek",
    "dopust",
    "vrtec",
    "subvencije",
    "delodajalec",
    "pogodba",
    "pravice staršev",
    "finančna pomoč",
  ],
  "zdravniki-priporocila": [
    "pediater",
    "ginekolog",
    "zobozdravnik",
    "pregledi",
    "priporočila",
    "izkušnje",
    "ambulanta",
    "čakalne dobe",
  ],
  "dogodki-srecanja": [
    "srečanja",
    "delavnice",
    "igrišča",
    "dogodki za otroke",
    "druženje",
    "mame skupine",
    "lokalni dogodki",
  ],
  "splosni-klepet": [
    "vprašanje",
    "nasvet",
    "izkušnje",
    "pogovor",
    "deljenje",
    "random",
    "podpora",
  ],
};

function getCategoryTags(categorySlug) {
  const slug = String(categorySlug || "").trim();
  return TAGS_BY_CATEGORY_SLUG[slug] || [];
}

function normalizeTag(s) {
  return String(s || "").trim().toLowerCase();
}

function validateTagsForCategorySlug(tagsArray, categorySlug) {
  const allowed = new Set(getCategoryTags(categorySlug).map((t) => normalizeTag(t)));
  const tags = Array.isArray(tagsArray) ? tagsArray : [];
  for (const t of tags) {
    const norm = normalizeTag(t);
    if (!norm) continue;
    if (!allowed.has(norm)) return false;
  }
  return true;
}

module.exports = {
  TAGS_BY_CATEGORY_SLUG,
  getCategoryTags,
  validateTagsForCategorySlug,
};

