function normalizeBaseUrl(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  return v.endsWith("/") ? v.slice(0, -1) : v;
}

export const API_BASE = normalizeBaseUrl(import.meta.env.VITE_API_BASE) || "http://localhost:8080";
