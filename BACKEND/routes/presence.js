const express = require("express");
const { sendJsonError, CODES } = require("../utils/apiError");
const db = require("../config/database");
const requireAuth = require("../middleware/auth");

const router = express.Router();

function authUserId(req) {
  const n = Number(req.user?.id);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

// POST /api/presence/ping
router.post("/ping", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }

  try {
    await db.query(
      `INSERT INTO user_presence (user_id, last_active_at)
       VALUES ($1, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET last_active_at = EXCLUDED.last_active_at`,
      [userId]
    );
    return res.json({ ok: true, userId });
  } catch (err) {
    console.error("Napaka /api/presence/ping:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri posodabljanju statusa");
  }
});

// GET /api/presence/status?userIds=1,2,3&windowSeconds=60
router.get("/status", requireAuth, async (req, res) => {
  const me = authUserId(req);
  if (me === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }

  const raw = String(req.query.userIds || "");
  if (!raw.trim()) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "userIds je obvezen (npr. 12,34)");
  }

  const windowSecondsRaw = parsePositiveInt(req.query.windowSeconds || "60") || 60;
  const windowSeconds = Math.min(windowSecondsRaw, 600);

  const ids = raw
    .split(",")
    .map((s) => parsePositiveInt(s.trim()))
    .filter((n) => n !== null);

  const uniqueIds = Array.from(new Set(ids)).slice(0, 200);
  if (uniqueIds.length === 0) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "userIds nima veljavnih ID-jev");
  }

  try {
    const { rows } = await db.query(
      `SELECT user_id, last_active_at
       FROM user_presence
       WHERE user_id = ANY($1::int[])`,
      [uniqueIds]
    );
    const map = new Map(rows.map((r) => [Number(r.user_id), r.last_active_at]));
    const thresholdMs = windowSeconds * 1000;

    const now = Date.now();
    const items = uniqueIds.map((userId) => {
      const lastActiveAt = map.get(userId) || null;
      const online =
        lastActiveAt !== null && now - new Date(lastActiveAt).getTime() <= thresholdMs;
      return { userId, online, lastActiveAt };
    });

    return res.json({ windowSeconds, items });
  } catch (err) {
    console.error("Napaka /api/presence/status:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju statusa");
  }
});

module.exports = router;

