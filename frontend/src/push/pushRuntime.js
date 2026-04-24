
export function isCapacitorNative() {
  try {
    const C = typeof globalThis !== "undefined" ? globalThis.Capacitor : null;
    if (!C) return false;
    if (typeof C.isNativePlatform === "function") return Boolean(C.isNativePlatform());
    const p = typeof C.getPlatform === "function" ? C.getPlatform() : "";
    return Boolean(p && String(p).toLowerCase() !== "web");
  } catch {
    return false;
  }
}
