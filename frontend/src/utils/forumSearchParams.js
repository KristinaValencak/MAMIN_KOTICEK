export const FORUM_SEARCH_TYPES = ["all", "users", "posts", "marketplace"];

export function normalizeForumSearchType(raw) {
  const t = String(raw || "all").trim().toLowerCase();
  if (t === "events") return "all";
  return FORUM_SEARCH_TYPES.includes(t) ? t : "all";
}

/**
 * @param {URLSearchParams} searchParams
 * @returns {{ searchQuery: string, searchType: string }}
 */
export function parseForumSearchFromSearchParams(searchParams) {
  const search = searchParams.get("search");
  const type = normalizeForumSearchType(searchParams.get("type"));
  return {
    searchQuery: search ? String(search) : "",
    searchType: type,
  };
}

/**
 * @param {URLSearchParams|string} prev
 * @param {string} nextQuery
 * @param {string} currentType
 * @returns {URLSearchParams}
 */
export function mergeForumSearchQueryIntoParams(prev, nextQuery, currentType) {
  const params = new URLSearchParams(prev);
  const v = String(nextQuery || "").trim();
  if (v) {
    params.set("search", v);
    params.set("type", normalizeForumSearchType(currentType));
  } else {
    params.delete("search");
    params.delete("type");
  }
  return params;
}

/**
 * @param {URLSearchParams|string} prev
 * @param {string} trimmedSearchQuery
 * @param {string} nextType
 * @returns {URLSearchParams}
 */
export function mergeForumSearchTypeIntoParams(prev, trimmedSearchQuery, nextType) {
  const params = new URLSearchParams(prev);
  const q = String(trimmedSearchQuery || "").trim();
  const normalized = normalizeForumSearchType(nextType);
  if (q) params.set("type", normalized);
  else params.delete("type");
  return params;
}

/**
 * @param {URLSearchParams|string} prev
 * @param {unknown} post — object with id or raw id
 * @returns {URLSearchParams}
 */
export function mergeForumPostIntoParams(prev, post) {
  const id =
    post && typeof post === "object" && post.id != null
      ? post.id
      : post;
  if (id == null || String(id).trim() === "") return new URLSearchParams(prev);
  const params = new URLSearchParams(prev);
  params.set("post", String(id));
  return params;
}

export function normalizeForumTag(raw) {
  const s = String(raw || "").trim().toLowerCase();
  return s || "";
}

export function normalizeForumCity(raw) {
  const s = String(raw || "").trim();
  if (!s) return "";
  if (s.toLowerCase() === "brez lokacije") return "";
  return s;
}

export function normalizeForumGroup(raw) {
  const s = String(raw || "").trim().toLowerCase();
  return s || "";
}

export function mergeForumTagIntoParams(prev, nextTag) {
  const params = new URLSearchParams(prev);
  const t = normalizeForumTag(nextTag);
  if (t) params.set("tag", t);
  else params.delete("tag");
  return params;
}

export function mergeForumCityIntoParams(prev, nextCity) {
  const params = new URLSearchParams(prev);
  const c = normalizeForumCity(nextCity);
  if (c) params.set("city", c);
  else params.delete("city");
  return params;
}

export function mergeForumGroupIntoParams(prev, nextGroup) {
  const params = new URLSearchParams(prev);
  const g = normalizeForumGroup(nextGroup);
  if (g) params.set("group", g);
  else params.delete("group");
  return params;
}
