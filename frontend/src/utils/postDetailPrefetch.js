import { API_BASE } from "../api/config";

const TTL_MS = 50_000;
const cache = new Map();
const inflight = new Map();

function keyFor(id) {
  return String(id);
}

/**
 * Po uspešnem branju podrobnosti — da naslednji obisk (deep link) dobi takoj podatke.
 * @param {string|number} postId
 * @param {object} data
 */
export function seedPostDetailCache(postId, data) {
  if (data == null || postId == null) return;
  cache.set(keyFor(postId), { data, ts: Date.now() });
}

/**
 * Vrne predpomnjene podatke, če še veljajo.
 * @param {string|number} postId
 * @returns {object|null}
 */
export function peekPostDetailCache(postId) {
  if (postId == null) return null;
  const k = keyFor(postId);
  const hit = cache.get(k);
  if (!hit) return null;
  if (Date.now() - hit.ts > TTL_MS) {
    cache.delete(k);
    return null;
  }
  return hit.data;
}

/**
 * Ozadinski prefetch (hover / intent). Ne meče napak navzven.
 * @param {string|number} postId
 */
export function prefetchPostDetail(postId) {
  const id = Number(postId);
  if (!Number.isFinite(id) || id < 1) return;
  const k = keyFor(id);
  const hit = cache.get(k);
  if (hit && Date.now() - hit.ts < TTL_MS) return;
  if (inflight.has(k)) return;
  const p = fetch(`${API_BASE}/api/posts/${id}`, { credentials: "include" })
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      if (data && data.id != null) seedPostDetailCache(id, data);
      return data;
    })
    .catch(() => null)
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
}
