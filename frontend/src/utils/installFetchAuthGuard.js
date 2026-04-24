import { API_BASE } from "../api/config";
import { clearStoredSession } from "./authSessionCleanup";

/**
 * Installs a lightweight global fetch wrapper:
 * - When API returns 401, clear local session (localStorage + auth-changed).
 * - Does NOT consume the response body (callers can still read it).
 */
export function installFetchAuthGuard() {
  if (typeof window === "undefined") return;
  if (window.__mk_fetch_auth_guard_installed) return;
  window.__mk_fetch_auth_guard_installed = true;

  const origFetch = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await origFetch(input, init);
    try {
      const url =
        typeof input === "string"
          ? input
          : input && typeof input === "object" && "url" in input
            ? input.url
            : "";
      const isApi = typeof url === "string" && url.startsWith(`${API_BASE}/api/`);
      if (isApi && res.status === 401) {
        clearStoredSession();
      }
    } catch {
      // ignore
    }
    return res;
  };
}

