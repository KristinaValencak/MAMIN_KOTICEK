export const formatDate = (iso) => new Date(iso).toLocaleString(undefined, {
  year: "numeric", month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit"
});

export const getStoredUser = () => {
  try { return JSON.parse(localStorage.getItem("user") || "null"); }
  catch { return null; }
};

/**
 * Zanesljivo zaznavanje zasebnega profila (ujemanje z backend `coerceIsProfilePrivate`).
 * `Boolean("false")` je v JS `true` — tega ne smemo uporabljati za API vrednosti.
 * @param {unknown} value
 * @returns {boolean}
 */
export function coerceIsProfilePrivate(value) {
  if (value === true || value === "t" || value === 1 || value === "1") return true;
  if (value === false || value === "f" || value === 0 || value === "0") return false;
  if (value == null) return false;
  const s = String(value).trim().toLowerCase();
  if (s === "true" || s === "yes" || s === "on") return true;
  if (s === "false" || s === "no" || s === "off") return false;
  return false;
}

/**
 * Ali odgovor `GET /api/users/:id` označuje polni dostop (boolean/niz/število).
 * @param {unknown} user
 * @returns {boolean}
 */
export function apiViewerHasFullProfileAccess(user) {
  if (!user || user.viewerHasFullAccess == null) return false;
  const v = user.viewerHasFullAccess;
  return v === true || v === "true" || v === 1 || v === "1";
}

/** React Router pot: prijavljena uporabnica → `/profile`, sicer javni `/user/:id`. */
export function profilePathForUserId(userId) {
  const me = getStoredUser();
  if (me?.id != null && userId != null && Number(me.id) === Number(userId)) return "/profile";
  return `/user/${userId}`;
}

export const debounce = (func, delay) => {
  let timeout;
  let lastArgs;
  const executed = function debounced(...args) {
    lastArgs = args;
    const later = () => {
      clearTimeout(timeout);
      timeout = undefined;
      func(...lastArgs);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, delay);
  };
  executed.cancel = () => {
    clearTimeout(timeout);
    timeout = undefined;
  };
  executed.flush = () => {
    if (timeout === undefined) return;
    clearTimeout(timeout);
    timeout = undefined;
    if (lastArgs) func(...lastArgs);
  };
  return executed;
};

export function throttle(func, waitMs, { leading = true, trailing = true } = {}) {
  let timeout = null;
  let prev = 0;
  return function throttled(...args) {
    const now = Date.now();
    if (!prev && leading === false) prev = now;
    const remaining = waitMs - (now - prev);
    if (remaining <= 0 || remaining > waitMs) {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      prev = now;
      func(...args);
    } else if (!timeout && trailing) {
      timeout = setTimeout(() => {
        prev = leading === false ? 0 : Date.now();
        timeout = null;
        func(...args);
      }, remaining);
    }
  };
}

const SUPPORT_KEYS = ["support", "hug", "understand", "together"];

export const SUPPORT_DISPLAY_ORDER = [
  { key: "support", emoji: "💗" },
  { key: "hug", emoji: "🤗" },
  { key: "understand", emoji: "🌸" },
  { key: "together", emoji: "🥰" },
];

export function normalizeSupportCounts(raw) {
  const base = { support: 0, hug: 0, understand: 0, together: 0 };
  let obj = raw;
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw);
    } catch {
      return { ...base };
    }
  }
  if (!obj || typeof obj !== "object") return { ...base };
  for (const k of SUPPORT_KEYS) {
    base[k] = Number(obj[k]) || 0;
  }
  return base;
}

export function totalSupportCountsSum(counts) {
  const n = normalizeSupportCounts(counts);
  return n.support + n.hug + n.understand + n.together;
}

export function compactSupportSummary(counts) {
  const n = normalizeSupportCounts(counts);
  const parts = [];
  if (n.support) parts.push(`💗${n.support}`);
  if (n.hug) parts.push(`🤗${n.hug}`);
  if (n.understand) parts.push(`🌸${n.understand}`);
  if (n.together) parts.push(`🥰${n.together}`);
  return parts.join(" ");
}

export const REACTION_META = {
  support: { emoji: "💗", label: "Podpora" },
  hug: { emoji: "🤗", label: "Objem" },
  understand: { emoji: "🌸", label: "Razumem te" },
  together: { emoji: "🥰", label: "Nisi sama" },
};

export const hideScrollbarSx = {
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  "&::-webkit-scrollbar": { display: "none" },
};
