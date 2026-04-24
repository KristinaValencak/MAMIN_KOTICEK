const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const emailService = require("../services/emailService");
const requireAuth = require("../middleware/auth");
const {
    recordUserReport,
    DUPLICATE_ACTIVE_REPORT_CODE,
    DUPLICATE_ACTIVE_REPORT_MESSAGE,
} = require("../services/contentReports");
const { parseViewerUserId, loadCommentIfReadable } = require("../services/contentVisibility");
const L = require("../constants/inputLimits");
const { rejectIfStringTooLong } = require("../utils/rejectIfStringTooLong");
const { anonParticipantLabelExpr } = require("../utils/anonymousParticipantLabel");
const { commentReplyUserLimiter, userContentReportLimiter } = require("../middleware/rateLimiters");
const spamGuards = require("../services/spamGuards");
const { createMany, createNotification } = require("../services/notifications/notificationWriter");
const requireCleanContent = require("../middleware/requireCleanContent");

router.post("/:id/report", requireAuth, userContentReportLimiter, async (req, res) => {
    try {
        const commentId = parseInt(req.params.id);
        const { reason, commentContent, commentAuthor } = req.body;

        if (!reason || !reason.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Razlog prijave je obvezen.");
        }
        if (rejectIfStringTooLong(res, reason.trim(), L.REPORT_REASON, "Razlog prijave")) return;
        if (
            commentContent != null &&
            commentContent !== "" &&
            rejectIfStringTooLong(res, String(commentContent), L.COMMENT, "Komentar")
        ) {
            return;
        }
        if (
            commentAuthor != null &&
            commentAuthor !== "" &&
            rejectIfStringTooLong(res, String(commentAuthor), L.USERNAME_MAX * 2, "Avtor")
        ) {
            return;
        }

        const commentCheck = await db.query(
            `SELECT c.id, c.content, c.post_id, p.title as post_title, c.user_id
         FROM comments c
         JOIN posts p ON c.post_id = p.id
         WHERE c.id = $1`,
            [commentId]
        );

        if (commentCheck.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
        }

        const comment = commentCheck.rows[0];
        if (Number(comment.user_id) === Number(req.user.id)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Lastnega komentarja ne morete prijaviti.");
        }

        try {
            await recordUserReport({
                reporterUserId: req.user.id,
                targetType: "comment",
                targetId: commentId,
                reason: reason.trim(),
            });
        } catch (dbErr) {
            if (dbErr.code === DUPLICATE_ACTIVE_REPORT_CODE) {
                return sendJsonError(res, 409, CODES.CONFLICT, DUPLICATE_ACTIVE_REPORT_MESSAGE);
            }
            console.error("content_reports (comment):", dbErr);
            return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju prijave.");
        }

        let reporterEmail = null;
        try {
            const userResult = await db.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
            reporterEmail = userResult.rows[0]?.email || null;
        } catch (err) {}

        try {
            await emailService.sendCommentReportEmail(
                commentContent || comment.content,
                commentAuthor || "Neznano",
                commentId,
                comment.post_title,
                comment.post_id,
                reason.trim(),
                reporterEmail
            );
        } catch (emailError) {
            console.error("Error sending comment report email:", emailError);
        }

        res.status(200).json({ message: "Prijava uspešno poslana." });
    } catch (err) {
        console.error("Napaka pri prijavi komentarja:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri pošiljanju prijave.");
    }
});

router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const check = await db.query(
            "SELECT user_id FROM comments WHERE id = $1",
            [id]
        );

        if (check.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");
        }

        const userCheck = await db.query(
            "SELECT is_admin FROM users WHERE id = $1",
            [userId]
        );
        const isAdmin = userCheck.rows.length > 0 && userCheck.rows[0].is_admin;

        if (check.rows[0].user_id !== userId && !isAdmin) {
            return sendJsonError(res, 403, CODES.FORBIDDEN, "Nimate dovoljenja za brisanje tega komentarja");
        }

        const client = await db.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                `UPDATE comments
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = $3,
                     deleted_reason = $4
                 WHERE id = $1`,
                [id, userId, isAdmin ? "admin" : "user", isAdmin ? "admin_delete" : "self_delete"]
            );
            await client.query(
                `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
                 VALUES ('comment', $1, 'deleted', $2, $3, $4, '{}'::jsonb)`,
                [id, userId, isAdmin ? "admin" : "user", isAdmin ? "admin_delete" : "self_delete"]
            );
            await client.query("COMMIT");
        } catch (e) {
            try {
                await client.query("ROLLBACK");
            } catch (_) {}
            throw e;
        } finally {
            client.release();
        }

        res.json({ message: "Komentar je bil izbrisan" });
    } catch (err) {
        console.error("Napaka /api/comments/:id DELETE:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju komentarja");
    }
});

router.put("/:id/feature", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { isFeatured } = req.body;

        const userCheck = await db.query(
            "SELECT is_admin FROM users WHERE id = $1",
            [userId]
        );
        const isAdmin = userCheck.rows.length > 0 && userCheck.rows[0].is_admin;

        if (!isAdmin) {
            return sendJsonError(res, 403, CODES.FORBIDDEN, "Nimate admin dovoljenj");
        }

        const check = await db.query("SELECT id FROM comments WHERE id = $1", [id]);
        if (check.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");
        }

        if (isFeatured === true) {
            await db.query(
                `UPDATE comments 
         SET is_featured = FALSE 
         WHERE is_featured = TRUE AND id != $1`,
                [id]
            );
        }

        const { rows } = await db.query(
            `UPDATE comments 
     SET is_featured = $1 
     WHERE id = $2 
     RETURNING id, is_featured AS "isFeatured"`,
            [isFeatured === true, id]
        );

        res.json({
            id: rows[0].id,
            isFeatured: rows[0].isFeatured,
            message: isFeatured ? "Komentar označen kot najboljši tedna" : "Označba odstranjena"
        });
    } catch (err) {
        console.error("Napaka /api/comments/:id/feature:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri označevanju komentarja");
    }
});

router.get("/featured", async (req, res) => {
    try {
        const viewerUserId = await parseViewerUserId(req);
        const { rows } = await db.query(
            `SELECT c.id,
                c.content,
                c.created_at AS "createdAt",
                c.is_featured AS "isFeatured",
                c.post_id AS "postId",
                p.title AS "postTitle",
                CASE 
                  WHEN c.is_anonymous = true THEN NULL
                  ELSE u.id
                END AS "userId",
                CASE
                  WHEN c.is_anonymous = true THEN ${anonParticipantLabelExpr("c.post_id", "u.id")}
                  ELSE u.username
                END AS author,
                CASE WHEN c.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl"
             FROM comments c
             JOIN users u ON u.id = c.user_id
             JOIN posts p ON p.id = c.post_id
             WHERE c.is_featured = TRUE
               AND c.is_hidden = false
               AND c.status <> 'deleted'
               AND c.deleted_at IS NULL
               AND p.is_hidden = false
               AND p.status <> 'deleted'
               AND p.deleted_at IS NULL
               AND (
                 $1::bigint IS NULL
                 OR (
                   NOT EXISTS (
                     SELECT 1 FROM user_blocks ub
                     WHERE (ub.blocker_id = $1 AND ub.blocked_id = c.user_id)
                        OR (ub.blocker_id = c.user_id AND ub.blocked_id = $1)
                   )
                   AND NOT EXISTS (
                     SELECT 1 FROM user_blocks ub
                     WHERE (ub.blocker_id = $1 AND ub.blocked_id = p.user_id)
                        OR (ub.blocker_id = p.user_id AND ub.blocked_id = $1)
                   )
                 )
               )
             ORDER BY c.created_at DESC
             LIMIT 1`,
            [viewerUserId]
        );

        if (rows.length === 0) {
            return res.json({ comment: null, type: null });
        }

        res.json({ comment: rows[0], type: "comment" });
    } catch (err) {
        console.error("Napaka /api/comments/featured:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju featured komentarja");
    }
});

router.get("/:id/likes", async (req, res) => {
    try {
        const { id } = req.params;
        const viewerUserId = await parseViewerUserId(req);
        const readable = await loadCommentIfReadable(id, viewerUserId);
        if (!readable) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");
        }

        const countRes = await db.query(
            "SELECT COUNT(*)::int AS count FROM comment_likes WHERE comment_id = $1",
            [id]
        );
        const likeCount = countRes.rows[0].count;

        let isLiked = false;
        if (viewerUserId) {
            const likeRes = await db.query(
                "SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
                [id, viewerUserId]
            );
            isLiked = likeRes.rowCount > 0;
        }

        res.json({
            count: likeCount,
            isLiked: isLiked
        });
    } catch (err) {
        console.error("Napaka /api/comments/:id/likes:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju lajkov komentarja");
    }
});

router.post("/:id/likes", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const readable = await loadCommentIfReadable(id, userId);
        if (!readable) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");
        }

        const existing = await db.query(
            "SELECT id FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
            [id, userId]
        );

        if (existing.rowCount > 0) {
            await db.query(
                "DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
                [id, userId]
            );
            res.json({ action: "unliked", message: "Lajk odstranjen" });
        } else {
            // Mutual exclusivity: liking removes any support reaction by same user.
            await db.query(
                "DELETE FROM comment_support_reactions WHERE comment_id = $1 AND user_id = $2",
                [id, userId]
            );
            await db.query(
                "INSERT INTO comment_likes (comment_id, user_id) VALUES ($1, $2)",
                [id, userId]
            );
            res.json({ action: "liked", message: "Komentar lajkan" });
        }
    } catch (err) {
        console.error("Napaka /api/comments/:id/likes POST:", err);
        if (err.code === '23505') {
            return sendJsonError(res, 409, CODES.CONFLICT, "Komentar je že lajkan");
        }
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri lajkanju komentarja");
    }
});

function emptySupportCounts() {
    return { support: 0, hug: 0, understand: 0, together: 0 };
}

function normalizeReactionType(t) {
    const v = String(t || "").trim();
    if (v === "support" || v === "hug" || v === "understand" || v === "together") return v;
    return null;
}

async function getCommentSupportSummary(commentId, userIdOrNull) {
    const countsRes = await db.query(
        `SELECT reaction_type, COUNT(*)::int AS count
         FROM comment_support_reactions
         WHERE comment_id = $1
         GROUP BY reaction_type`,
        [commentId]
    );
    const counts = emptySupportCounts();
    countsRes.rows.forEach(r => {
        if (counts[r.reaction_type] !== undefined) counts[r.reaction_type] = r.count;
    });

    let myReaction = null;
    if (userIdOrNull) {
        const myRes = await db.query(
            `SELECT reaction_type
             FROM comment_support_reactions
             WHERE comment_id = $1 AND user_id = $2`,
            [commentId, userIdOrNull]
        );
        myReaction = myRes.rows[0]?.reaction_type || null;
    }

    const reactorsRes = await db.query(
        `SELECT "userId", username, "avatarUrl", "reactionKind", "reactionType"
         FROM (
           SELECT u.id AS "userId",
                  u.username,
                  u.avatar_url AS "avatarUrl",
                  'support'::text AS "reactionKind",
                  csr.reaction_type AS "reactionType",
                  csr.created_at
           FROM comment_support_reactions csr
           JOIN users u ON u.id = csr.user_id
           WHERE csr.comment_id = $1
           UNION ALL
           SELECT u.id,
                  u.username,
                  u.avatar_url,
                  'like'::text,
                  NULL::text,
                  cl.created_at
           FROM comment_likes cl
           JOIN users u ON u.id = cl.user_id
           WHERE cl.comment_id = $1
         ) combined
         ORDER BY combined.created_at DESC`,
        [commentId]
    );
    const reactors = reactorsRes.rows.map((row) => ({
        userId: row.userId,
        username: row.username,
        avatarUrl: row.avatarUrl || null,
        reactionKind: row.reactionKind,
        reactionType: row.reactionType || null,
    }));

    return { counts, myReaction, reactors };
}

router.get("/:id/support", async (req, res) => {
    try {
        const { id } = req.params;
        const commentId = parseInt(id, 10);
        if (!Number.isFinite(commentId)) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven id");

        const viewerUserId = await parseViewerUserId(req);
        const readable = await loadCommentIfReadable(commentId, viewerUserId);
        if (!readable) return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");

        const summary = await getCommentSupportSummary(commentId, viewerUserId || null);
        res.json(summary);
    } catch (err) {
        console.error("Napaka /api/comments/:id/support:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju podpore");
    }
});

router.post("/:id/support", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const commentId = parseInt(id, 10);
        if (!Number.isFinite(commentId)) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven id");
        const userId = req.user.id;

        const reactionType = normalizeReactionType(req.body?.reactionType);
        if (!reactionType) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven reactionType");

        const readable = await loadCommentIfReadable(commentId, userId);
        if (!readable) return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");

        // Mutual exclusivity: support reaction removes like by same user.
        await db.query(
            "DELETE FROM comment_likes WHERE comment_id = $1 AND user_id = $2",
            [commentId, userId]
        );

        const existing = await db.query(
            `SELECT reaction_type
             FROM comment_support_reactions
             WHERE comment_id = $1 AND user_id = $2`,
            [commentId, userId]
        );

        let action = "added";
        let myReaction = reactionType;

        if (existing.rowCount === 0) {
            await db.query(
                `INSERT INTO comment_support_reactions (comment_id, user_id, reaction_type)
                 VALUES ($1, $2, $3)`,
                [commentId, userId, reactionType]
            );
            action = "added";
        } else if (existing.rows[0].reaction_type === reactionType) {
            await db.query(
                `DELETE FROM comment_support_reactions
                 WHERE comment_id = $1 AND user_id = $2`,
                [commentId, userId]
            );
            action = "removed";
            myReaction = null;
        } else {
            await db.query(
                `UPDATE comment_support_reactions
                 SET reaction_type = $3, created_at = NOW()
                 WHERE comment_id = $1 AND user_id = $2`,
                [commentId, userId, reactionType]
            );
            action = "replaced";
        }

        // Notify comment author about support reactions (💗/🤗/🌸/🥰), excluding self.
        if ((action === "added" || action === "replaced") && readable.user_id != null && Number(readable.user_id) !== Number(userId)) {
            try {
                await createNotification({
                    recipientUserId: Number(readable.user_id),
                    actorUserId: Number(userId),
                    type: "support_react",
                    postId: readable.post_id != null ? Number(readable.post_id) : null,
                    commentId: Number(commentId),
                    metadata: { reactionType, kind: "comment" },
                });
            } catch (notifErr) {
                console.error("Napaka pri ustvarjanju notifikacije (support_react comment):", notifErr);
            }
        }

        const summary = await getCommentSupportSummary(commentId, userId);
        res.json({ action, myReaction: summary.myReaction, counts: summary.counts });
    } catch (err) {
        console.error("Napaka /api/comments/:id/support POST:", err);
        if (err.code === "23505") return sendJsonError(res, 409, CODES.CONFLICT, "Reakcija že obstaja");
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri podpori");
    }
});

router.post("/:id/replies", requireAuth, commentReplyUserLimiter, requireCleanContent("content"), async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const { content, isAnonymous } = req.body;

        if (!content?.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Vsebina je obvezna");
        }
        if (rejectIfStringTooLong(res, content.trim(), L.COMMENT, "Komentar")) return;

        const parent = await loadCommentIfReadable(id, userId);
        if (!parent) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja");
        }

        const postId = parent.post_id;

        try {
            await spamGuards.assertCommentSpamOk(db, userId, postId, id, content.trim());
        } catch (spamErr) {
            return spamGuards.sendSpamError(res, spamErr);
        }

        const anonRetLabel = anonParticipantLabelExpr("post_id", "user_id");
        const { rows } = await db.query(
            `INSERT INTO comments (post_id, user_id, content, is_anonymous, parent_comment_id, created_at)
             VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
             RETURNING id, content, created_at AS "createdAt", is_anonymous AS "isAnonymous", parent_comment_id AS "parentCommentId",
             (CASE WHEN is_anonymous THEN ${anonRetLabel} ELSE NULL END) AS "anonDisplayName"`,
            [postId, userId, content.trim(), isAnonymous || false, id]
        );

        const replyCommentId = Number(rows?.[0]?.id);
        const parentCommentId = Number(rows?.[0]?.parentCommentId);
        const userRes = await db.query("SELECT username, avatar_url FROM users WHERE id = $1", [userId]);
        const username = userRes.rows[0]?.username || "Neznano";
        const avatarUrl = rows[0].isAnonymous ? null : userRes.rows[0]?.avatar_url || null;

        // Notifications:
        // - only the parent comment author gets 'reply' (unless self)
        try {
            const recipients = [];
            const parentAuthorId = Number(parent.user_id);
            const actorId = Number(userId);

            if (Number.isFinite(parentAuthorId) && parentAuthorId !== actorId) {
                recipients.push(parentAuthorId);
            }

            if (recipients.length) {
                await createMany({
                    recipientUserIds: recipients,
                    actorUserId: actorId,
                    type: "reply",
                    postId: Number(postId),
                    commentId: Number.isFinite(replyCommentId) ? replyCommentId : null,
                    metadata: Number.isFinite(parentCommentId) ? { parentCommentId } : null,
                });
            }
        } catch (notifErr) {
            console.error("Napaka pri ustvarjanju notifikacije (reply):", notifErr);
        }

        res.status(201).json({
            id: rows[0].id,
            content: rows[0].content,
            createdAt: rows[0].createdAt,
            isAnonymous: rows[0].isAnonymous,
            parentCommentId: rows[0].parentCommentId,
            user: {
                id: userId,
                username: rows[0].isAnonymous ? rows[0].anonDisplayName : username,
                avatarUrl
            },
            likeCount: 0,
            isLiked: false
        });
    } catch (err) {
        console.error("Napaka /api/comments/:id/replies POST:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri dodajanju odgovora");
    }
});

module.exports = router;