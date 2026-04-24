import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";
import { API_BASE } from "../api/config.js";
import { getFirebaseApp } from "./firebaseApp";
import { isCapacitorNative } from "./pushRuntime.js";

const LS_DEVICE_ID_KEY = "mk_push_device_id_v1";

function getOrCreateDeviceId() {
  const existing = localStorage.getItem(LS_DEVICE_ID_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(LS_DEVICE_ID_KEY, id);
  return id;
}

function vapidKey() {
  const k = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  return k == null || k === "" ? null : String(k);
}

export async function webPushSupported() {
  try {
    return await isSupported();
  } catch {
    return false;
  }
}

export function currentPermission() {
  return typeof Notification !== "undefined" ? Notification.permission : "denied";
}

export async function ensureServiceWorker() {
  if (!("serviceWorker" in navigator)) throw new Error("no_service_worker");
  return await navigator.serviceWorker.register("/firebase-messaging-sw.js");
}

export async function enableWebPush() {
  if (isCapacitorNative()) {
    throw new Error("capacitor_native_use_native_push");
  }

  const supported = await webPushSupported();
  if (!supported) throw new Error("not_supported");

  const key = vapidKey();
  if (!key) throw new Error("missing_vapid_key");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("permission_denied");

  const swReg = await ensureServiceWorker();
  const messaging = getMessaging(getFirebaseApp());

  const token = await getToken(messaging, {
    vapidKey: key,
    serviceWorkerRegistration: swReg,
  });
  if (!token) throw new Error("no_token");

  const deviceId = getOrCreateDeviceId();
  const res = await fetch(`${API_BASE}/api/push/tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      token,
      platform: "web",
      deviceId,
    }),
  });

  if (!res.ok) {
    throw new Error("push_token_save_failed");
  }

  return { token, deviceId };
}

export function onForegroundPushMessage(handler) {
  const messaging = getMessaging(getFirebaseApp());
  return onMessage(messaging, handler);
}

