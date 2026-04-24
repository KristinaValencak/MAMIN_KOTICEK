import { invalidateUserSessionCache } from "./userSession";

export function clearStoredSession() {
  try {
    localStorage.removeItem("user");
  } catch {
    // ignore
  }
  invalidateUserSessionCache();
  window.dispatchEvent(new Event("auth-changed"));
}

