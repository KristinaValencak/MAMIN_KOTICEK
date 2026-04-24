const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const requirePermission = require("../middleware/requirePermission");
const { logModeration } = require("../services/contentReports");
const { createNotification } = require("../services/notifications/notificationWriter");
const { assertCanCreateAppeal } = require("../services/appealLimits");

const readMod = requirePermission("moderation.reports.read");
const reviewMod = requirePermission("moderation.reports.review");

router.post("/", requireAuth, async (req, res) => {
    try {
        const targetType = (req.body?.targetType || "").toString().trim();
        const targetId = parseInt(String(req.body?.targetId ?? ""), 10);
        const uid = req.user.id;

        if (
            targetType !== "post" &&
            targetType !== "comment" &&
            targetType !== "marketplace_listing" &&
            targetType !== "user_profile"
        ) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                "Neveljaven tip (post | comment | marketplace_listing | user_profile)."
            );
        }
        if (!Number.isFinite(targetId) || targetId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID vsebine.");
        }

        if (targetType === "post") {
            const { rows, rowCount } = await db.query(
                `SELECT id, user_id, is_hidden FROM posts WHERE id = $1`,
                [targetId]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
            }
            if (Number(rows[0].user_id) !== Number(uid)) {
                return sendJsonError(res, 403, CODES.FORBIDDEN, "Zahtevo lahko odda samo avtor.");
            }
            if (!rows[0].is_hidden) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Objava ni skrita — pregled ni potreben.");
            }
        } else if (targetType === "comment") {
            const { rows, rowCount } = await db.query(
                `SELECT id, user_id, is_hidden FROM comments WHERE id = $1`,
                [targetId]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
            }
            if (Number(rows[0].user_id) !== Number(uid)) {
                return sendJsonError(res, 403, CODES.FORBIDDEN, "Zahtevo lahko odda samo avtor.");
            }
            if (!rows[0].is_hidden) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Komentar ni skrit — pregled ni potreben.");
            }
        } else if (targetType === "marketplace_listing") {
            const { rows, rowCount } = await db.query(
                `SELECT id, user_id, is_hidden FROM marketplace_listings WHERE id = $1`,
                [targetId]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja.");
            }
            if (Number(rows[0].user_id) !== Number(uid)) {
                return sendJsonError(res, 403, CODES.FORBIDDEN, "Zahtevo lahko odda samo avtor.");
            }
            if (!rows[0].is_hidden) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Oglas ni skrit — pregled ni potreben.");
            }
        } else if (targetType === "user_profile") {
            // `targetId` is the user id for the profile.
            if (Number(targetId) !== Number(uid)) {
                return sendJsonError(res, 403, CODES.FORBIDDEN, "Zahtevo lahko odda samo lastnik profila.");
            }
            const { rows, rowCount } = await db.query(
                `SELECT id, is_suspended FROM users WHERE id = $1`,
                [uid]
            );
            if (rowCount === 0) {
                return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
            }
            if (!rows[0].is_suspended) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Profil ni suspendiran — pregled ni potreben.");
            }
        }

        const dup = await db.query(
            `SELECT id FROM moderation_appeals
             WHERE target_type = $1 AND target_id = $2 AND status = 'pending'`,
            [targetType, targetId]
        );
        if (dup.rowCount > 0) {
            return sendJsonError(res, 409, CODES.CONFLICT, "Zahteva za pregled je že v teku.");
        }

        const limitCheck = await assertCanCreateAppeal(db, targetType, targetId);
        if (!limitCheck.ok) {
            const st = Number(limitCheck.status) || 400;
            const code = st === 409 ? CODES.CONFLICT : CODES.VALIDATION_ERROR;
            return sendJsonError(res, st, code, limitCheck.error);
        }

        const ins = await db.query(
            `INSERT INTO moderation_appeals (target_type, target_id, appellant_user_id, status)
             VALUES ($1, $2, $3, 'pending')
             RETURNING id, created_at AS "createdAt"`,
            [targetType, targetId, uid]
        );

        await logModeration({
            actorUserId: uid,
            action: "appeal_submitted",
            reportId: null,
            targetType,
            targetId,
            metadata: { appealId: ins.rows[0].id },
        });

        res.status(201).json({ ok: true, id: ins.rows[0].id, createdAt: ins.rows[0].createdAt });
    } catch (err) {
        console.error("POST /api/moderation/appeals:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri oddaji zahteve.");
    }
});

router.get("/pending/count", ...readMod, async (_req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT COUNT(*)::int AS count FROM moderation_appeals WHERE status = 'pending'`
        );
        res.json({ count: rows[0]?.count ?? 0 });
    } catch (err) {
        console.error("GET /api/moderation/appeals/pending/count:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri številu zahtev.");
    }
});

router.get("/pending", ...readMod, async (_req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT ma.id,
                    ma.target_type AS "targetType",
                    ma.target_id AS "targetId",
                    ma.created_at AS "createdAt",
                    ma.appellant_user_id AS "appellantUserId",
                    u.username AS "appellantUsername"
             FROM moderation_appeals ma
             JOIN users u ON u.id = ma.appellant_user_id
             WHERE ma.status = 'pending'
             ORDER BY ma.created_at ASC`
        );

        const enriched = await Promise.all(
            rows.map(async (r) => {
                let snippet = "";
                if (r.targetType === "post") {
                    const p = await db.query(`SELECT title FROM posts WHERE id = $1`, [r.targetId]);
                    snippet = p.rows[0]?.title || "";
                } else if (r.targetType === "comment") {
                    const c = await db.query(
                        `SELECT LEFT(content, 120) AS snip FROM comments WHERE id = $1`,
                        [r.targetId]
                    );
                    snippet = c.rows[0]?.snip || "";
                } else if (r.targetType === "marketplace_listing") {
                    const l = await db.query(
                        `SELECT title FROM marketplace_listings WHERE id = $1`,
                        [r.targetId]
                    );
                    snippet = l.rows[0]?.title || "Oglas";
                } else if (r.targetType === "user_profile") {
                    snippet = "Profil";
                }
                return { ...r, snippet };
            })
        );

        res.json({ items: enriched });
    } catch (err) {
        console.error("GET /api/moderation/appeals/pending:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju zahtev.");
    }
});

router.post("/:id/resolve", ...reviewMod, async (req, res) => {
    const appealId = parseInt(req.params.id, 10);
    const decision = (req.body?.decision || "").toString().trim().toLowerCase();
    const modId = req.user.id;

    if (!Number.isFinite(appealId)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID.");
    }
    if (decision !== "upheld" && decision !== "reversed") {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Odločitev: upheld ali reversed.");
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const ap = await client.query(
            `SELECT id, target_type, target_id, status, appellant_user_id
             FROM moderation_appeals
             WHERE id = $1
             FOR UPDATE`,
            [appealId]
        );
        if (ap.rowCount === 0) {
            await client.query("ROLLBACK");
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Zahteva ne obstaja.");
        }
        const row = ap.rows[0];
        if (row.status !== "pending") {
            await client.query("ROLLBACK");
            return sendJsonError(res, 409, CODES.CONFLICT, "Zahteva je že obravnavana.");
        }

        const targetType = row.target_type;
        const targetId = row.target_id;

        if (decision === "reversed") {
            if (targetType === "post") {
                const u = await client.query(
                    `UPDATE posts SET is_hidden = false, moderation_status = 'active',
                     hidden_at = NULL, hidden_by_user_id = NULL WHERE id = $1`,
                    [targetId]
                );
                if (u.rowCount === 0) {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
                }
            } else {
                if (targetType === "comment") {
                    const u = await client.query(
                        `UPDATE comments SET is_hidden = false, moderation_status = 'active',
                         hidden_at = NULL, hidden_by_user_id = NULL WHERE id = $1`,
                        [targetId]
                    );
                    if (u.rowCount === 0) {
                        await client.query("ROLLBACK");
                        return sendJsonError(res, 404, CODES.NOT_FOUND, "Komentar ne obstaja.");
                    }
                } else if (targetType === "marketplace_listing") {
                    const u = await client.query(
                        `UPDATE marketplace_listings
                         SET is_hidden = false, hidden_at = NULL, hidden_by_user_id = NULL
                         WHERE id = $1`,
                        [targetId]
                    );
                    if (u.rowCount === 0) {
                        await client.query("ROLLBACK");
                        return sendJsonError(res, 404, CODES.NOT_FOUND, "Oglas ne obstaja.");
                    }
                } else if (targetType === "user_profile") {
                    const u = await client.query(
                        `UPDATE users
                         SET is_suspended = false,
                             suspended_at = NULL,
                             suspended_by_user_id = NULL,
                             suspension_reason = NULL
                         WHERE id = $1`,
                        [targetId]
                    );
                    if (u.rowCount === 0) {
                        await client.query("ROLLBACK");
                        return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
                    }
                } else {
                    await client.query("ROLLBACK");
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven tip tarče.");
                }
            }
        }

        await client.query(
            `UPDATE moderation_appeals
             SET status = $2,
                 resolved_at = NOW(),
                 resolved_by_user_id = $3
             WHERE id = $1`,
            [appealId, decision === "reversed" ? "resolved_reversed" : "resolved_upheld", modId]
        );

        await logModeration({
            actorUserId: modId,
            action: decision === "reversed" ? "appeal_reversed_unhidden" : "appeal_upheld",
            reportId: null,
            targetType,
            targetId,
            metadata: { appealId },
            client,
        });

        await client.query("COMMIT");
        
        try {
            await createNotification({
                recipientUserId: row.appellant_user_id,
                actorUserId: modId,
                type: "appeal_resolved",
                appealId,
                metadata: { decision, targetType, targetId },
            });
        } catch (notifErr) {
            console.error("Napaka pri ustvarjanju notifikacije (appeal_resolved):", notifErr);
        }

        res.json({ ok: true, decision });
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (e) {
            /* ignore */
        }
        console.error("POST /api/moderation/appeals/:id/resolve:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri obravnavi zahteve.");
    } finally {
        client.release();
    }
});

module.exports = router;
