import { getStoredUser } from "./helpers";

/** @param {Record<string, unknown> | null} user */
export function getPermissions(user) {
  if (!user) return [];
  const p = user.permissions;
  return Array.isArray(p) ? p : [];
}

/** @param {Record<string, unknown> | null} user */
export function hasPermission(user, code) {
  if (!user) return false;
  if (user.isAdmin === true) return true;
  return getPermissions(user).includes(code);
}

/** @param {Record<string, unknown> | null} user */
export function canAccessModeration(user) {
  return hasPermission(user, "moderation.reports.read");
}

/**
 * Združi odgovor GET /api/users/me v obliki za localStorage.
 * @param {Record<string, unknown> | null} stored
 * @param {Record<string, unknown>} me
 */
export function mergeMeResponseIntoUser(stored, me) {
  if (!me || me.id == null) return stored;
  return {
    id: me.id,
    username: me.username,
    email: me.email,
    isAdmin: Boolean(me.isAdmin),
    isSuspended: Boolean(me.isSuspended),
    avatarUrl: me.avatarUrl ?? null,
    permissions: Array.isArray(me.permissions) ? me.permissions : [],
    roles: Array.isArray(me.roles) ? me.roles : [],
  };
}

export function readUserWithAuthzFallback() {
  const u = getStoredUser();
  if (!u) return null;
  if (!Array.isArray(u.permissions)) {
    return { ...u, permissions: [], roles: Array.isArray(u.roles) ? u.roles : [] };
  }
  return u;
}
