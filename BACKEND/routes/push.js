const express = require("express");
const { sendJsonError, CODES } = require("../utils/apiError");
const requireAuth = require("../middleware/auth");
const { upsertToken, deleteTokenForUser } = require("../services/push/pushTokenService");
const { pushTokenUserLimiter } = require("../middleware/rateLimiters");

const router = express.Router();

// Register/rotate token
router.post("/tokens", requireAuth, pushTokenUserLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token, platform, deviceId, appVersion, appBuild } = req.body || {};
    const row = await upsertToken({
      userId,
      fcmToken: token,
      platform,
      deviceId,
      appVersion,
      appBuild,
    });
    res.status(201).json({ ok: true, tokenId: row.id });
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg === "invalid_platform") {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven platform (web|android|ios).");
    }
    if (msg === "invalid_token") {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven FCM token.");
    }
    console.error("POST /api/push/tokens error:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju push tokena.");
  }
});

// Unregister token
router.delete("/tokens", requireAuth, pushTokenUserLimiter, async (req, res) => {
  try {
    const userId = req.user.id;
    const { token } = req.body || {};
    const ok = await deleteTokenForUser(userId, token);
    res.json({ ok, removed: ok });
  } catch (err) {
    const msg = String(err?.message || err || "");
    if (msg === "invalid_token") {
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven FCM token.");
    }
    console.error("DELETE /api/push/tokens error:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju push tokena.");
  }
});

module.exports = router;

