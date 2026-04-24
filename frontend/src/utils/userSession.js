import { API_BASE } from "../api/config";
import { getStoredUser } from "./helpers";
import { mergeMeResponseIntoUser } from "./authz";
import { clearStoredSession } from "./authSessionCleanup";

let lastMeSync = 0;
export const ME_SESSION_TTL_MS = 45_000;

/**
 * Osveži podatke uporabnika iz GET /api/users/me in posodobi localStorage.
 * @param {boolean} force če true, preskoči TTL
 * @returns {Promise<object|null>} združen uporabnik ali null ob 401
 */
export async function refreshUserSession(force = false) {
  const stored = getStoredUser();
  if (!stored?.id) return null;
  if (!force && Date.now() - lastMeSync < ME_SESSION_TTL_MS) {
    return getStoredUser();
  }

  try {
    const res = await fetch(`${API_BASE}/api/users/me`, {
      credentials: "include",
      cache: "no-store",
    });
    if (res.status === 401) {
      lastMeSync = 0;
      clearStoredSession();
      return null;
    }
    if (!res.ok) return getStoredUser();
    const me = await res.json();
    const merged = mergeMeResponseIntoUser(stored, me);
    localStorage.setItem("user", JSON.stringify(merged));
    lastMeSync = Date.now();
    window.dispatchEvent(new Event("auth-changed"));
    return merged;
  } catch (e) {
    console.error("refreshUserSession:", e);
    return getStoredUser();
  }
}

/** Po odjavi / 401 počisti cache sync časa. */
export function invalidateUserSessionCache() {
  lastMeSync = 0;
}
