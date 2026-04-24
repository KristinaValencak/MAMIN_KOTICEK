const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const { tryVerifyAccessToken } = require("../utils/jwtAccess");
const { canViewHiddenContent } = require("../services/permissions");
const { anonParticipantLabelExpr } = require("../utils/anonymousParticipantLabel");
const { getCategoryTags } = require("../constants/categoryTags");

router.get("/", async (_req, res) => {
    try {
        const { rows } = await db.query(
            `SELECT id, name, slug, description, sort_order
         FROM categories
         ORDER BY sort_order ASC, name ASC`
        );
        res.json(rows);
    } catch (err) {
        console.error("Napaka /api/categories:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju kategorij");
    }
});

router.get("/:slug/tags", async (req, res) => {
    try {
        const { slug } = req.params;
        const cat = await db.query(
            `SELECT id, slug FROM categories WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (cat.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Kategorija ne obstaja.");
        }
        return res.json({ items: getCategoryTags(slug) });
    } catch (err) {
        console.error("Napaka /api/categories/:slug/tags:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju tagov kategorije");
    }
});

router.get("/:slug/posts", async (req, res) => {
    try {
        const { slug } = req.params;
        const page = Math.max(parseInt(req.query.page || "1", 10), 1);
        const pageSize = Math.min(parseInt(req.query.pageSize || "20", 10), 100);
        const offset = (page - 1) * pageSize;
        const auth = req.headers["authorization"];
        const cookieToken = req.cookies?.token;
        let userId = null;
        const bearer = auth ? auth.split(" ")[1] : null;
        const token = cookieToken || bearer;
        if (token) {
            const payload = tryVerifyAccessToken(token);
            if (payload) userId = payload.id;
        }

        const canViewHidden = userId ? await canViewHiddenContent(userId) : false;

        const cat = await db.query(
            `SELECT id, name, slug FROM categories WHERE slug = $1 LIMIT 1`,
            [slug]
        );
        if (cat.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Kategorija ne obstaja.");
        }
        const categoryId = cat.rows[0].id;
        const sortRaw = (req.query.sort || "").toString().toLowerCase();
        const sortTop = sortRaw === "top";
        const orderBy = sortTop
            ? `ORDER BY (COALESCE(like_counts.like_count, 0) + COALESCE(comment_counts.comment_count, 0)) DESC, p.created_at DESC`
            : `ORDER BY p.created_at DESC`;

        const list = await db.query(
            `
            SELECT p.id,
               p.title,
               p.content,
               p.city AS city,
               p.tags AS tags,
               p.created_at AS "createdAt",
               p.is_anonymous AS "isAnonymous",
               CASE
                 WHEN p.is_anonymous = true AND ($4::bigint IS DISTINCT FROM p.user_id) THEN NULL
                 ELSE u.id
               END AS "userId",
               CASE
                 WHEN p.is_anonymous = true THEN ${anonParticipantLabelExpr("p.id", "u.id")}
                 ELSE u.username
               END AS "author",
               CASE WHEN p.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl",
                   COALESCE(like_counts.like_count, 0) AS "likeCount",
                   CASE WHEN user_likes.post_id IS NOT NULL THEN true ELSE false END AS "isLiked",
                   CASE WHEN user_favs.post_id IS NOT NULL THEN true ELSE false END AS "isFavorited",
                   COALESCE(comment_counts.comment_count, 0) AS "commentCount"
            FROM posts p
            JOIN users u ON u.id = p.user_id
            LEFT JOIN (
              SELECT post_id, COUNT(*)::int AS like_count
              FROM post_likes
              GROUP BY post_id
            ) like_counts ON like_counts.post_id = p.id
            LEFT JOIN (
              SELECT post_id
              FROM post_likes
              WHERE user_id = $4
            ) user_likes ON user_likes.post_id = p.id
            LEFT JOIN (
              SELECT post_id
              FROM post_favorites
              WHERE user_id = $4
            ) user_favs ON user_favs.post_id = p.id
            LEFT JOIN (
              SELECT post_id, COUNT(*)::int AS comment_count
              FROM comments
              WHERE is_hidden = false
                AND status <> 'deleted'
                AND deleted_at IS NULL
              GROUP BY post_id
            ) comment_counts ON comment_counts.post_id = p.id
            WHERE p.category_id = $1
              AND p.status <> 'deleted'
              AND p.deleted_at IS NULL
              AND (p.is_hidden = false OR (p.user_id = $4 AND $4 IS NOT NULL) OR $5 = true)
              AND (
                $4::bigint IS NULL
                OR NOT EXISTS (
                  SELECT 1 FROM user_blocks ub
                  WHERE (ub.blocker_id = $4 AND ub.blocked_id = p.user_id)
                     OR (ub.blocker_id = p.user_id AND ub.blocked_id = $4)
                )
              )
            ${orderBy}
            LIMIT $2 OFFSET $3
            `,
            [categoryId, pageSize, offset, userId || null, canViewHidden]
        );

        const totalRes = await db.query(
            `SELECT COUNT(*)::int AS count FROM posts p
             WHERE p.category_id = $1
               AND p.status <> 'deleted'
               AND p.deleted_at IS NULL
               AND (p.is_hidden = false OR (p.user_id = $2 AND $2 IS NOT NULL) OR $3 = true)
               AND (
                 $2::bigint IS NULL
                 OR NOT EXISTS (
                   SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $2 AND ub.blocked_id = p.user_id)
                      OR (ub.blocker_id = p.user_id AND ub.blocked_id = $2)
                 )
               )`,
            [categoryId, userId || null, canViewHidden]
        );

        res.json({
            category: cat.rows[0],
            items: list.rows,
            pagination: {
                page,
                pageSize,
                total: totalRes.rows[0].count,
                pages: Math.ceil(totalRes.rows[0].count / pageSize),
            },
        });
    } catch (err) {
        console.error("Napaka /api/categories/:slug/posts:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju objav kategorije");
    }
});

module.exports = router;
