const db = require("../../config/database");
const { sendEachForMulticast, isConfigured } = require("./fcmClient");
const { listActiveTokensForUser, disableToken } = require("./pushTokenService");
const { buildPushPayloadFromNotificationRow } = require("./pushPayload");

function isInvalidTokenErrorCode(code) {
  const c = String(code || "");
  return (
    c === "messaging/registration-token-not-registered" ||
    c === "messaging/invalid-registration-token" ||
    c === "messaging/invalid-argument"
  );
}

async function enqueueForNotification(notificationId, recipientUserId, { client = null } = {}) {
  // Idempotent: 1 outbox row per notification row.
  const q = client || db;
  await q.query(
    `INSERT INTO push_outbox (notification_id, recipient_user_id, status, attempts, next_attempt_at)
     VALUES ($1, $2, 'pending', 0, NOW())
     ON CONFLICT (notification_id) DO NOTHING`,
    [notificationId, recipientUserId]
  );
}

async function deliverOneOutboxJob(jobId) {
  // Mark as processing and fetch linked notification.
  const jobRes = await db.query(
    `UPDATE push_outbox
     SET status = 'processing', updated_at = NOW()
     WHERE id = $1 AND status IN ('pending','failed')
     RETURNING id, notification_id AS "notificationId", recipient_user_id AS "recipientUserId", attempts`,
    [jobId]
  );
  if (jobRes.rowCount === 0) return { ok: false, reason: "not_found_or_not_runnable" };

  const job = jobRes.rows[0];

  const notifRes = await db.query(
    `SELECT
       n.*,
       u.username AS actor_username
     FROM notifications n
     LEFT JOIN users u ON u.id = n.actor_id
     WHERE n.id = $1
     LIMIT 1`,
    [job.notificationId]
  );
  if (notifRes.rowCount === 0) {
    await db.query(
      `UPDATE push_outbox SET status='dead', last_error='notification_missing', updated_at=NOW() WHERE id=$1`,
      [job.id]
    );
    return { ok: false, reason: "notification_missing" };
  }

  if (!isConfigured()) {
    // Don't dead-letter; config may be applied later.
    await db.query(
      `UPDATE push_outbox
       SET status='failed', attempts = attempts + 1,
           last_error='fcm_not_configured',
           next_attempt_at = NOW() + make_interval(minutes => LEAST(60, (attempts + 1) * 5)),
           updated_at=NOW()
       WHERE id=$1`,
      [job.id]
    );
    return { ok: false, reason: "fcm_not_configured" };
  }

  const recipientUserId = Number(job.recipientUserId);
  const tokens = await listActiveTokensForUser(recipientUserId);
  if (!tokens.length) {
    await db.query(
      `UPDATE push_outbox SET status='sent', last_error=NULL, updated_at=NOW() WHERE id=$1`,
      [job.id]
    );
    return { ok: true, delivered: 0 };
  }

  const payload = buildPushPayloadFromNotificationRow(notifRes.rows[0]);

  const tokenList = tokens.map((t) => t.fcmToken);
  let resp;
  try {
    resp = await sendEachForMulticast({
      tokens: tokenList,
      notification: payload.notification,
      data: payload.data,
    });
  } catch (err) {
    await db.query(
      `UPDATE push_outbox
       SET status='failed', attempts = attempts + 1,
           last_error=$2,
           next_attempt_at = NOW() + make_interval(minutes => LEAST(60, (attempts + 1) * 2)),
           updated_at=NOW()
       WHERE id=$1`,
      [job.id, String(err?.message || "fcm_send_failed")]
    );
    return { ok: false, reason: "send_failed" };
  }

  // Disable invalid tokens, keep others.
  if (Array.isArray(resp.responses)) {
    for (let i = 0; i < resp.responses.length; i++) {
      const r = resp.responses[i];
      if (r?.success) continue;
      const code = r?.error?.code || r?.error?.errorInfo?.code;
      if (isInvalidTokenErrorCode(code)) {
        await disableToken(tokenList[i], { reason: String(code || "invalid_token") });
      }
    }
  }

  await db.query(
    `UPDATE push_outbox SET status='sent', last_error=NULL, updated_at=NOW() WHERE id=$1`,
    [job.id]
  );
  return { ok: true, delivered: resp.successCount || 0 };
}

module.exports = {
  enqueueForNotification,
  deliverOneOutboxJob,
};

