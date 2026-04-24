const GROUP_OPTIONS = [
  { key: "nosecke", label: "Nosečke" },
  { key: "mame-2024", label: "Mame 2024" },
  { key: "mame-2025", label: "Mame 2025" },
  { key: "mame-2026", label: "Mame 2026" },
];

const GROUP_KEYS = GROUP_OPTIONS.map((g) => g.key);
const GROUP_BY_KEY = new Map(GROUP_OPTIONS.map((g) => [g.key, g]));

function normalizeGroupKeyOrNull(input) {
  if (input === undefined || input === null) return null;
  const s = String(input).trim().toLowerCase();
  if (!s) return null;
  return s;
}

function isAllowedGroupKey(input) {
  const norm = normalizeGroupKeyOrNull(input);
  if (!norm) return true; // treated as null (no group)
  return GROUP_BY_KEY.has(norm);
}

function groupLabelForKey(key) {
  const norm = normalizeGroupKeyOrNull(key);
  if (!norm) return null;
  return GROUP_BY_KEY.get(norm)?.label || null;
}

module.exports = {
  GROUP_OPTIONS,
  GROUP_KEYS,
  GROUP_BY_KEY,
  normalizeGroupKeyOrNull,
  isAllowedGroupKey,
  groupLabelForKey,
};
