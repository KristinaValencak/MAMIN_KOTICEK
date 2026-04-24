import { API_BASE } from "./config";

async function jsonOrThrow(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (typeof data?.error === "string" ? data.error : null) ||
      (typeof data?.error?.message === "string" ? data.error.message : null) ||
      (typeof data?.message === "string" ? data.message : null) ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    if (data?.error?.code) err.code = data.error.code;
    throw err;
  }
  return data;
}

/**
 * @param {{ status?: string, limit?: number, offset?: number }} opts
 */
export async function fetchModerationReports({ status = "", limit = 20, offset = 0 } = {}) {
  const u = new URL(`${API_BASE}/api/moderation/reports`);
  if (status) u.searchParams.set("status", status);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
  return jsonOrThrow(res);
}

/**
 * @param {{ status?: string, targetType?: string, limit?: number, offset?: number }} opts
 */
export async function fetchModerationReportsFiltered({ status = "", targetType = "", limit = 20, offset = 0 } = {}) {
  const u = new URL(`${API_BASE}/api/moderation/reports`);
  if (status) u.searchParams.set("status", status);
  if (targetType) u.searchParams.set("targetType", targetType);
  u.searchParams.set("limit", String(limit));
  u.searchParams.set("offset", String(offset));
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
  return jsonOrThrow(res);
}

export async function fetchModerationReportDetail(id) {
  const res = await fetch(`${API_BASE}/api/moderation/reports/${id}`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function reviewModerationReport(id) {
  const res = await fetch(`${API_BASE}/api/moderation/reports/${id}/review`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res);
}

export async function ignoreModerationReport(id) {
  const res = await fetch(`${API_BASE}/api/moderation/reports/${id}/ignore`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res);
}

export async function hideModerationReport(id) {
  const res = await fetch(`${API_BASE}/api/moderation/reports/${id}/hide`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res);
}

export async function unhideModerationContent(targetType, targetId) {
  const res = await fetch(`${API_BASE}/api/moderation/content/unhide`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId }),
  });
  return jsonOrThrow(res);
}

export async function hideModerationContent(targetType, targetId) {
  const res = await fetch(`${API_BASE}/api/moderation/content/hide`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId }),
  });
  return jsonOrThrow(res);
}

export async function deleteModerationContent(targetType, targetId) {
  const res = await fetch(`${API_BASE}/api/moderation/content/delete`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetType, targetId }),
  });
  return jsonOrThrow(res);
}

export async function fetchHiddenPosts({ limit = 20, cursor = null } = {}) {
  const u = new URL(`${API_BASE}/api/moderation/hidden/posts`);
  u.searchParams.set("limit", String(limit));
  if (cursor) u.searchParams.set("cursor", cursor);
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
  return jsonOrThrow(res);
}

export async function fetchSuspendedUsers({ limit = 20, cursor = null } = {}) {
  const u = new URL(`${API_BASE}/api/moderation/users/suspended`);
  u.searchParams.set("limit", String(limit));
  if (cursor) u.searchParams.set("cursor", cursor);
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
  return jsonOrThrow(res);
}

export async function suspendUser(userId, reason) {
  const res = await fetch(`${API_BASE}/api/moderation/users/${userId}/suspend`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  return jsonOrThrow(res);
}

export async function unsuspendUser(userId) {
  const res = await fetch(`${API_BASE}/api/moderation/users/${userId}/unsuspend`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res);
}

/** @param {{ targetType: 'post' | 'comment', targetId: number }} body */
export async function submitModerationAppeal(body) {
  const res = await fetch(`${API_BASE}/api/moderation/appeals`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return jsonOrThrow(res);
}

export async function fetchPendingAppeals() {
  const res = await fetch(`${API_BASE}/api/moderation/appeals/pending`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

/** @returns {Promise<{ count: number }>} */
export async function fetchPendingAppealsCount() {
  const res = await fetch(`${API_BASE}/api/moderation/appeals/pending/count`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function resolveModerationAppeal(appealId, decision) {
  const res = await fetch(`${API_BASE}/api/moderation/appeals/${appealId}/resolve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ decision }),
  });
  return jsonOrThrow(res);
}

export async function fetchAdminRolesCatalog() {
  const res = await fetch(`${API_BASE}/api/admin/roles`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function fetchAdminUserRoles(userId) {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/roles`, {
    credentials: "include",
    cache: "no-store",
  });
  return jsonOrThrow(res);
}

export async function putAdminUserRoles(userId, roleIds) {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/roles`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ roleIds }),
  });
  return jsonOrThrow(res);
}

export async function putAdminUserAdminFlag(userId, isAdmin) {
  const res = await fetch(`${API_BASE}/api/admin/users/${userId}/admin`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isAdmin: Boolean(isAdmin) }),
  });
  return jsonOrThrow(res);
}

export async function fetchAdminDeletedContent({
  limit = 30,
  cursor = null,
  type = "",
  source = "",
  reason = "",
  q = "",
  from = "",
  to = "",
  eventType = "deleted",
} = {}) {
  const u = new URL(`${API_BASE}/api/admin/deleted`);
  u.searchParams.set("limit", String(limit));
  if (cursor) u.searchParams.set("cursor", cursor);
  if (type) u.searchParams.set("type", type);
  if (source) u.searchParams.set("source", source);
  if (reason) u.searchParams.set("reason", reason);
  if (q) u.searchParams.set("q", q);
  if (from) u.searchParams.set("from", from);
  if (to) u.searchParams.set("to", to);
  if (eventType) u.searchParams.set("eventType", eventType);
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store" });
  return jsonOrThrow(res);
}

export async function purgeDeletedTarget(targetType, targetId) {
  const res = await fetch(`${API_BASE}/api/admin/deleted/${targetType}/${targetId}/purge`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return jsonOrThrow(res);
}

export async function searchUsersForAdmin(q, { signal } = {}) {
  const u = new URL(`${API_BASE}/api/users/search`);
  u.searchParams.set("q", q.trim());
  const res = await fetch(u.toString(), { credentials: "include", cache: "no-store", signal });
  return jsonOrThrow(res);
}
