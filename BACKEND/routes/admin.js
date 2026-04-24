const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAdmin = require("../middleware/admin");
const { refreshBannedWordsCache } = require("../services/profanityFilter");

function safeBase64JsonDecode(cursor) {
    if (!cursor) return null;
    try {
        const raw = Buffer.from(String(cursor), "base64").toString("utf8");
        const obj = JSON.parse(raw);
        if (!obj || typeof obj !== "object") return null;
        const createdAt = obj.createdAt ? new Date(obj.createdAt) : null;
        const id = obj.id != null ? Number(obj.id) : null;
        if (!createdAt || Number.isNaN(createdAt.getTime())) return null;
        if (!Number.isFinite(id) || id < 1) return null;
        return { createdAt: createdAt.toISOString(), id };
    } catch {
        return null;
    }
}

function base64JsonEncode(obj) {
    const raw = JSON.stringify(obj);
    return Buffer.from(raw, "utf8").toString("base64");
}

router.delete("/posts", requireAdmin, async (req, res) => {
    try {
        // Soft-delete all posts + comments; keep rows for audit/moderation.
        const commentsRes = await db.query(
            `UPDATE comments
             SET status = 'deleted',
                 deleted_at = COALESCE(deleted_at, NOW())
             WHERE status <> 'deleted' OR deleted_at IS NULL
             RETURNING id`
        );
        await db.query("DELETE FROM post_likes");
        const postsRes = await db.query(
            `UPDATE posts
             SET status = 'deleted',
                 deleted_at = COALESCE(deleted_at, NOW())
             WHERE status <> 'deleted' OR deleted_at IS NULL
             RETURNING id`
        );

        res.json({
            message: "Vse objave so bile izbrisane",
            deletedCount: postsRes.rowCount,
            deletedCommentsCount: commentsRes.rowCount
        });
    } catch (err) {
        console.error("Napaka /api/admin/posts DELETE:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju vseh objav");
    }
});

router.delete("/comments", requireAdmin, async (req, res) => {
    try {
        const result = await db.query(
            `UPDATE comments
             SET status = 'deleted',
                 deleted_at = COALESCE(deleted_at, NOW())
             WHERE status <> 'deleted' OR deleted_at IS NULL
             RETURNING id`
        );

        res.json({
            message: "Vsi komentarji so bili izbrisani",
            deletedCount: result.rowCount
        });
    } catch (err) {
        console.error("Napaka /api/admin/comments DELETE:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju vseh komentarjev");
    }
});

/** POST /api/admin/banned-words/refresh — osveži predpomnilnik prepovedanih besed iz baze */
router.post("/banned-words/refresh", requireAdmin, async (req, res) => {
    try {
        const count = await refreshBannedWordsCache(db);
        return res.json({ ok: true, count });
    } catch (err) {
        console.error("Napaka /api/admin/banned-words/refresh:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri osvežitvi seznama");
    }
});

router.get("/stats", requireAdmin, async (req, res) => {
    try {
        const postsResult = await db.query("SELECT COUNT(*)::int AS count FROM posts");
        const commentsResult = await db.query("SELECT COUNT(*)::int AS count FROM comments");
        const usersResult = await db.query("SELECT COUNT(*)::int AS count FROM users");

        res.json({
            posts: postsResult.rows[0].count,
            comments: commentsResult.rows[0].count,
            users: usersResult.rows[0].count
        });
    } catch (err) {
        console.error("Napaka /api/admin/stats:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju statistike");
    }
});

/** GET /api/admin/roles — vse vloge s kodami pravic (za UI) */
router.get("/roles", requireAdmin, async (req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT r.id,
                    r.name,
                    r.description,
                    COALESCE(
                        json_agg(p.code ORDER BY p.code) FILTER (WHERE p.code IS NOT NULL),
                        '[]'::json
                    ) AS permissions
             FROM roles r
             LEFT JOIN role_permissions rp ON rp.role_id = r.id
             LEFT JOIN permissions p ON p.id = rp.permission_id
             GROUP BY r.id, r.name, r.description
             ORDER BY r.name ASC`
        );
        res.json({
            items: rows.map((r) => ({
                id: Number(r.id),
                name: r.name,
                description: r.description ?? null,
                permissions: r.permissions,
            })),
        });
    } catch (err) {
        console.error("Napaka /api/admin/roles:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju vlog");
    }
});

/** GET /api/admin/users/:userId/roles */
router.get("/users/:userId/roles", requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (!Number.isFinite(userId) || userId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven uporabnik.");
        }

        const u = await db.query(
            `SELECT id, username, is_admin AS "isAdmin"
             FROM users WHERE id = $1`,
            [userId]
        );
        if (u.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
        }

        const { rows } = await db.query(
            `SELECT r.id, r.name, r.description, ur.assigned_at AS "assignedAt"
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1
             ORDER BY r.name ASC`,
            [userId]
        );

        res.json({
            user: { id: Number(u.rows[0].id), username: u.rows[0].username, isAdmin: Boolean(u.rows[0].isAdmin) },
            roles: rows.map((r) => ({
                id: Number(r.id),
                name: r.name,
                description: r.description ?? null,
                assignedAt: r.assignedAt,
            })),
        });
    } catch (err) {
        console.error("Napaka /api/admin/users/:userId/roles GET:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju vlog uporabnika");
    }
});

/**
 * PUT /api/admin/users/:userId/roles
 * Telo: { "roleIds": [1, 2] } — zamenja vse dodelitve (prazno polje odstrani vse vloge).
 */
router.put("/users/:userId/roles", requireAdmin, async (req, res) => {
    const userId = parseInt(req.params.userId, 10);
    if (!Number.isFinite(userId) || userId < 1) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven uporabnik.");
    }
    const { roleIds } = req.body;
    if (!Array.isArray(roleIds)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Pričakovano polje roleIds (tabela števil).");
    }

    const ids = [...new Set(roleIds.map((x) => parseInt(String(x), 10)).filter((n) => Number.isFinite(n) && n > 0))];

    const client = await db.connect();
    try {
        const u = await client.query("SELECT id FROM users WHERE id = $1", [userId]);
        if (u.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
        }

        if (ids.length > 0) {
            const chk = await client.query(`SELECT id FROM roles WHERE id = ANY($1::bigint[])`, [ids]);
            if (chk.rowCount !== ids.length) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ena ali več vlog ne obstaja.");
            }
        }

        await client.query("BEGIN");
        await client.query("DELETE FROM user_roles WHERE user_id = $1", [userId]);
        for (const rid of ids) {
            await client.query(`INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)`, [userId, rid]);
        }
        await client.query("COMMIT");

        const { rows } = await db.query(
            `SELECT r.id, r.name, r.description
             FROM user_roles ur
             JOIN roles r ON r.id = ur.role_id
             WHERE ur.user_id = $1
             ORDER BY r.name ASC`,
            [userId]
        );

        res.json({
            ok: true,
            userId,
            roles: rows.map((r) => ({
                id: Number(r.id),
                name: r.name,
                description: r.description ?? null,
            })),
        });
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (e) {
            /* ignore */
        }
        console.error("Napaka /api/admin/users/:userId/roles PUT:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju vlog");
    } finally {
        client.release();
    }
});

/**
 * PUT /api/admin/users/:userId/admin
 * Body: { "isAdmin": true|false }
 * Nastavi users.is_admin (admin-only).
 */
router.put("/users/:userId/admin", requireAdmin, async (req, res) => {
    try {
        const userId = parseInt(req.params.userId, 10);
        if (!Number.isFinite(userId) || userId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven uporabnik.");
        }
        const isAdmin = req.body?.isAdmin;
        if (typeof isAdmin !== "boolean") {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Pričakovano polje isAdmin (boolean).");
        }

        const { rowCount } = await db.query(
            `UPDATE users
             SET is_admin = $2
             WHERE id = $1`,
            [userId, isAdmin]
        );
        if (rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja.");
        }
        return res.json({ ok: true, userId, isAdmin });
    } catch (err) {
        console.error("Napaka PUT /api/admin/users/:userId/admin:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri nastavitvi admin pravic.");
    }
});

/**
 * GET /api/admin/deleted
 * Admin-only unified feed of deletion events with keyset pagination.
 *
 * Query:
 *  - limit (default 30, max 100)
 *  - cursor (base64 json: { createdAt, id })
 *  - type: post|comment|marketplace_listing|user
 *  - source: user|admin|system
 *  - reason: string
 *  - eventType: deleted|restored|purged (default: deleted)
 *  - q: search in target summary / actor username / ids
 *  - from/to: ISO timestamps
 */
router.get("/deleted", requireAdmin, async (req, res) => {
    try {
        const limitRaw = parseInt(req.query.limit || "30", 10);
        const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;

        const cursor = safeBase64JsonDecode(req.query.cursor);
        const type = req.query.type ? String(req.query.type).trim() : null;
        const source = req.query.source ? String(req.query.source).trim() : null;
        const reason = req.query.reason ? String(req.query.reason).trim() : null;
        const eventType = req.query.eventType ? String(req.query.eventType).trim() : "deleted";
        const q = req.query.q ? String(req.query.q).trim() : null;
        const from = req.query.from ? String(req.query.from).trim() : null;
        const to = req.query.to ? String(req.query.to).trim() : null;

        const params = [];
        const where = [];

        params.push(eventType);
        where.push(`e.event_type = $${params.length}`);
        
        // When listing deleted items, hide targets that were later purged.
        // This keeps the "Deleted content" dashboard showing only actionable items.
        if (eventType === "deleted") {
            where.push(`NOT EXISTS (
              SELECT 1 FROM deletion_events p
              WHERE p.target_type = e.target_type
                AND p.target_id = e.target_id
                AND p.event_type = 'purged'
            )`);
        }

        if (type) {
            params.push(type);
            where.push(`e.target_type = $${params.length}`);
        }
        if (source) {
            params.push(source);
            where.push(`e.source = $${params.length}`);
        }
        if (reason) {
            params.push(reason);
            where.push(`e.reason = $${params.length}`);
        }
        if (from) {
            params.push(from);
            where.push(`e.created_at >= $${params.length}::timestamptz`);
        }
        if (to) {
            params.push(to);
            where.push(`e.created_at <= $${params.length}::timestamptz`);
        }
        if (cursor) {
            params.push(cursor.createdAt);
            const createdIdx = params.length;
            params.push(cursor.id);
            const idIdx = params.length;
            where.push(`(e.created_at, e.id) < ($${createdIdx}::timestamptz, $${idIdx}::bigint)`);
        }

        // Joins for target summary.
        // Note: if target rows were purged, these can be NULL; UI can fall back to metadata snapshot.
        const baseSql = `
          SELECT
            e.id,
            e.target_type AS "targetType",
            e.target_id AS "targetId",
            e.event_type AS "eventType",
            e.created_at AS "createdAt",
            e.source,
            e.reason,
            e.metadata,
            a.id AS "actorId",
            a.username AS "actorUsername",
            p.title AS "postTitle",
            c.content AS "commentContent",
            l.title AS "listingTitle",
            u.username AS "targetUsername"
          FROM deletion_events e
          LEFT JOIN users a ON a.id = e.actor_user_id
          LEFT JOIN posts p
            ON e.target_type = 'post' AND p.id = e.target_id
          LEFT JOIN comments c
            ON e.target_type = 'comment' AND c.id = e.target_id
          LEFT JOIN marketplace_listings l
            ON e.target_type = 'marketplace_listing' AND l.id = e.target_id
          LEFT JOIN users u
            ON e.target_type = 'user' AND u.id = e.target_id
        `;

        if (q) {
            const qLike = `%${q.toLowerCase()}%`;
            params.push(qLike);
            const qIdx = params.length;
            where.push(`(
              CAST(e.target_id AS TEXT) ILIKE $${qIdx}
              OR CAST(e.id AS TEXT) ILIKE $${qIdx}
              OR COALESCE(LOWER(a.username), '') ILIKE $${qIdx}
              OR COALESCE(LOWER(p.title), '') ILIKE $${qIdx}
              OR COALESCE(LOWER(l.title), '') ILIKE $${qIdx}
              OR COALESCE(LOWER(u.username), '') ILIKE $${qIdx}
            )`);
        }

        const sql =
            `${baseSql}
             ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
             ORDER BY e.created_at DESC, e.id DESC
             LIMIT ${limit + 1}`;

        const { rows } = await db.query(sql, params);
        const hasMore = rows.length > limit;
        const page = hasMore ? rows.slice(0, limit) : rows;
        const last = hasMore ? page[page.length - 1] : null;
        const nextCursor = last ? base64JsonEncode({ createdAt: last.createdAt, id: last.id }) : null;

        res.json({
            items: page.map((r) => ({
                id: Number(r.id),
                targetType: r.targetType,
                targetId: Number(r.targetId),
                eventType: r.eventType,
                createdAt: r.createdAt,
                source: r.source,
                reason: r.reason ?? null,
                actor: r.actorId ? { id: Number(r.actorId), username: r.actorUsername } : null,
                summary: {
                    postTitle: r.postTitle ?? null,
                    commentContent: r.commentContent ?? null,
                    listingTitle: r.listingTitle ?? null,
                    targetUsername: r.targetUsername ?? null,
                },
                metadata: r.metadata ?? {},
            })),
            pageInfo: { hasMore, nextCursor },
        });
    } catch (err) {
        console.error("Napaka GET /api/admin/deleted:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju izbrisanih vsebin.");
    }
});

// NOTE: We intentionally do NOT support restoring deleted users.
// Users are anonymized on self-delete; offering "restore" is misleading and not part of the product.

/** POST /api/admin/deleted/:targetType/:id/purge — hard-delete (GDPR purge). */
router.post("/deleted/:targetType/:id/purge", requireAdmin, async (req, res) => {
    const targetType = String(req.params.targetType || "").trim();
    const targetId = parseInt(String(req.params.id || ""), 10);
    if (!Number.isFinite(targetId) || targetId < 1) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID tarče.");
    }
    if (!["post", "comment", "marketplace_listing", "user"].includes(targetType)) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven targetType.");
    }

    const actorId = req.user?.id ?? null;

    const client = await db.connect();
    try {
        await client.query("BEGIN");

        // Idempotency: if already purged, don't purge again or create duplicate events.
        const alreadyPurged = await client.query(
            `SELECT 1 FROM deletion_events
             WHERE target_type = $1 AND target_id = $2 AND event_type = 'purged'
             LIMIT 1`,
            [targetType, targetId]
        );
        if (alreadyPurged.rowCount > 0) {
            await client.query("ROLLBACK");
            return res.json({ ok: true, targetType, targetId, alreadyPurged: true });
        }

        // Snapshot before deleting rows so audit remains meaningful.
        let metadata = {};
        if (targetType === "post") {
            const p = await client.query(`SELECT title FROM posts WHERE id = $1 LIMIT 1`, [targetId]);
            metadata = { postTitle: p.rows?.[0]?.title ?? null };
        } else if (targetType === "comment") {
            const c = await client.query(`SELECT content, post_id AS "postId" FROM comments WHERE id = $1 LIMIT 1`, [targetId]);
            metadata = { commentContent: c.rows?.[0]?.content ?? null, postId: c.rows?.[0]?.postId ?? null };
        } else if (targetType === "marketplace_listing") {
            const l = await client.query(`SELECT title FROM marketplace_listings WHERE id = $1 LIMIT 1`, [targetId]);
            metadata = { listingTitle: l.rows?.[0]?.title ?? null };
        } else {
            const u = await client.query(`SELECT username, email FROM users WHERE id = $1 LIMIT 1`, [targetId]);
            metadata = { username: u.rows?.[0]?.username ?? null, email: u.rows?.[0]?.email ?? null };
        }

        await client.query(
            `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
             VALUES ($1, $2, 'purged', $3, 'admin', 'gdpr_purge', $4::jsonb)`,
            [targetType, targetId, actorId, JSON.stringify(metadata || {})]
        );

        if (targetType === "post") {
            // Dependent comment entities for this post
            await client.query(
                `DELETE FROM comment_likes
                 WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
                [targetId]
            );
            await client.query(
                `DELETE FROM comment_support_reactions
                 WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
                [targetId]
            );
            await client.query(`DELETE FROM comments WHERE post_id = $1`, [targetId]);

            await client.query(`DELETE FROM post_likes WHERE post_id = $1`, [targetId]);
            await client.query(`DELETE FROM post_support_reactions WHERE post_id = $1`, [targetId]);
            await client.query(`DELETE FROM post_favorites WHERE post_id = $1`, [targetId]);

            await client.query(`DELETE FROM moderation_appeals WHERE target_type = 'post' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM content_reports WHERE target_type = 'post' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM notifications WHERE post_id = $1`, [targetId]);

            await client.query(`DELETE FROM posts WHERE id = $1`, [targetId]);
        } else if (targetType === "comment") {
            await client.query(`DELETE FROM comment_likes WHERE comment_id = $1`, [targetId]);
            await client.query(`DELETE FROM comment_support_reactions WHERE comment_id = $1`, [targetId]);
            await client.query(`DELETE FROM moderation_appeals WHERE target_type = 'comment' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM content_reports WHERE target_type = 'comment' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM notifications WHERE comment_id = $1`, [targetId]);
            await client.query(`DELETE FROM comments WHERE id = $1`, [targetId]);
        } else if (targetType === "marketplace_listing") {
            await client.query(`DELETE FROM moderation_appeals WHERE target_type = 'marketplace_listing' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM content_reports WHERE target_type = 'marketplace_listing' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM marketplace_listings WHERE id = $1`, [targetId]);
        } else {
            // Purge user: hard-delete authored content + account.
            // 1) Purge posts (with deps) by user
            const posts = await client.query(`SELECT id FROM posts WHERE user_id = $1`, [targetId]);
            for (const r of posts.rows) {
                const pid = Number(r.id);
                if (!Number.isFinite(pid)) continue;
                await client.query(
                    `DELETE FROM comment_likes
                     WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
                    [pid]
                );
                await client.query(
                    `DELETE FROM comment_support_reactions
                     WHERE comment_id IN (SELECT id FROM comments WHERE post_id = $1)`,
                    [pid]
                );
                await client.query(`DELETE FROM comments WHERE post_id = $1`, [pid]);
                await client.query(`DELETE FROM post_likes WHERE post_id = $1`, [pid]);
                await client.query(`DELETE FROM post_support_reactions WHERE post_id = $1`, [pid]);
                await client.query(`DELETE FROM post_favorites WHERE post_id = $1`, [pid]);
                await client.query(`DELETE FROM moderation_appeals WHERE target_type = 'post' AND target_id = $1`, [pid]);
                await client.query(`DELETE FROM content_reports WHERE target_type = 'post' AND target_id = $1`, [pid]);
                await client.query(`DELETE FROM notifications WHERE post_id = $1`, [pid]);
                await client.query(`DELETE FROM posts WHERE id = $1`, [pid]);
            }

            // 2) Purge standalone comments by user (if any remain)
            const comments = await client.query(`SELECT id FROM comments WHERE user_id = $1`, [targetId]);
            for (const r of comments.rows) {
                const cid = Number(r.id);
                if (!Number.isFinite(cid)) continue;
                await client.query(`DELETE FROM comment_likes WHERE comment_id = $1`, [cid]);
                await client.query(`DELETE FROM comment_support_reactions WHERE comment_id = $1`, [cid]);
                await client.query(`DELETE FROM moderation_appeals WHERE target_type = 'comment' AND target_id = $1`, [cid]);
                await client.query(`DELETE FROM content_reports WHERE target_type = 'comment' AND target_id = $1`, [cid]);
                await client.query(`DELETE FROM notifications WHERE comment_id = $1`, [cid]);
                await client.query(`DELETE FROM comments WHERE id = $1`, [cid]);
            }

            // 3) Purge listings
            await client.query(`DELETE FROM content_reports WHERE target_type = 'marketplace_listing' AND target_id IN (SELECT id FROM marketplace_listings WHERE user_id = $1)`, [targetId]);
            await client.query(`DELETE FROM marketplace_listings WHERE user_id = $1`, [targetId]);

            // 4) Misc user-linked tables (best effort)
            await client.query(`DELETE FROM push_device_tokens WHERE user_id = $1`, [targetId]);
            await client.query(`DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1`, [targetId]);
            await client.query(`DELETE FROM user_roles WHERE user_id = $1`, [targetId]);
            await client.query(`DELETE FROM user_blocks WHERE blocker_id = $1 OR blocked_id = $1`, [targetId]);
            await client.query(`DELETE FROM user_presence WHERE user_id = $1`, [targetId]);
            await client.query(`DELETE FROM message_typing WHERE user_id = $1`, [targetId]);
            await client.query(`DELETE FROM message_thread_reads WHERE user_id = $1`, [targetId]);
            await client.query(`DELETE FROM moderation_appeals WHERE appellant_user_id = $1`, [targetId]);
            await client.query(`DELETE FROM content_reports WHERE reporter_user_id = $1`, [targetId]);
            await client.query(`DELETE FROM content_reports WHERE target_type = 'user_profile' AND target_id = $1`, [targetId]);
            await client.query(`DELETE FROM moderation_logs WHERE actor_user_id = $1`, [targetId]);

            // Message threads/messages have ON DELETE CASCADE in migrations, but we still remove explicitly where possible.
            await client.query(`DELETE FROM message_threads WHERE user_id_1 = $1 OR user_id_2 = $1`, [targetId]);

            await client.query(`DELETE FROM users WHERE id = $1`, [targetId]);
        }

        await client.query("COMMIT");
        return res.json({ ok: true, targetType, targetId });
    } catch (err) {
        try {
            await client.query("ROLLBACK");
        } catch (_) {}
        console.error("Napaka POST /api/admin/deleted/:targetType/:id/purge:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri trajnem brisanju.");
    } finally {
        client.release();
    }
});

module.exports = router;