"use strict";

/**
 * In-memory profanity list: built-in seeds + rows from banned_words (refreshed on startup / admin).
 * Does not log matched terms or raw user text on violations.
 */

const SL_LOCALE = "sl-SI";

const BUILTIN_BANNED = [
  "fuck",
  "shit",
  "damn",
  "bitch",
  "bastard",
  "cunt",
  "dick",
  "cock",
  "piss",
  "slut",
  "whore",
  "nazi",
  "hitler",
  "kurac",
  "picka",
  "pička",
  "jebi",
  "jeba",
  "jebal",
  "jebena",
  "jebeno",
  "kurba",
  "kuzla",
  "retard",
  "debil",
];

let dbWordsNormalized = new Set();
/** @type {RegExp[]} */
let compiledMatchers = [];

function normalizeWordForList(raw) {
  return String(raw || "")
    .normalize("NFC")
    .trim()
    .toLocaleLowerCase(SL_LOCALE)
    .replace(/\s+/g, " ");
}

function escapeRegexChar(ch) {
  const cp = ch.codePointAt(0);
  if (cp > 0xffff) {
    return String.fromCodePoint(cp).replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
  }
  return ch.replace(/[\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Lowercase (sl-SI), NFC; strip non-letters except keep structure for display — used by API consumers if needed.
 * @param {string} text
 */
function normalize(text) {
  return String(text || "")
    .normalize("NFC")
    .toLocaleLowerCase(SL_LOCALE)
    .replace(/[^\p{L}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Lowercase haystack for matching (keeps all characters so \P{L} can match obfuscation).
 * @param {string} text
 */
function normalizeForMatching(text) {
  return String(text || "").normalize("NFC").toLocaleLowerCase(SL_LOCALE);
}

function lettersOnlyLower(text) {
  return normalizeForMatching(text).replace(/[^\p{L}]/gu, "");
}

/**
 * Collapse runs of the same letter (5+ → 4) to catch mild stretching without matching spamGuards threshold.
 * @param {string} text
 */
function collapseLetterRuns(text) {
  return String(text || "").replace(/(\p{L})\1{4,}/gu, "$1$1$1$1");
}

function buildInterstitialPattern(canonical) {
  const chars = [...canonical];
  if (chars.length === 0) return null;
  const body = chars.map(escapeRegexChar).join("\\P{L}*");
  return new RegExp(body, "u");
}

function buildShortWordPattern(canonical) {
  if (canonical.length < 2 || canonical.length > 3) return null;
  const chars = [...canonical];
  const body = chars.map(escapeRegexChar).join("\\P{L}*");
  return new RegExp(`(^|[^\\p{L}])${body}($|[^\\p{L}])`, "u");
}

function buildLongWordPattern(canonical) {
  if (canonical.length < 4) return null;
  return buildInterstitialPattern(canonical);
}

function rebuildMatchers() {
  const seen = new Set();
  const matchers = [];

  const addWord = (w) => {
    const key = normalizeWordForList(w);
    if (!key || seen.has(key)) return;
    const letters = lettersOnlyLower(key);
    if (letters.length < 2) return;
    seen.add(key);

    const canonical = letters;
    let re = null;
    if (canonical.length >= 4) {
      re = buildLongWordPattern(canonical);
    } else {
      re = buildShortWordPattern(canonical);
    }
    if (re) matchers.push(re);
  };

  for (const w of BUILTIN_BANNED) addWord(w);
  for (const w of dbWordsNormalized) addWord(w);

  compiledMatchers = matchers;
}

/**
 * @param {import("pg").Pool} pool
 */
async function refreshBannedWordsCache(pool) {
  const { rows } = await pool.query(
    `SELECT LOWER(TRIM(word)) AS w FROM banned_words WHERE TRIM(word) <> ''`
  );
  const next = new Set();
  for (const r of rows) {
    const w = normalizeWordForList(r.w);
    if (w) next.add(w);
  }
  dbWordsNormalized = next;
  rebuildMatchers();
  return compiledMatchers.length;
}

function containsProfanity(text) {
  if (text == null) return false;
  const s = String(text);
  if (!s) return false;

  const hayPrimary = normalizeForMatching(s);
  const hayCollapsed = normalizeForMatching(collapseLetterRuns(s));

  for (const re of compiledMatchers) {
    if (re.test(hayPrimary) || re.test(hayCollapsed)) return true;
  }
  return false;
}

function getBannedWordCount() {
  return compiledMatchers.length;
}

// Initial compile (built-in only) before first DB refresh
rebuildMatchers();

module.exports = {
  normalize,
  normalizeForMatching,
  containsProfanity,
  refreshBannedWordsCache,
  getBannedWordCount,
};
