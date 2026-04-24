const db = require("../../config/database");

function normalizePlatform(raw) {
  const v = String(raw || "").trim().toLowerCase();
  if (v === "web" || v === "android" || v === "ios") return v;
  return null;
}

function normalizeToken(raw) {
  const t = String(raw || "").trim();
  if (!t) return null;
  // FCM tokens are long; accept as-is but cap to avoid abuse.
  if (t.length < 20 || t.length > 4096) return null;
  return t;
}

function normalizeDeviceId(raw) {
  const d = raw == null ? null : String(raw).trim();
  if (!d) return null;
  if (d.length > 255) return null;
  return d;
}

async function upsertToken({
  userId,
  fcmToken,
  platform,
  deviceId,
  appVersion,
  appBuild,
}) {
  const p = normalizePlatform(platform);
  const t = normalizeToken(fcmToken);
  const d = normalizeDeviceId(deviceId);
  if (!p) throw new Error("invalid_platform");
  if (!t) throw new Error("invalid_token");

  const av = appVersion == null ? null : String(appVersion).trim().slice(0, 100);
  const ab = appBuild == null ? null : String(appBuild).trim().slice(0, 100);

  // Rotation strategy:
  // - if deviceId provided: keep exactly one row per (user_id, device_id)
  // - otherwise: de-dup by token unique index
  if (d) {
    // The table has TWO uniqueness constraints:
    // - fcm_token UNIQUE (global)
    // - (user_id, device_id) UNIQUE where device_id IS NOT NULL
    //
    // When a device token already exists (e.g. another user previously enabled push on the same phone),
    // inserting with ON CONFLICT (user_id, device_id) will still fail due to fcm_token uniqueness.
    //
    // Strategy:
    // 1) Ensure this user has only one row per deviceId (remove old tokens for that device).
    // 2) Upsert by fcm_token (global), reassigning it to this user/device.
    return await db.query("BEGIN").then(async () => {
      try {
        await db.query(
          `DELETE FROM push_device_tokens
           WHERE user_id = $1 AND device_id = $2 AND fcm_token <> $3`,
          [userId, d, t]
        );

        const q = await db.query(
          `INSERT INTO push_device_tokens (user_id, fcm_token, platform, device_id, app_version, app_build, last_seen_at, disabled_at, failure_count, last_failure_at)
           VALUES ($1, $2, $3, $4, $5, $6, NOW(), NULL, 0, NULL)
           ON CONFLICT (fcm_token)
           DO UPDATE SET
             user_id = EXCLUDED.user_id,
             platform = EXCLUDED.platform,
             device_id = EXCLUDED.device_id,
             app_version = EXCLUDED.app_version,
             app_build = EXCLUDED.app_build,
             last_seen_at = NOW(),
             disabled_at = NULL
           RETURNING id, user_id AS "userId", platform, device_id AS "deviceId", disabled_at AS "disabledAt", last_seen_at AS "lastSeenAt"`,
          [userId, t, p, d, av, ab]
        );

        await db.query("COMMIT");
        return q.rows[0];
      } catch (err) {
        await db.query("ROLLBACK");
        throw err;
      }
    });
  }

  const q = await db.query(
    `INSERT INTO push_device_tokens (user_id, fcm_token, platform, app_version, app_build, last_seen_at, disabled_at, failure_count, last_failure_at)
     VALUES ($1, $2, $3, $4, $5, NOW(), NULL, 0, NULL)
     ON CONFLICT (fcm_token)
     DO UPDATE SET
       user_id = EXCLUDED.user_id,
       platform = EXCLUDED.platform,
       app_version = EXCLUDED.app_version,
       app_build = EXCLUDED.app_build,
       last_seen_at = NOW(),
       disabled_at = NULL
     RETURNING id, user_id AS "userId", platform, device_id AS "deviceId", disabled_at AS "disabledAt", last_seen_at AS "lastSeenAt"`,
    [userId, t, p, av, ab]
  );
  return q.rows[0];
}

async function disableToken(fcmToken, { reason } = {}) {
  const t = normalizeToken(fcmToken);
  if (!t) return;
  await db.query(
    `UPDATE push_device_tokens
     SET disabled_at = COALESCE(disabled_at, NOW()),
         failure_count = failure_count + 1,
         last_failure_at = NOW()
     WHERE fcm_token = $1`,
    [t]
  );
}

async function deleteTokenForUser(userId, fcmToken) {
  const t = normalizeToken(fcmToken);
  if (!t) throw new Error("invalid_token");
  const res = await db.query(
    `DELETE FROM push_device_tokens WHERE user_id = $1 AND fcm_token = $2 RETURNING id`,
    [userId, t]
  );
  return res.rowCount > 0;
}

async function listActiveTokensForUser(userId) {
  const res = await db.query(
    `SELECT fcm_token AS "fcmToken", platform, device_id AS "deviceId"
     FROM push_device_tokens
     WHERE user_id = $1 AND disabled_at IS NULL
     ORDER BY last_seen_at DESC`,
    [userId]
  );
  return res.rows;
}

module.exports = {
  upsertToken,
  disableToken,
  deleteTokenForUser,
  listActiveTokensForUser,
};

