const admin = require("firebase-admin");

let _app = null;

function envJson(name) {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function initFirebaseAdmin() {
  if (_app) return _app;

  // Preferred: service account JSON string in env.
  const sa = envJson("FIREBASE_SERVICE_ACCOUNT_JSON");
  if (sa) {
    _app = admin.initializeApp({
      credential: admin.credential.cert(sa),
    });
    return _app;
  }

  // Fallback: rely on GOOGLE_APPLICATION_CREDENTIALS or runtime default creds.
  _app = admin.initializeApp();
  return _app;
}

function isConfigured() {
  // If either explicit JSON is provided or default creds exist, init should succeed.
  // We don't try-catch init here to avoid swallowing real misconfiguration; callers can.
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_APPLICATION_CREDENTIALS);
}

async function sendEachForMulticast(message) {
  initFirebaseAdmin();
  return await admin.messaging().sendEachForMulticast(message);
}

module.exports = {
  initFirebaseAdmin,
  isConfigured,
  sendEachForMulticast,
};

