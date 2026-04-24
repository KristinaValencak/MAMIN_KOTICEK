const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const { canViewHiddenContent } = require("../services/permissions");
const { anonParticipantLabelExpr } = require("../utils/anonymousParticipantLabel");

const NOTIF_FEED_DAYS_DEFAULT = 7;
const NOTIF_FEED_DAYS_MIN = 1;
const NOTIF_FEED_DAYS_MAX = 90;

function parseFeedDays(query) {
    const raw = parseInt(query?.days ?? String(NOTIF_FEED_DAYS_DEFAULT), 10);
    if (!Number.isFinite(raw)) return NOTIF_FEED_DAYS_DEFAULT;
    return Math.min(Math.max(raw, NOTIF_FEED_DAYS_MIN), NOTIF_FEED_DAYS_MAX);
}

function parseJsonArray(val) {
    if (val == null) return [];
    if (Array.isArray(val)) return val;
    if (typeof Buffer !== "undefined" && Buffer.isBuffer(val)) {
        try {
            const p = JSON.parse(val.toString("utf8"));
            return Array.isArray(p) ? p : [];
        } catch {
            return [];
        }
    }
    if (typeof val === "string") {
        try {
            const p = JSON.parse(val);
            return Array.isArray(p) ? p : [];
        } catch {
            return [];
        }
    }
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
        return [val];
    }
    return [];
}

function normalizeCreatedAt(val) {
    if (!val) return val;
    if (val instanceof Date) return val.toISOString();
    const s = String(val).trim();
    if (!s) return val;

    // If backend/pg returns timestamp without timezone (e.g. "2026-04-21 10:04:06.123"),
    // treat it as UTC to avoid local-time parsing shifts in browsers.
    const noTz =
        /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(s) &&
        !/[zZ]|[+-]\d{2}:?\d{2}$/.test(s);
    if (noTz) {
        return new Date(s.replace(" ", "T") + "Z").toISOString();
    }

    // Otherwise let Date parse, but keep ISO output stable.
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
    return val;
}

function normalizeNotificationRow(row) {
    if (!row || String(row.type).trim() !== "like") {
        if (row && row.createdAt) return { ...row, createdAt: normalizeCreatedAt(row.createdAt) };
        return row;
    }
    const out = { ...row };
    out.createdAt = normalizeCreatedAt(out.createdAt);
    const rawCount = out.likeCount ?? out.likecount;
    let n = Number.parseInt(String(rawCount), 10);
    if (!Number.isFinite(n) || n < 1) {
        n = 0;
    }
    out.actors = parseJsonArray(out.actors).filter((a) => a && typeof a === "object");
    out.notificationIds = parseJsonArray(out.notificationIds ?? out.notificationids);
    const inferred = Math.max(out.actors.length, out.notificationIds.length, n, 1);
    out.likeCount = inferred;
    return out;
}

async function feedUnreadCountAll(userId) {
    const { rows } = await db.query(
        `SELECT (
            (SELECT COUNT(*)::int FROM (
                SELECT 1
                FROM notifications n
                WHERE n.user_id = $1 AND n.type::text = 'like'
                GROUP BY n.post_id
                HAVING bool_or(n.read = false)
            ) g)
            +
            (SELECT COUNT(*)::int
             FROM notifications n
             WHERE n.user_id = $1
               AND n.type::text <> 'like'
               AND n.type::text <> 'message'
               AND n.read = false)
        ) AS unread`,
        [userId]
    );
    return rows[0]?.unread ?? 0;
}

async function feedTotalCount(userId, feedDays) {
    const { rows } = await db.query(
        `SELECT (
            (SELECT COUNT(DISTINCT n.post_id)::int
             FROM notifications n
             WHERE n.user_id = $1 AND n.type::text = 'like'
               AND n.created_at >= CURRENT_TIMESTAMP - make_interval(days => $2::int))
            +
            (SELECT COUNT(*)::int
             FROM notifications n
             WHERE n.user_id = $1
               AND n.type::text <> 'like'
               AND n.type::text <> 'message'
               AND n.created_at >= CURRENT_TIMESTAMP - make_interval(days => $2::int))
        ) AS total`,
        [userId, feedDays]
    );
    return rows[0]?.total ?? 0;
}

router.put("/read-all", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        await db.query(
            `UPDATE notifications 
         SET read = true 
         WHERE user_id = $1 AND read = false`,
            [userId]
        );

        const unread = await feedUnreadCountAll(userId);
        res.json({ message: "Vse notifikacije označene kot prebrane", unreadCount: unread });
    } catch (err) {
        console.error("Napaka /api/notifications/read-all:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri označevanju notifikacij");
    }
});

router.put("/read-likes", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const postId = parseInt(req.body?.postId, 10);
        if (!Number.isFinite(postId)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven postId");
        }

        await db.query(
            `UPDATE notifications
             SET read = true
             WHERE user_id = $1 AND type::text = 'like' AND post_id = $2 AND read = false`,
            [userId, postId]
        );

        const unread = await feedUnreadCountAll(userId);
        res.json({ message: "Skupina lajkov označena kot prebrana", unreadCount: unread });
    } catch (err) {
        console.error("Napaka /api/notifications/read-likes:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri označevanju notifikacij");
    }
});

router.get("/", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);
        const feedDays = parseFeedDays(req.query);
        const canViewHidden = await canViewHiddenContent(userId);

        const anonLabel = anonParticipantLabelExpr("n.post_id", "u.id");
        const { rows } = await db.query(
            `WITH like_agg AS (
                SELECT
                    MIN(n.id)::int AS id,
                    'like'::character varying(20) AS type,
                    bool_and(n.read) AS "read",
                    MAX(n.created_at) AS "createdAt",
                    n.post_id AS "postId",
                    NULL::int AS "commentId",
                    NULL::int AS "threadId",
                    NULL::int AS "messageId",
                    NULL::bigint AS "appealId",
                    NULL::bigint AS "friendRequestId",
                    NULL::jsonb AS metadata,
                    (
                        SELECT COALESCE(
                            CASE
                                WHEN p2.id IS NULL THEN NULL
                                WHEN p2.is_hidden = false OR p2.user_id = $1 OR $4 = true THEN p2.title
                                ELSE NULL
                            END,
                            'Objava ni več na voljo'
                        )
                        FROM posts p2
                        WHERE p2.id = n.post_id
                    ) AS "postTitle",
                    (array_agg(u.id ORDER BY n.created_at DESC))[1] AS "actorId",
                    (array_agg(u.username ORDER BY n.created_at DESC))[1] AS "actorUsername",
                    COUNT(*)::int AS "likeCount",
                    COALESCE(
                        json_agg(
                            json_build_object('id', u.id, 'username', u.username)
                            ORDER BY n.created_at DESC
                        ) FILTER (WHERE u.id IS NOT NULL),
                        '[]'::json
                    ) AS actors,
                    COALESCE(
                        json_agg(n.id ORDER BY n.created_at DESC) FILTER (WHERE n.id IS NOT NULL),
                        '[]'::json
                    ) AS "notificationIds"
                FROM notifications n
                JOIN users u ON u.id = n.actor_id
                WHERE n.user_id = $1 AND n.type::text = 'like'
                  AND n.created_at >= CURRENT_TIMESTAMP - make_interval(days => $5::int)
                GROUP BY n.post_id
            ),
            other AS (
                SELECT
                    n.id,
                    n.type,
                    n.read AS "read",
                    n.created_at AS "createdAt",
                    n.post_id AS "postId",
                    n.comment_id AS "commentId",
                    n.thread_id AS "threadId",
                    n.message_id AS "messageId",
                    n.appeal_id AS "appealId",
                    n.friend_request_id AS "friendRequestId",
                    n.metadata AS metadata,
                    CASE
                        WHEN n.type::text = 'appeal_resolved' THEN 'Moderacija'
                        WHEN n.type::text = 'friend_request' THEN 'Prijateljstva'
                        ELSE COALESCE(
                            CASE
                                WHEN p.id IS NULL THEN NULL
                                WHEN p.is_hidden = false OR p.user_id = $1 OR $4 = true THEN p.title
                                ELSE NULL
                            END,
                            'Objava ni več na voljo'
                        )
                    END AS "postTitle",
                    u.id AS "actorId",
                    CASE
                        WHEN (n.type::text = 'comment' OR n.type::text = 'reply') AND ac.is_anonymous IS TRUE THEN ${anonLabel}
                        ELSE u.username
                    END AS "actorUsername",
                    NULL::int AS "likeCount",
                    NULL::json AS actors,
                    NULL::json AS "notificationIds"
                FROM notifications n
                LEFT JOIN posts p
                  ON p.id = n.post_id
                 AND p.status <> 'deleted'
                 AND p.deleted_at IS NULL
                JOIN users u ON u.id = n.actor_id
                LEFT JOIN LATERAL (
                    SELECT c.is_anonymous
                    FROM comments c
                    WHERE (n.type::text = 'comment' OR n.type::text = 'reply')
                        AND c.post_id = n.post_id
                        AND c.user_id = n.actor_id
                        AND c.status <> 'deleted'
                        AND c.deleted_at IS NULL
                        AND (
                            (n.type::text = 'comment' AND c.parent_comment_id IS NULL)
                            OR (n.type::text = 'reply' AND c.parent_comment_id IS NOT NULL)
                        )
                        AND c.created_at <= n.created_at + interval '5 seconds'
                    ORDER BY c.created_at DESC, c.id DESC
                    LIMIT 1
                ) ac ON true
                WHERE n.user_id = $1
                  AND n.type::text <> 'like'
                  AND n.type::text <> 'message'
                  AND n.created_at >= CURRENT_TIMESTAMP - make_interval(days => $5::int)
            ),
            feed AS (
                SELECT * FROM like_agg
                UNION ALL
                SELECT * FROM other
            )
            SELECT * FROM feed
            ORDER BY "createdAt" DESC
            LIMIT $2 OFFSET $3`,
            [userId, limit, offset, canViewHidden, feedDays]
        );

        const total = await feedTotalCount(userId, feedDays);
        const unread = await feedUnreadCountAll(userId);

        res.json({
            items: rows.map(normalizeNotificationRow),
            pagination: {
                limit,
                offset,
                total
            },
            unreadCount: unread
        });
    } catch (err) {
        console.error("Napaka /api/notifications:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju notifikacij");
    }
});

router.put("/:id/read", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const { rows } = await db.query(
            `UPDATE notifications 
         SET read = true 
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
            [id, userId]
        );

        if (rows.length === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Notifikacija ne obstaja");
        }

        const unread = await feedUnreadCountAll(userId);
        res.json({ message: "Notifikacija označena kot prebrana", unreadCount: unread });
    } catch (err) {
        console.error("Napaka /api/notifications/:id/read:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri označevanju notifikacije");
    }
});

module.exports = router;
