const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");

// Weekly leaderboard: ranks by support reactions GIVEN (not received).
// Weights:
// - support, hug => 2
// - understand, together => 1
router.get("/top-moms", async (req, res) => {
  try {
    const period = (req.query.period || "week").toString();
    if (period !== "week") return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Unsupported period");

    const limitRaw = parseInt(req.query.limit || "30", 10);
    const limit = Math.min(Number.isFinite(limitRaw) ? limitRaw : 30, 80);
    const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);
    const fetchN = limit + 1;

    const { rows } = await db.query(
      `
      WITH all_reactions AS (
        SELECT user_id, reaction_type, created_at
        FROM post_support_reactions
        WHERE created_at >= NOW() - INTERVAL '7 days'
        UNION ALL
        SELECT user_id, reaction_type, created_at
        FROM comment_support_reactions
        WHERE created_at >= NOW() - INTERVAL '7 days'
      )
      SELECT
        u.id AS "userId",
        u.username AS "username",
        u.avatar_url AS "avatarUrl",
        SUM(CASE WHEN ar.reaction_type IN ('support','hug') THEN 2 ELSE 1 END)::int AS "supportScore",
        SUM(CASE WHEN ar.reaction_type IN ('support','hug') THEN 1 ELSE 0 END)::int AS "strongCount",
        SUM(CASE WHEN ar.reaction_type IN ('understand','together') THEN 1 ELSE 0 END)::int AS "lightCount"
      FROM all_reactions ar
      JOIN users u ON u.id = ar.user_id
      GROUP BY u.id, u.username, u.avatar_url
      ORDER BY "supportScore" DESC, "strongCount" DESC, u.id ASC
      LIMIT $1 OFFSET $2
      `,
      [fetchN, offset]
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    res.json({
      items,
      period: "week",
      pagination: { limit, offset, hasMore },
    });
  } catch (err) {
    console.error("Napaka /api/support/top-moms:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju lestvice");
  }
});

module.exports = router;

