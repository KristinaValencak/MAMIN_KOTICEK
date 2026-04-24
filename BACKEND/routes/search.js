const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const { tryVerifyAccessToken } = require("../utils/jwtAccess");
const { searchGetIpLimiter } = require("../middleware/rateLimiters");
const { canViewHiddenContent } = require("../services/permissions");
const L = require("../constants/inputLimits");
const { anonParticipantLabelExpr } = require("../utils/anonymousParticipantLabel");

function parseLimitOffset(req) {
  const limitRaw = parseInt(req.query.limit || "20", 10);
  const offsetRaw = parseInt(req.query.offset || "0", 10);
  const limit = Math.min(Number.isFinite(limitRaw) ? Math.max(limitRaw, 1) : 20, 50);
  const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;
  return { limit, offset };
}

function normalizeType(v) {
  const t = String(v || "all").trim().toLowerCase();
  if (t === "users" || t === "posts" || t === "marketplace" || t === "all") return t;
  return "all";
}

function parseOptionalUserId(req) {
  const auth = req.headers["authorization"];
  const cookieToken = req.cookies?.token;
  const bearer = auth ? auth.split(" ")[1] : null;
  const token = cookieToken || bearer;
  if (!token) return null;
  const payload = tryVerifyAccessToken(token);
  const id = Number(payload?.id);
  return Number.isFinite(id) ? id : null;
}

function buildSectionsPayload({ q, users, usersTotal, posts, postsTotal, marketplace, marketplaceTotal }) {
  return {
    q,
    type: "all",
    sections: {
      users: { items: users, total: usersTotal },
      posts: { items: posts, total: postsTotal },
      marketplace: { items: marketplace, total: marketplaceTotal },
    },
  };
}

router.get("/", searchGetIpLimiter, async (req, res) => {
  try {
    const qRaw = String(req.query.q || "");
    const q = qRaw.trim().slice(0, L.SEARCH_QUERY);
    const type = normalizeType(req.query.type);
    const { limit, offset } = parseLimitOffset(req);

    if (q.length < 2) {
      if (type === "all") {
        return res.json(
          buildSectionsPayload({
            q,
            users: [],
            usersTotal: 0,
            posts: [],
            postsTotal: 0,
            marketplace: [],
            marketplaceTotal: 0,
          })
        );
      }
      return res.json({ q, type, items: [], pagination: { limit, offset, total: 0 } });
    }

    const qLower = q.toLowerCase();
    const like = `%${qLower}%`;
    const userId = parseOptionalUserId(req);
    const canViewHidden = userId ? await canViewHiddenContent(userId) : false;

    // NOTE: For "all" we return limited "top N" per section (fixed small limit).
    const sectionLimit = Math.min(limit, 8);

    async function searchUsers(sectionMode) {
      const usersLimit = sectionMode ? sectionLimit : limit;
      const usersOffset = sectionMode ? 0 : offset;
      const bioVisibleRows = `(
          NOT COALESCE(u.is_profile_private, false)
          OR ($4::bigint IS NOT NULL AND u.id = $4::bigint)
          OR (
            $4::bigint IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM friends f
              WHERE f.user_id_1 = LEAST(u.id, $4::bigint)
                AND f.user_id_2 = GREATEST(u.id, $4::bigint)
            )
          )
        )`;
      const bioVisibleCount = `(
          NOT COALESCE(u.is_profile_private, false)
          OR ($2::bigint IS NOT NULL AND u.id = $2::bigint)
          OR (
            $2::bigint IS NOT NULL
            AND EXISTS (
              SELECT 1 FROM friends f
              WHERE f.user_id_1 = LEAST(u.id, $2::bigint)
                AND f.user_id_2 = GREATEST(u.id, $2::bigint)
            )
          )
        )`;
      const rowsRes = await db.query(
        `SELECT u.id, u.username, u.created_at, u.avatar_url AS "avatarUrl",
                CASE WHEN ${bioVisibleRows} THEN u.bio ELSE NULL END AS bio
         FROM users u
         WHERE (
             LOWER(u.username) LIKE $1
             OR (LOWER(COALESCE(u.bio, '')) LIKE $1 AND ${bioVisibleRows})
           )
           AND ($4::bigint IS NULL OR u.id <> $4)
           AND (
             $4::bigint IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM user_blocks ub
               WHERE (ub.blocker_id = $4 AND ub.blocked_id = u.id)
                  OR (ub.blocker_id = u.id AND ub.blocked_id = $4)
             )
           )
         ORDER BY u.username ASC
         LIMIT $2 OFFSET $3`,
        [like, usersLimit, usersOffset, userId]
      );
      const countRes = await db.query(
        `SELECT COUNT(*)::int AS count
         FROM users u
         WHERE (
             LOWER(u.username) LIKE $1
             OR (LOWER(COALESCE(u.bio, '')) LIKE $1 AND ${bioVisibleCount})
           )
           AND ($2::bigint IS NULL OR u.id <> $2)
           AND (
             $2::bigint IS NULL
             OR NOT EXISTS (
               SELECT 1 FROM user_blocks ub
               WHERE (ub.blocker_id = $2 AND ub.blocked_id = u.id)
                  OR (ub.blocker_id = u.id AND ub.blocked_id = $2)
             )
           )`,
        [like, userId]
      );
      return {
        items: rowsRes.rows.map((u) => ({
          id: u.id,
          username: u.username,
          bio: u.bio,
          created_at: u.created_at,
          avatarUrl: u.avatarUrl || null,
        })),
        total: countRes.rows?.[0]?.count ?? 0,
      };
    }

    async function searchPosts(sectionMode) {
      const postsLimit = sectionMode ? sectionLimit : limit;
      const postsOffset = sectionMode ? 0 : offset;
      const rowsRes = await db.query(
        `
        SELECT
          p.id,
          p.title,
          p.content,
          p.image_url AS "imageUrl",
          p.image_public_id AS "imagePublicId",
          p.city AS city,
          p.tags AS tags,
          p.created_at AS "createdAt",
          p.is_featured AS "isFeatured",
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
          c.name        AS "categoryName",
          c.slug        AS "categorySlug",
          COALESCE(like_counts.like_count, 0) AS "likeCount",
          CASE WHEN user_likes.post_id IS NOT NULL THEN true ELSE false END AS "isLiked",
          CASE WHEN user_favs.post_id IS NOT NULL THEN true ELSE false END AS "isFavorited",
          COALESCE(comment_counts.comment_count, 0) AS "commentCount"
        FROM posts p
        JOIN users u ON u.id = p.user_id
        LEFT JOIN categories c ON c.id = p.category_id
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
        WHERE (LOWER(p.title) LIKE $1 OR LOWER(p.content) LIKE $1 OR LOWER(u.username) LIKE $1)
          AND p.status <> 'deleted'
          AND p.deleted_at IS NULL
          AND (p.is_hidden = false OR ($5::bigint IS NOT NULL AND p.user_id = $5) OR $6 = true)
          AND (
            $5::bigint IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM user_blocks ub
              WHERE (ub.blocker_id = $5 AND ub.blocked_id = p.user_id)
                 OR (ub.blocker_id = p.user_id AND ub.blocked_id = $5)
            )
          )
        ORDER BY p.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [like, postsLimit, postsOffset, userId || 0, userId, canViewHidden]
      );

      const countRes = await db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM posts p
        JOIN users u ON u.id = p.user_id
        WHERE (LOWER(p.title) LIKE $1 OR LOWER(p.content) LIKE $1 OR LOWER(u.username) LIKE $1)
          AND p.status <> 'deleted'
          AND p.deleted_at IS NULL
          AND (p.is_hidden = false OR ($2::bigint IS NOT NULL AND p.user_id = $2) OR $3 = true)
          AND (
            $2::bigint IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM user_blocks ub
              WHERE (ub.blocker_id = $2 AND ub.blocked_id = p.user_id)
                 OR (ub.blocker_id = p.user_id AND ub.blocked_id = $2)
            )
          )
        `,
        [like, userId, canViewHidden]
      );

      return { items: rowsRes.rows, total: countRes.rows?.[0]?.count ?? 0 };
    }

    async function searchMarketplace(sectionMode) {
      const mpLimit = sectionMode ? sectionLimit : limit;
      const mpOffset = sectionMode ? 0 : offset;
      const rowsRes = await db.query(
        `
        SELECT
          l.id,
          l.title,
          l.description,
          l.is_gift AS "isGift",
          l.price,
          l.image_url AS "imageUrl",
          l.image_public_id AS "imagePublicId",
          l.created_at AS "createdAt"
        FROM marketplace_listings l
        WHERE l.status = 'active'
          AND l.deleted_at IS NULL
          AND (LOWER(l.title) LIKE $1 OR LOWER(l.description) LIKE $1)
          AND (
            $4::bigint IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM user_blocks ub
              WHERE (ub.blocker_id = $4 AND ub.blocked_id = l.user_id)
                 OR (ub.blocker_id = l.user_id AND ub.blocked_id = $4)
            )
          )
        ORDER BY l.created_at DESC
        LIMIT $2 OFFSET $3
        `,
        [like, mpLimit, mpOffset, userId]
      );
      const countRes = await db.query(
        `
        SELECT COUNT(*)::int AS count
        FROM marketplace_listings l
        WHERE l.status = 'active'
          AND l.deleted_at IS NULL
          AND (LOWER(l.title) LIKE $1 OR LOWER(l.description) LIKE $1)
          AND (
            $2::bigint IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM user_blocks ub
              WHERE (ub.blocker_id = $2 AND ub.blocked_id = l.user_id)
                 OR (ub.blocker_id = l.user_id AND ub.blocked_id = $2)
            )
          )
        `,
        [like, userId]
      );
      return { items: rowsRes.rows, total: countRes.rows?.[0]?.count ?? 0 };
    }

    if (type === "all") {
      const [usersRes, postsRes, mpRes] = await Promise.all([
        searchUsers(true),
        searchPosts(true),
        searchMarketplace(true),
      ]);
      return res.json(
        buildSectionsPayload({
          q,
          users: usersRes.items,
          usersTotal: usersRes.total,
          posts: postsRes.items,
          postsTotal: postsRes.total,
          marketplace: mpRes.items,
          marketplaceTotal: mpRes.total,
        })
      );
    }

    if (type === "users") {
      const r = await searchUsers(false);
      return res.json({ q, type, items: r.items, pagination: { limit, offset, total: r.total } });
    }
    if (type === "posts") {
      const r = await searchPosts(false);
      return res.json({ q, type, items: r.items, pagination: { limit, offset, total: r.total } });
    }
    if (type === "marketplace") {
      const r = await searchMarketplace(false);
      return res.json({ q, type, items: r.items, pagination: { limit, offset, total: r.total } });
    }

    return res.json({ q, type, items: [], pagination: { limit, offset, total: 0 } });
  } catch (err) {
    console.error("Napaka /api/search:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri iskanju");
  }
});

module.exports = router;

