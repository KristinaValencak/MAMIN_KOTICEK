const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requirePermission = require("../middleware/requirePermission");
const requireAdmin = require("../middleware/admin");
const { logModeration } = require("../services/contentReports");
const { createNotification } = require("../services/notifications/notificationWriter");

const readReports = requirePermission("moderation.reports.read");
const reviewReports = requirePermission("moderation.reports.review");
const hideContent = requirePermission("moderation.content.hide");
const deleteContent = [requireAdmin];

/** Reuse read permission for moderation dashboard auxiliary lists. */
const readModerationLists = readReports;

const REPORT_SELECT_FIELDS = `
            cr.id,
            cr.reporter_user_id AS "reporterUserId",
            ru.username AS "reporterUsername",
            cr.target_type AS "targetType",
            cr.target_id AS "targetId",
            cr.reason,
            cr.status,
            cr.resolution,
            cr.assigned_moderator_user_id AS "assignedModeratorUserId",
            cr.first_action_at AS "firstActionAt",
            cr.resolved_at AS "resolvedAt",
            cr.created_at AS "createdAt",
            cr.updated_at AS "updatedAt",
            CASE
                WHEN cr.target_type = 'post' THEN p.is_hidden
                WHEN cr.target_type = 'comment' THEN c.is_hidden
                WHEN cr.target_type = 'marketplace_listing' THEN ml.is_hidden
                ELSE NULL
            END AS "targetIsHidden",
            target_author.username AS "targetAuthorUsername",
            target_author.email AS "targetAuthorEmail"`;

const REPORT_FROM_JOINS = `
             FROM content_reports cr
             LEFT JOIN users ru ON ru.id = cr.reporter_user_id
             LEFT JOIN posts p ON cr.target_type = 'post' AND p.id = cr.target_id
             LEFT JOIN comments c ON cr.target_type = 'comment' AND c.id = cr.target_id
             LEFT JOIN marketplace_listings ml ON cr.target_type = 'marketplace_listing' AND ml.id = cr.target_id
             LEFT JOIN users target_author ON target_author.id = CASE
                 WHEN cr.target_type = 'post' THEN p.user_id
                 WHEN cr.target_type = 'comment' THEN c.user_id
                 WHEN cr.target_type = 'marketplace_listing' THEN ml.user_id
                 ELSE NULL
             END`;

/** GET /api/moderation/reports?status=pending&limit=20&offset=0 */
router.get("/reports", ...readReports, async (req, res) => {
    try {
        const status = (req.query.status || "").toString().trim().toLowerCase();
        const allowed = new Set(["", "pending", "reviewed", "resolved"]);
        if (!allowed.has(status)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven status.");
        }
        const targetType = (req.query.targetType || "").toString().trim();
        const allowedTypes = new Set(["", "post", "comment", "marketplace_listing", "user_profile"]);
        if (!allowedTypes.has(targetType)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetType.");
        }
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

        const params = [limit, offset];
        const where = [];
        if (status === "pending" || status === "reviewed" || status === "resolved") {
            params.push(status);
            where.push(`cr.status = $${params.length}`);
        }
        if (targetType) {
            params.push(targetType);
            where.push(`cr.target_type = $${params.length}`);
        }
        const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

        const { rows } = await db.query(
            `SELECT ${REPORT_SELECT_FIELDS}
             ${REPORT_FROM_JOINS}
             ${whereClause}
             ORDER BY cr.created_at DESC
             LIMIT $1 OFFSET $2`,
            params
        );

        let countSql = `SELECT COUNT(*)::int AS count FROM content_reports`;
        const countParams = [];
        const countWhere = [];
        if (status) {
            countParams.push(status);
            countWhere.push(`status = $${countParams.length}`);
        }
        if (targetType) {
            countParams.push(targetType);
            countWhere.push(`target_type = $${countParams.length}`);
        }
        if (countWhere.length) {
            countSql += ` WHERE ${countWhere.join(" AND ")}`;
        }
        const countRes = await db.query(countSql, countParams);

        res.json({
            items: rows,
            pagination: { limit, offset, total: countRes.rows[0]?.count ?? rows.length },
        });
    } catch (err) {
        console.error("GET /api/moderation/reports:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju prijav.");
    }
});

/** GET /api/moderation/hidden/posts?limit=20&offset=0 — list all hidden posts (moderation dashboard). */
router.get("/hidden/posts", ...readModerationLists, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const cursor = (req.query.cursor || "").toString().trim() || null;

        const cursorObj = cursor ? (() => { try { return JSON.parse(Buffer.from(cursor, "base64").toString("utf8")); } catch { return null; } })() : null;
        const cursorTs = cursorObj?.ts ? new Date(cursorObj.ts) : null;
        const cursorId = cursorObj?.id != null ? Number(cursorObj.id) : null;
        const cursorOk = cursorTs && Number.isFinite(cursorId);

        const params = [limit];
        const where = [
            `p.is_hidden = true`,
            `p.status <> 'deleted'`,
            `p.deleted_at IS NULL`,
        ];
        if (cursorOk) {
            params.push(cursorTs.toISOString(), cursorId);
            where.push(`(COALESCE(p.hidden_at, p.created_at), p.id) < ($2::timestamptz, $3::bigint)`);
        }

        const { rows } = await db.query(
            `SELECT
                p.id,
                p.title,
                p.created_at AS "createdAt",
                p.hidden_at AS "hiddenAt",
                p.hidden_by_user_id AS "hiddenByUserId",
                u.id AS "authorUserId",
                u.username AS "authorUsername",
                u.email AS "authorEmail"
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE ${where.join(" AND ")}
             ORDER BY COALESCE(p.hidden_at, p.created_at) DESC, p.id DESC
             LIMIT $1`,
            params
        );
        const last = rows[rows.length - 1] || null;
        const nextCursor = last
            ? Buffer.from(JSON.stringify({ ts: (last.hiddenAt || last.createdAt), id: Number(last.id) }), "utf8").toString("base64")
            : null;
        res.json({ items: rows, pageInfo: { hasMore: rows.length === limit, nextCursor } });
    } catch (err) {
        console.error("GET /api/moderation/hidden/posts:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju skritih objav.");
    }
});

/** GET /api/moderation/users/suspended?limit=20&offset=0 — list suspended profiles (moderation dashboard). */
router.get("/users/suspended", ...readModerationLists, async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const cursor = (req.query.cursor || "").toString().trim() || null;

        const cursorObj = cursor ? (() => { try { return JSON.parse(Buffer.from(cursor, "base64").toString("utf8")); } catch { return null; } })() : null;
        const cursorTs = cursorObj?.ts ? new Date(cursorObj.ts) : null;
        const cursorId = cursorObj?.id != null ? Number(cursorObj.id) : null;
        const cursorOk = cursorTs && Number.isFinite(cursorId);

        const params = [limit];
        const where = [
            `u.is_suspended = true`,
            `u.status <> 'deleted'`,
            `u.deleted_at IS NULL`,
        ];
        if (cursorOk) {
            params.push(cursorTs.toISOString(), cursorId);
            where.push(`(COALESCE(u.suspended_at, u.created_at), u.id) < ($2::timestamptz, $3::bigint)`);
        }

        const { rows } = await db.query(
            `SELECT
                u.id,
                u.username,
                u.email,
                u.suspended_at AS "suspendedAt",
                u.suspended_by_user_id AS "suspendedByUserId",
                u.suspension_reason AS "suspensionReason"
             FROM users u
             WHERE ${where.join(" AND ")}
             ORDER BY COALESCE(u.suspended_at, u.created_at) DESC, u.id DESC
             LIMIT $1`,
            params
        );
        const last = rows[rows.length - 1] || null;
        const nextCursor = last
            ? Buffer.from(JSON.stringify({ ts: (last.suspendedAt), id: Number(last.id) }), "utf8").toString("base64")
            : null;
        res.json({ items: rows, pageInfo: { hasMore: rows.length === limit, nextCursor } });
    } catch (err) {
        console.error("GET /api/moderation/users/suspended:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju suspendiranih profilov.");
    }
});

/** GET /api/moderation/reports/:id */
router.get("/reports/:id", ...readReports, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID.");
        }
        const { rows } = await db.query(
            `SELECT ${REPORT_SELECT_FIELDS}
             ${REPORT_FROM_JOINS}
             WHERE cr.id = $1`,
            [id]
        );
        if (rows.length === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Prijava ne obstaja.");
        }
        res.json(rows[0]);
    } catch (err) {
        console.error("GET /api/moderation/reports/:id:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju prijave.");
    }
});

/** POST /api/moderation/reports/:id/review — pending → reviewed */
router.post("/reports/:id/review", ...reviewReports, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID.");
        }
        const modId = req.user.id;

        const { rows } = await db.query(
            `UPDATE content_reports
             SET status = 'reviewed',
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $2),
                 first_action_at = COALESCE(first_action_at, NOW())
             WHERE id = $1 AND status = 'pending'
             RETURNING id, status`,
            [id, modId]
        );
        if (rows.length === 0) {
            const ex = await db.query(`SELECT id, status FROM content_reports WHERE id = $1`, [id]);
            if (ex.rowCount === 0) return sendJsonError(res, 404, CODES.NOT_FOUND, "Prijava ne obstaja.");
            return sendJsonError(
                res,
                409,
                CODES.CONFLICT,
                "Prijava ni več v stanju pending.",
                { reportStatus: ex.rows[0].status }
            );
        }

        await logModeration({
            actorUserId: modId,
            action: "report_reviewed",
            reportId: id,
            targetType: null,
            targetId: null,
            metadata: {},
        });

        res.json({ ok: true, id: rows[0].id, status: rows[0].status });
    } catch (err) {
        console.error("POST /api/moderation/reports/:id/review:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri označbi pregleda.");
    }
});

/** POST /api/moderation/reports/:id/ignore — resolved + ignored */
router.post("/reports/:id/ignore", ...reviewReports, async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (!Number.isFinite(id)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID.");
        }
        const modId = req.user.id;

        const cur = await db.query(
            `SELECT id, target_type, target_id, status FROM content_reports WHERE id = $1`,
            [id]
        );
        if (cur.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Prijava ne obstaja.");
        }
        if (cur.rows[0].status === "resolved") {
            return sendJsonError(res, 409, CODES.CONFLICT, "Prijava je že zaključena.");
        }

        const { rows } = await db.query(
            `UPDATE content_reports
             SET status = 'resolved',
                 resolution = 'ignored',
                 resolved_at = NOW(),
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $2)
             WHERE id = $1
             RETURNING id, status, resolution`,
            [id, modId]
        );

        await logModeration({
            actorUserId: modId,
            action: "report_ignored",
            reportId: id,
            targetType: cur.rows[0].target_type,
            targetId: cur.rows[0].target_id,
            metadata: {},
        });

        res.json({ ok: true, id: rows[0].id, status: rows[0].status, resolution: rows[0].resolution });
    } catch (err) {
        console.error("POST /api/moderation/reports/:id/ignore:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri prezrtju prijave.");
    }
});

/** POST /api/moderation/reports/:id/hide — skrije post/komentar, zaključi prijave za isto tarčo */
router.post("/reports/:id/hide", ...hideContent, async (req, res) => {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID.");
    }
    const modId = req.user.id;

    const rep = await db.query(`SELECT * FROM content_reports WHERE id = $1`, [id]);
    if (rep.rowCount === 0) {
        return sendJsonError(res, 404, CODES.NOT_FOUND, "Prijava ne obstaja.");
    }
    const r = rep.rows[0];
    const targetType = r.target_type;
    const targetId = r.target_id;

    if (targetType !== "post" && targetType !== "comment") {
        return sendJsonError(
            res,
            400,
            CODES.VALIDATION_ERROR,
            "Skrivanje je podprto samo za objave in komentarje.",
            { targetType }
        );
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");

        let newlyHidden = false;

        if (targetType === "post") {
            const u = await client.query(`UPDATE posts SET is_hidden = true, moderation_status = 'hidden',
                hidden_at = NOW(), hidden_by_user_id = $2 WHERE id = $1 AND is_hidden = false
                RETURNING id`, [targetId, modId]);
            if (u.rowCount > 0) {
                newlyHidden = true;
            } else {
                const exists = await client.query(`SELECT id, is_hidden FROM posts WHERE id = $1`, [targetId]);
                if (exists.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
                }
            }
        } else {
            const u = await client.query(
                `UPDATE comments SET is_hidden = true, moderation_status = 'hidden',
                 hidden_at = NOW(), hidden_by_user_id = $2 WHERE id = $1 AND is_hidden = false
                 RETURNING id`,
                [targetId, modId]
            );
            if (u.rowCount > 0) {
                newlyHidden = true;
            } else {
                const exists = await client.query(`SELECT id, is_hidden FROM comments WHERE id = $1`, [targetId]);
                if (exists.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
                }
            }
        }

        await client.query(
            `UPDATE content_reports
             SET status = 'resolved',
                 resolution = 'content_hidden',
                 resolved_at = NOW(),
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $3)
             WHERE target_type = $1 AND target_id = $2 AND status <> 'resolved'`,
            [targetType, targetId, modId]
        );

        await logModeration({
            actorUserId: modId,
            action: newlyHidden ? "content_hidden" : "reports_resolved_already_hidden",
            reportId: id,
            targetType,
            targetId,
            metadata: newlyHidden ? {} : { reason: "target_already_hidden" },
            client,
        });

        if (newlyHidden) {
            let authorUserId;
            let notifyPostId;
            let notifyCommentId;
            if (targetType === "post") {
                const au = await client.query(`SELECT user_id FROM posts WHERE id = $1`, [targetId]);
                authorUserId = au.rows[0]?.user_id;
                notifyPostId = targetId;
            } else {
                const au = await client.query(`SELECT user_id, post_id FROM comments WHERE id = $1`, [targetId]);
                authorUserId = au.rows[0]?.user_id;
                notifyPostId = au.rows[0]?.post_id;
                notifyCommentId = targetId;
            }
            if (authorUserId != null && notifyPostId != null && Number(authorUserId) !== Number(modId)) {
                const ntype = targetType === "post" ? "post_hidden" : "comment_hidden";
                try {
                    await createNotification({
                        recipientUserId: authorUserId,
                        actorUserId: modId,
                        type: ntype,
                        postId: Number(notifyPostId),
                        ...(notifyCommentId != null ? { commentId: Number(notifyCommentId) } : {}),
                        metadata: { targetType, targetId: Number(targetId), bannerKey: "hidden" },
                        client,
                    });
                } catch (notifErr) {
                    console.error("Napaka pri obvestilu avtorju (skrij):", notifErr);
                }
            }
        }

        await client.query("COMMIT");

        res.json({ ok: true, targetType, targetId, alreadyHidden: !newlyHidden });
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (e) {
            /* ignore */
        }
        console.error("POST /api/moderation/reports/:id/hide:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri skrivanju vsebine.");
    } finally {
        client.release();
    }
});

/**
 * POST /api/moderation/content/hide
 * Body: { targetType: 'post' | 'comment' | 'marketplace_listing', targetId: number }
 * Skrije objavo/komentar brez vezave na report-id (uporaba iz UI menijev).
 */
router.post("/content/hide", ...hideContent, async (req, res) => {
    const targetType = (req.body?.targetType || "").toString().trim();
    const targetIdRaw = req.body?.targetId;
    const modId = req.user.id;

    if (targetType !== "post" && targetType !== "comment" && targetType !== "marketplace_listing") {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetType (post | comment | marketplace_listing).");
    }
    const targetId = parseInt(String(targetIdRaw), 10);
    if (!Number.isFinite(targetId)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetId.");
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");

        let newlyHidden = false;

        if (targetType === "post") {
            const u = await client.query(
                `UPDATE posts
                 SET is_hidden = true,
                     moderation_status = 'hidden',
                     hidden_at = NOW(),
                     hidden_by_user_id = $2
                 WHERE id = $1 AND is_hidden = false
                 RETURNING id`,
                [targetId, modId]
            );
            if (u.rowCount > 0) {
                newlyHidden = true;
            } else {
                const exists = await client.query(`SELECT id, is_hidden FROM posts WHERE id = $1`, [targetId]);
                if (exists.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
                }
            }
        } else if (targetType === "comment") {
            const u = await client.query(
                `UPDATE comments
                 SET is_hidden = true,
                     moderation_status = 'hidden',
                     hidden_at = NOW(),
                     hidden_by_user_id = $2
                 WHERE id = $1 AND is_hidden = false
                 RETURNING id`,
                [targetId, modId]
            );
            if (u.rowCount > 0) {
                newlyHidden = true;
            } else {
                const exists = await client.query(`SELECT id, is_hidden FROM comments WHERE id = $1`, [targetId]);
                if (exists.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
                }
            }
        } else {
            const u = await client.query(
                `UPDATE marketplace_listings
                 SET is_hidden = true,
                     hidden_at = NOW(),
                     hidden_by_user_id = $2,
                     updated_at = NOW()
                 WHERE id = $1 AND is_hidden = false
                 RETURNING id`,
                [targetId, modId]
            );
            if (u.rowCount > 0) {
                newlyHidden = true;
            } else {
                const exists = await client.query(`SELECT id, is_hidden FROM marketplace_listings WHERE id = $1`, [targetId]);
                if (exists.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja.");
                }
            }
        }

        // If moderator hides content directly (without a user report),
        // ensure there's a resolved report entry so it shows up under "zaključene" in the moderation dashboard.
        // This also makes it easier to find and unhide later.
        try {
            const ex = await client.query(
                `SELECT id
                 FROM content_reports
                 WHERE target_type = $1 AND target_id = $2
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [targetType, targetId]
            );
            if (ex.rowCount === 0) {
                await client.query(
                    `INSERT INTO content_reports
                        (reporter_user_id, target_type, target_id, reason, status, resolution,
                         assigned_moderator_user_id, first_action_at, resolved_at)
                     VALUES ($1, $2, $3, $4, 'resolved', 'content_hidden', $1, NOW(), NOW())`,
                    [modId, targetType, targetId, "moderation_direct_hide"]
                );
            }
        } catch (e) {
            // best-effort: do not block hide if reports schema differs
            console.error("Failed to create synthetic resolved report for direct hide:", e);
        }

        await client.query(
            `UPDATE content_reports
             SET status = 'resolved',
                 resolution = 'content_hidden',
                 resolved_at = NOW(),
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $3)
             WHERE target_type = $1 AND target_id = $2 AND status <> 'resolved'`,
            [targetType, targetId, modId]
        );

        await logModeration({
            actorUserId: modId,
            action: newlyHidden ? "content_hidden_direct" : "content_hide_direct_already_hidden",
            reportId: null,
            targetType,
            targetId,
            metadata: newlyHidden ? {} : { reason: "target_already_hidden" },
            client,
        });

        if (newlyHidden && targetType !== "marketplace_listing") {
            let authorUserId;
            let notifyPostId;
            let notifyCommentId;
            if (targetType === "post") {
                const au = await client.query(`SELECT user_id FROM posts WHERE id = $1`, [targetId]);
                authorUserId = au.rows[0]?.user_id;
                notifyPostId = targetId;
            } else if (targetType === "comment") {
                const au = await client.query(`SELECT user_id, post_id FROM comments WHERE id = $1`, [targetId]);
                authorUserId = au.rows[0]?.user_id;
                notifyPostId = au.rows[0]?.post_id;
                notifyCommentId = targetId;
            }
            if (authorUserId != null && Number(authorUserId) !== Number(modId)) {
                const ntype = targetType === "post" ? "post_hidden" : "comment_hidden";
                try {
                    await createNotification({
                        recipientUserId: authorUserId,
                        actorUserId: modId,
                        type: ntype,
                        ...(notifyPostId != null ? { postId: Number(notifyPostId) } : {}),
                        ...(notifyCommentId != null ? { commentId: Number(notifyCommentId) } : {}),
                        metadata: { targetType, targetId: Number(targetId), bannerKey: "hidden" },
                        client,
                    });
                } catch (notifErr) {
                    console.error("Napaka pri obvestilu avtorju (direct skrij):", notifErr);
                }
            }
        } else if (newlyHidden && targetType === "marketplace_listing") {
            // Marketplace listing hide notification uses metadata for deep-linking (listingId isn't a top-level notification field).
            const au = await client.query(`SELECT user_id FROM marketplace_listings WHERE id = $1`, [targetId]);
            const authorUserId = au.rows[0]?.user_id;
            if (authorUserId != null && Number(authorUserId) !== Number(modId)) {
                try {
                    await createNotification({
                        recipientUserId: authorUserId,
                        actorUserId: modId,
                        type: "listing_hidden",
                        metadata: { targetType, targetId: Number(targetId), bannerKey: "hidden" },
                        client,
                    });
                } catch (notifErr) {
                    console.error("Napaka pri obvestilu avtorju (listing skrij):", notifErr);
                }
            }
        }

        await client.query("COMMIT");
        res.json({ ok: true, targetType, targetId, alreadyHidden: !newlyHidden });
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (e) {
            /* ignore */
        }
        console.error("POST /api/moderation/content/hide:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri skrivanju vsebine.");
    } finally {
        client.release();
    }
});

/** POST /api/moderation/content/unhide — odkrije post/komentar/oglas (moderation.content.unhide) */
router.post("/content/unhide", ...requirePermission("moderation.content.unhide"), async (req, res) => {
    try {
        const targetType = (req.body?.targetType || "").toString().trim();
        const targetId = req.body?.targetId;
        const modId = req.user.id;

        if (targetType !== "post" && targetType !== "comment" && targetType !== "marketplace_listing") {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetType (post | comment | marketplace_listing).");
        }
        const tid = parseInt(String(targetId), 10);
        if (!Number.isFinite(tid)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetId.");
        }

        let authorUserId = null;
        let notifyPostId = null;
        let notifyCommentId = null;

        if (targetType === "post") {
            const { rowCount } = await db.query(
                `UPDATE posts SET is_hidden = false, moderation_status = 'active',
                 hidden_at = NULL, hidden_by_user_id = NULL WHERE id = $1`,
                [tid]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
            }
            const au = await db.query(`SELECT user_id FROM posts WHERE id = $1`, [tid]);
            authorUserId = au.rows[0]?.user_id ?? null;
            notifyPostId = tid;
        } else if (targetType === "comment") {
            const { rowCount } = await db.query(
                `UPDATE comments SET is_hidden = false, moderation_status = 'active',
                 hidden_at = NULL, hidden_by_user_id = NULL WHERE id = $1`,
                [tid]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
            }
            const au = await db.query(`SELECT user_id, post_id FROM comments WHERE id = $1`, [tid]);
            authorUserId = au.rows[0]?.user_id ?? null;
            notifyPostId = au.rows[0]?.post_id ?? null;
            notifyCommentId = tid;
        } else {
            const { rowCount } = await db.query(
                `UPDATE marketplace_listings
                 SET is_hidden = false,
                     hidden_at = NULL,
                     hidden_by_user_id = NULL,
                     updated_at = NOW()
                 WHERE id = $1`,
                [tid]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja.");
            }
            const au = await db.query(`SELECT user_id FROM marketplace_listings WHERE id = $1`, [tid]);
            authorUserId = au.rows[0]?.user_id ?? null;
        }

        await logModeration({
            actorUserId: modId,
            action: "content_unhidden",
            reportId: null,
            targetType,
            targetId: tid,
            metadata: {},
        });

        if (authorUserId != null && Number(authorUserId) !== Number(modId)) {
            const ntype =
                targetType === "post"
                    ? "post_unhidden"
                    : targetType === "comment"
                      ? "comment_unhidden"
                      : "listing_unhidden";
            try {
                await createNotification({
                    recipientUserId: authorUserId,
                    actorUserId: modId,
                    type: ntype,
                    ...(notifyPostId != null ? { postId: Number(notifyPostId) } : {}),
                    ...(notifyCommentId != null ? { commentId: Number(notifyCommentId) } : {}),
                    metadata: { targetType, targetId: Number(tid), bannerKey: "unhidden" },
                });
            } catch (notifErr) {
                console.error("Napaka pri obvestilu avtorju (odkrij):", notifErr);
            }
        }

        res.json({ ok: true, targetType, targetId: tid });
    } catch (err) {
        console.error("POST /api/moderation/content/unhide:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri odkrivanju vsebine.");
    }
});

/**
 * POST /api/moderation/content/delete
 * Body: { targetType: 'post' | 'comment' | 'marketplace_listing', targetId: number }
 * Admin-only brisanje vsebine (za Moderation dashboard).
 */
router.post("/content/delete", ...deleteContent, async (req, res) => {
    const targetType = (req.body?.targetType || "").toString().trim();
    const targetIdRaw = req.body?.targetId;
    const adminId = req.user.id;

    if (targetType !== "post" && targetType !== "comment" && targetType !== "marketplace_listing") {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetType (post | comment | marketplace_listing).");
    }
    const targetId = parseInt(String(targetIdRaw), 10);
    if (!Number.isFinite(targetId)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetId.");
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");

        if (targetType === "post") {
            const ex = await client.query(`SELECT id FROM posts WHERE id = $1`, [targetId]);
            if (ex.rowCount === 0) {
                await client.query("ROLLBACK");
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
            }
            await client.query(
                `UPDATE posts
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'admin',
                     deleted_reason = 'moderation_delete'
                 WHERE id = $1`,
                [targetId, adminId]
            );
            await client.query(
                `UPDATE comments
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'admin',
                     deleted_reason = 'moderation_delete'
                 WHERE post_id = $1`,
                [targetId, adminId]
            );
            await client.query(
                `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
                 VALUES ('post', $1, 'deleted', $2, 'admin', 'moderation_delete', '{}'::jsonb)`,
                [targetId, adminId]
            );
        } else if (targetType === "comment") {
            const ex = await client.query(`SELECT id FROM comments WHERE id = $1`, [targetId]);
            if (ex.rowCount === 0) {
                await client.query("ROLLBACK");
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
            }
            await client.query(
                `UPDATE comments
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'admin',
                     deleted_reason = 'moderation_delete'
                 WHERE id = $1`,
                [targetId, adminId]
            );
            await client.query(
                `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
                 VALUES ('comment', $1, 'deleted', $2, 'admin', 'moderation_delete', '{}'::jsonb)`,
                [targetId, adminId]
            );
        } else {
            const ex = await client.query(`SELECT id, status FROM marketplace_listings WHERE id = $1`, [targetId]);
            if (ex.rowCount === 0) {
                await client.query("ROLLBACK");
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja.");
            }
            // Soft-delete listing (consistent with /api/marketplace/:id DELETE).
            await client.query(
                `UPDATE marketplace_listings
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'admin',
                     deleted_reason = 'moderation_delete',
                     updated_at = NOW()
                 WHERE id = $1`,
                [targetId, adminId]
            );
            await client.query(
                `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
                 VALUES ('marketplace_listing', $1, 'deleted', $2, 'admin', 'moderation_delete', '{}'::jsonb)`,
                [targetId, adminId]
            );
        }

        await client.query(
            `UPDATE content_reports
             SET status = 'resolved',
                 resolution = 'content_deleted',
                 resolved_at = NOW(),
                 assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $3)
             WHERE target_type = $1 AND target_id = $2 AND status <> 'resolved'`,
            [targetType, targetId, adminId]
        );

        await logModeration({
            actorUserId: adminId,
            action: "content_deleted",
            reportId: null,
            targetType,
            targetId,
            metadata: {},
            client,
        });

        await client.query("COMMIT");
        res.json({ ok: true, targetType, targetId });
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (e) {
            /* ignore */
        }
        console.error("POST /api/moderation/content/delete:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju vsebine.");
    } finally {
        client.release();
    }
});

/**
 * POST /api/moderation/users/:id/suspend
 * Body: { reason?: string }
 * Admin-only: suspend user account (blocks non-GET authed actions).
 */
router.post("/users/:id/suspend", ...deleteContent, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetUserId) || targetUserId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika.");
        }
        const actorId = req.user.id;
        if (Number(actorId) === Number(targetUserId)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ne morete suspendirati samega sebe.");
        }
        const reason = req.body?.reason == null ? null : String(req.body.reason).trim().slice(0, 1000) || null;

        const { rowCount } = await db.query(
            `UPDATE users
             SET is_suspended = true,
                 suspended_at = NOW(),
                 suspended_by_user_id = $2,
                 suspension_reason = $3
             WHERE id = $1`,
            [targetUserId, actorId, reason]
        );
        if (rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
        }

        await logModeration({
            actorUserId: actorId,
            action: "user_suspended",
            reportId: null,
            targetType: "user_profile",
            targetId: targetUserId,
            metadata: reason ? { reason } : {},
        });

        // Close any open reports for this profile so they move to "resolved" in dashboard.
        try {
            await db.query(
                `UPDATE content_reports
                 SET status = 'resolved',
                     resolution = 'profile_suspended',
                     resolved_at = NOW(),
                     assigned_moderator_user_id = COALESCE(assigned_moderator_user_id, $2)
                 WHERE target_type = 'user_profile'
                   AND target_id = $1
                   AND status <> 'resolved'`,
                [targetUserId, actorId]
            );
        } catch (e) {
            // Best-effort; don't fail suspend if reports table/schema differs.
            console.error("Failed to resolve profile reports on suspend:", e);
        }

        try {
            await createNotification({
                recipientUserId: targetUserId,
                actorUserId: actorId,
                type: "profile_suspended",
                metadata: { targetType: "user_profile", targetId: Number(targetUserId), bannerKey: "suspended" },
            });
        } catch (notifErr) {
            console.error("Napaka pri obvestilu (profile_suspended):", notifErr);
        }

        res.json({ ok: true, userId: targetUserId, isSuspended: true });
    } catch (err) {
        console.error("POST /api/moderation/users/:id/suspend:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri suspenzu uporabnika.");
    }
});

/** POST /api/moderation/users/:id/unsuspend */
router.post("/users/:id/unsuspend", ...deleteContent, async (req, res) => {
    try {
        const targetUserId = parseInt(req.params.id, 10);
        if (!Number.isFinite(targetUserId) || targetUserId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika.");
        }
        const actorId = req.user.id;

        const { rowCount } = await db.query(
            `UPDATE users
             SET is_suspended = false,
                 suspended_at = NULL,
                 suspended_by_user_id = NULL,
                 suspension_reason = NULL
             WHERE id = $1`,
            [targetUserId]
        );
        if (rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
        }

        await logModeration({
            actorUserId: actorId,
            action: "user_unsuspended",
            reportId: null,
            targetType: "user_profile",
            targetId: targetUserId,
            metadata: {},
        });

        try {
            await createNotification({
                recipientUserId: targetUserId,
                actorUserId: actorId,
                type: "profile_unsuspended",
                metadata: { targetType: "user_profile", targetId: Number(targetUserId), bannerKey: "unsuspended" },
            });
        } catch (notifErr) {
            console.error("Napaka pri obvestilu (profile_unsuspended):", notifErr);
        }

        res.json({ ok: true, userId: targetUserId, isSuspended: false });
    } catch (err) {
        console.error("POST /api/moderation/users/:id/unsuspend:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri odstranitvi suspenza.");
    }
});

module.exports = router;
