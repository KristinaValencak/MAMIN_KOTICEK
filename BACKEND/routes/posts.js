const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const { tryVerifyAccessToken } = require("../utils/jwtAccess");
const {
    createPostUserLimiter,
    postCommentUserLimiter,
    userContentReportLimiter,
} = require("../middleware/rateLimiters");
const spamGuards = require("../services/spamGuards");
const { createNotification } = require("../services/notifications/notificationWriter");
const requireCleanContent = require("../middleware/requireCleanContent");
const emailService = require("../services/emailService");
const { canViewHiddenContent } = require("../services/permissions");
const { parseViewerUserId, loadPostIfReadable } = require("../services/contentVisibility");
const {
    recordUserReport,
    DUPLICATE_ACTIVE_REPORT_CODE,
    DUPLICATE_ACTIVE_REPORT_MESSAGE,
} = require("../services/contentReports");
const { getAppealEligibilityForTarget } = require("../services/appealLimits");
const L = require("../constants/inputLimits");
const { rejectIfStringTooLong } = require("../utils/rejectIfStringTooLong");
const { anonParticipantLabelExpr } = require("../utils/anonymousParticipantLabel");
const { CITY_OPTIONS, isAllowedCity, normalizeCityOrNull } = require("../constants/cities");
const { getCategoryTags, validateTagsForCategorySlug } = require("../constants/categoryTags");
const { GROUP_OPTIONS, isAllowedGroupKey, normalizeGroupKeyOrNull } = require("../constants/groups");

const TAGS_MAX = 15;
const TAG_MAX_LEN = 40;

function isSafePublicId(v) {
    if (typeof v !== "string") return false;
    const s = v.trim();
    if (s.length < 1 || s.length > 300) return false;
    // Allow Cloudinary folder paths (/) and typical safe chars.
    return /^[a-zA-Z0-9/_-]+$/.test(s);
}

function normalizeTags(tagsInput) {
    if (!Array.isArray(tagsInput)) return [];
    const out = [];
    const seen = new Set();
    for (const t of tagsInput) {
        const s = String(t ?? "").trim().toLowerCase();
        if (!s) continue;
        if (s.length > TAG_MAX_LEN) {
            out.push(s);
            continue;
        }
        if (seen.has(s)) continue;
        seen.add(s);
        out.push(s);
    }
    return out;
}

function normalizeCity(cityInput) {
    return normalizeCityOrNull(cityInput);
}

function isValidCloudinaryUrl(urlStr) {
    if (typeof urlStr !== "string") return false;
    const s = urlStr.trim();
    if (s.length < 10 || s.length > 4000) return false;

    let u;
    try {
        u = new URL(s);
    } catch {
        return false;
    }
    if (u.protocol !== "https:") return false;
    if (u.hostname !== "res.cloudinary.com") return false;

    const cloudName = (process.env.CLOUDINARY_CLOUD_NAME || "").trim();
    if (cloudName) {
        // Path format: /<cloudName>/image/upload/...
        if (!u.pathname.startsWith(`/${cloudName}/`)) return false;
    }

    if (!u.pathname.includes("/image/upload/")) return false;

    return true;
}

function normalizeOptionalImageFields(body) {
    const imageUrl = body?.imageUrl === null || body?.imageUrl === undefined ? null : String(body.imageUrl).trim();
    const imagePublicId = body?.imagePublicId === null || body?.imagePublicId === undefined ? null : String(body.imagePublicId).trim();
    return { imageUrl: imageUrl || null, imagePublicId: imagePublicId || null };
}

function requiredPostsPublicIdPrefix() {
    const folder = (process.env.CLOUDINARY_POSTS_FOLDER || "posts").trim();
    if (!folder) return "posts/";
    return folder.endsWith("/") ? folder : `${folder}/`;
}

router.get("/", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);
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

        const sortRaw = (req.query.sort || "").toString().toLowerCase();
        const sortTop = sortRaw === "top";
        const orderBy = sortTop
            ? `ORDER BY (COALESCE(like_counts.like_count, 0) + COALESCE(comment_counts.comment_count, 0)) DESC,
                    p.created_at DESC`
            : `ORDER BY p.created_at DESC`;

        const categorySlug = String(req.query.category || "").trim() || null;
        const feedRaw = String(req.query.feed || "").trim().toLowerCase();
        const feedFriends = feedRaw === "friends";

        const tagRaw = String(req.query.tag || "").trim();
        const tagNorm = tagRaw ? tagRaw.toLowerCase() : null;

        const cityQueryRaw = req.query.city;
        if (!isAllowedCity(cityQueryRaw)) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                `Neveljavno mesto. Dovoljena mesta: ${CITY_OPTIONS.join(", ")} ali \"Brez lokacije\".`
            );
        }
        const cityNorm = normalizeCity(cityQueryRaw);

        const groupQueryRaw = req.query.group;
        if (!isAllowedGroupKey(groupQueryRaw)) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                `Neveljavna skupina. Dovoljene skupine: ${GROUP_OPTIONS.map((g) => g.label).join(", ")}.`
            );
        }
        const groupKeyNorm = normalizeGroupKeyOrNull(groupQueryRaw);

        if (categorySlug && tagNorm) {
            const allowed = new Set(getCategoryTags(categorySlug).map((t) => String(t).trim().toLowerCase()));
            if (!allowed.has(tagNorm)) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven tag za izbrano kategorijo.");
            }
        }

        if (feedFriends && !userId) {
            return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Za objave prijateljic se morate prijaviti.");
        }

        const q = `
        SELECT p.id,
              p.title,
              p.content,
              p.image_url AS "imageUrl",
              p.image_public_id AS "imagePublicId",
              p.city AS city,
              p.tags AS tags,
              p.group_key AS "groupKey",
              p.created_at AS "createdAt",
              p.is_featured AS "isFeatured",
              p.is_hidden AS "isHidden",
              p.is_anonymous AS "isAnonymous",
              CASE
                WHEN p.is_anonymous = true AND ($3::bigint IS DISTINCT FROM p.user_id) THEN NULL
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
       COALESCE(comment_counts.comment_count, 0) AS "commentCount",
       COALESCE(
         (
           SELECT jsonb_build_object(
             'support', COALESCE(SUM(CASE WHEN psr.reaction_type = 'support' THEN 1 ELSE 0 END), 0)::int,
             'hug', COALESCE(SUM(CASE WHEN psr.reaction_type = 'hug' THEN 1 ELSE 0 END), 0)::int,
             'understand', COALESCE(SUM(CASE WHEN psr.reaction_type = 'understand' THEN 1 ELSE 0 END), 0)::int,
             'together', COALESCE(SUM(CASE WHEN psr.reaction_type = 'together' THEN 1 ELSE 0 END), 0)::int
           )
           FROM post_support_reactions psr
           WHERE psr.post_id = p.id
         ),
         '{"support":0,"hug":0,"understand":0,"together":0}'::jsonb
       ) AS "supportCounts",
       CASE
         WHEN $3::bigint IS NULL THEN NULL
         ELSE (
           SELECT psr_m.reaction_type
           FROM post_support_reactions psr_m
           WHERE psr_m.post_id = p.id AND psr_m.user_id = $3
           LIMIT 1
         )
       END AS "mySupportReaction"
  FROM posts p
  JOIN users u      ON u.id = p.user_id
  LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN (
          SELECT post_id, COUNT(*)::int AS like_count
          FROM post_likes
          GROUP BY post_id
        ) like_counts ON like_counts.post_id = p.id
        LEFT JOIN (
          SELECT post_id
          FROM post_likes
          WHERE user_id = $3
        ) user_likes ON user_likes.post_id = p.id
        LEFT JOIN (
          SELECT post_id
          FROM post_favorites
          WHERE user_id = $3
        ) user_favs ON user_favs.post_id = p.id
        LEFT JOIN (
          SELECT post_id, COUNT(*)::int AS comment_count
          FROM comments
          WHERE is_hidden = false
            AND status <> 'deleted'
            AND deleted_at IS NULL
          GROUP BY post_id
        ) comment_counts ON comment_counts.post_id = p.id
        WHERE p.status <> 'deleted'
          AND p.deleted_at IS NULL
          -- Friends feed is stricter: never show anonymous posts.
          AND ($9::boolean = false OR p.is_anonymous = false)
          AND (
            $9::boolean = false
            OR (
              $3::bigint IS NOT NULL
              AND p.user_id <> $3
              AND EXISTS (
                SELECT 1 FROM friends f
                WHERE (f.user_id_1 = $3 AND f.user_id_2 = p.user_id)
                   OR (f.user_id_1 = p.user_id AND f.user_id_2 = $3)
              )
            )
          )
          -- Hidden content should not appear in the public feed.
          -- Author can still see their own hidden post; moderators/admins may view hidden when permitted.
          AND (
            ($9::boolean = true AND p.is_hidden = false)
            OR ($9::boolean = false AND (p.is_hidden = false OR ($4::boolean = true) OR (p.user_id = $3 AND $3 IS NOT NULL)))
          )
          AND (
            $3::bigint IS NULL
            OR NOT EXISTS (
              SELECT 1 FROM user_blocks ub
              WHERE (ub.blocker_id = $3 AND ub.blocked_id = p.user_id)
                 OR (ub.blocker_id = p.user_id AND ub.blocked_id = $3)
            )
          )
          AND ($5::text IS NULL OR c.slug = $5)
          AND ($6::text IS NULL OR $6 = ANY (p.tags))
          AND ($7::text IS NULL OR p.city = $7)
          AND ($8::text IS NULL OR p.group_key = $8)
        ${orderBy}
        LIMIT $1 OFFSET $2
      `;
        const { rows } = await db.query(q, [limit, offset, userId || null, canViewHidden, categorySlug, tagNorm, cityNorm, groupKeyNorm, feedFriends]);
        res.json({ items: rows, pagination: { limit, offset } });
    } catch (err) {
        console.error("Napaka /api/posts:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju objav");
    }
});

router.post("/", requireAuth, createPostUserLimiter, requireCleanContent("title", "content"), async (req, res) => {
    try {
        const userId = Number(req.user?.id);
        if (!Number.isFinite(userId) || !Number.isInteger(userId) || userId < 1) {
            return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik.");
        }

        const { title, content, categoryId, isAnonymous } = req.body;
        const { imageUrl, imagePublicId } = normalizeOptionalImageFields(req.body);
        const tags = normalizeTags(req.body?.tags);
        const cityRaw = req.body?.city;
        if (!isAllowedCity(cityRaw)) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                `Neveljavno mesto. Dovoljena mesta: ${CITY_OPTIONS.join(", ")} ali \"Brez lokacije\".`
            );
        }
        const city = normalizeCity(cityRaw);

        const groupKeyRaw = req.body?.groupKey;
        if (!isAllowedGroupKey(groupKeyRaw)) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                `Neveljavna skupina. Dovoljene skupine: ${GROUP_OPTIONS.map((g) => g.label).join(", ")}.`
            );
        }
        const groupKey = normalizeGroupKeyOrNull(groupKeyRaw);

        if (!title?.trim() || !content?.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Naslov in vsebina sta obvezna.");
        }
        if (rejectIfStringTooLong(res, title.trim(), L.POST_TITLE, "Naslov", { useMessageKey: true })) return;
        if (rejectIfStringTooLong(res, content.trim(), L.POST_BODY, "Vsebina", { useMessageKey: true })) return;
        if ((imageUrl && !imagePublicId) || (!imageUrl && imagePublicId)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Če dodate sliko, sta obvezna imageUrl in imagePublicId.");
        }
        if (imageUrl) {
            if (!isValidCloudinaryUrl(imageUrl)) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imageUrl (mora biti Cloudinary image URL).");
            }
            if (!isSafePublicId(imagePublicId)) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imagePublicId.");
            }
            const prefix = requiredPostsPublicIdPrefix();
            if (!String(imagePublicId).startsWith(prefix)) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven imagePublicId (napačen folder).");
            }
        }

        if (tags.length > TAGS_MAX) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, `Preveč tagov (max ${TAGS_MAX}).`);
        }
        if (tags.some(t => t.length > TAG_MAX_LEN)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, `Tag je predolg (max ${TAG_MAX_LEN} znakov).`);
        }

        let catId = null;
        let catSlug = null;
        if (categoryId !== undefined && categoryId !== null && categoryId !== "") {
            const c = await db.query("SELECT id, slug FROM categories WHERE id=$1", [categoryId]);
            if (c.rowCount === 0) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna kategorija.");
            }
            catId = Number(categoryId);
            catSlug = c.rows[0].slug;
        }

        if (!catSlug) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Izberi kategorijo.");
        }

        if (!validateTagsForCategorySlug(tags, catSlug)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavni tagi za izbrano kategorijo.");
        }

        try {
            await spamGuards.assertPostSpamOk(db, userId, title.trim(), content.trim());
        } catch (spamErr) {
            return spamGuards.sendSpamError(res, spamErr);
        }

        const ins = await db.query(
            `INSERT INTO posts (title, content, category_id, user_id, is_anonymous, image_url, image_public_id, city, tags, group_key)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             RETURNING id, title, content,
                       image_url   AS "imageUrl",
                       image_public_id AS "imagePublicId",
                       category_id AS "categoryId",
                       city AS city,
                       tags AS tags,
                       group_key AS "groupKey",
                       user_id     AS "userId",
                       created_at  AS "createdAt",
                       is_anonymous AS "isAnonymous"`,
            [title.trim(), content.trim(), catId, userId, isAnonymous === true, imageUrl, imagePublicId, city, tags, groupKey]
        );

        return res.status(201).json(ins.rows[0]);
    } catch (err) {
        console.error("Napaka /api/posts POST:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Strežniška napaka.");
    }
});

router.get("/featured", async (req, res) => {
    try {
        const viewerUserId = await parseViewerUserId(req);
        const { rows } = await db.query(
            `SELECT p.id,
                p.title,
                p.content,
                p.image_url AS "imageUrl",
                p.image_public_id AS "imagePublicId",
                p.city AS city,
                p.tags AS tags,
                p.group_key AS "groupKey",
                p.created_at AS "createdAt",
                p.is_featured AS "isFeatured",
                p.is_anonymous AS "isAnonymous",
                CASE
                  WHEN p.is_anonymous = true AND ($1::bigint IS DISTINCT FROM p.user_id) THEN NULL
                  ELSE u.id
                END AS "userId",
                CASE
                  WHEN p.is_anonymous = true THEN ${anonParticipantLabelExpr("p.id", "u.id")}
                  ELSE u.username
                END AS author,
                CASE WHEN p.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl"
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.is_featured = TRUE
               AND p.is_hidden = false
               AND p.status <> 'deleted'
               AND p.deleted_at IS NULL
               AND (
                 $1::bigint IS NULL
                 OR NOT EXISTS (
                   SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $1 AND ub.blocked_id = p.user_id)
                      OR (ub.blocker_id = p.user_id AND ub.blocked_id = $1)
                 )
               )
             ORDER BY p.created_at DESC
             LIMIT 1`,
            [viewerUserId]
        );

        if (rows.length === 0) {
            return res.json({ post: null, type: null });
        }

        res.json({ post: rows[0], type: "post" });
    } catch (err) {
        console.error("Napaka /api/posts/featured:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju featured objave");
    }
});

router.post("/:id/favorite", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        const row = await loadPostIfReadable(id, userId);
        if (!row) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
        }
        await db.query(
            `INSERT INTO post_favorites (user_id, post_id) VALUES ($1, $2)
             ON CONFLICT (user_id, post_id) DO NOTHING`,
            [userId, id]
        );
        res.json({ favorited: true });
    } catch (err) {
        console.error("Napaka /api/posts/:id/favorite POST:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju priljubljene objave");
    }
});

router.delete("/:id/favorite", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;
        await db.query(`DELETE FROM post_favorites WHERE user_id = $1 AND post_id = $2`, [userId, id]);
        res.json({ favorited: false });
    } catch (err) {
        console.error("Napaka /api/posts/:id/favorite DELETE:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri odstranjevanju priljubljene objave");
    }
});

router.get("/:id", async (req, res) => {
    const { id } = req.params;
    const viewerUserId = await parseViewerUserId(req);
    const canViewHidden = viewerUserId ? await canViewHiddenContent(viewerUserId) : false;
        const { rows } = await db.query(
            `SELECT 
        p.id,
        p.title,
        p.content,
        p.image_url AS "imageUrl",
        p.image_public_id AS "imagePublicId",
        p.city AS city,
        p.tags AS tags,
        p.group_key AS "groupKey",
        p.created_at AS "createdAt",
        p.is_featured AS "isFeatured",
        p.is_hidden AS "isHidden",
        p.is_anonymous AS "isAnonymous",
        CASE
          WHEN p.is_anonymous = true AND ($2::bigint IS DISTINCT FROM p.user_id) THEN NULL
          ELSE u.id
        END AS "userId",
        CASE
          WHEN p.is_anonymous = true THEN ${anonParticipantLabelExpr("p.id", "u.id")}
          ELSE u.username
        END AS author,
        CASE WHEN p.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl",
            json_build_object('id', c.id, 'name', c.name, 'slug', c.slug) AS category,
            CASE
              WHEN $2::bigint IS NULL THEN false
              ELSE EXISTS (
                SELECT 1 FROM post_favorites f
                WHERE f.post_id = p.id AND f.user_id = $2
              )
            END AS "isFavorited",
        COALESCE(post_like_counts.cnt, 0) AS "likeCount",
        CASE WHEN post_user_like.post_id IS NOT NULL THEN true ELSE false END AS "isLiked",
        COALESCE(
          (
            SELECT jsonb_build_object(
              'support', COALESCE(SUM(CASE WHEN psr.reaction_type = 'support' THEN 1 ELSE 0 END), 0)::int,
              'hug', COALESCE(SUM(CASE WHEN psr.reaction_type = 'hug' THEN 1 ELSE 0 END), 0)::int,
              'understand', COALESCE(SUM(CASE WHEN psr.reaction_type = 'understand' THEN 1 ELSE 0 END), 0)::int,
              'together', COALESCE(SUM(CASE WHEN psr.reaction_type = 'together' THEN 1 ELSE 0 END), 0)::int
            )
            FROM post_support_reactions psr
            WHERE psr.post_id = p.id
          ),
          '{"support":0,"hug":0,"understand":0,"together":0}'::jsonb
        ) AS "supportCounts",
        CASE
          WHEN $2::bigint IS NULL THEN NULL
          ELSE (
            SELECT psr_m.reaction_type
            FROM post_support_reactions psr_m
            WHERE psr_m.post_id = p.id AND psr_m.user_id = $2
            LIMIT 1
          )
        END AS "mySupportReaction"
       FROM posts p
       LEFT JOIN users u ON u.id = p.user_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN (
         SELECT post_id, COUNT(*)::int AS cnt
         FROM post_likes
         GROUP BY post_id
       ) post_like_counts ON post_like_counts.post_id = p.id
       LEFT JOIN (
         SELECT post_id
         FROM post_likes
         WHERE user_id = $2
       ) post_user_like ON post_user_like.post_id = p.id
       WHERE p.id = $1
         AND p.status <> 'deleted'
         AND p.deleted_at IS NULL
         AND (
           p.is_hidden = false
           OR ($2::bigint IS NOT NULL AND p.user_id = $2)
           OR $3 = true
         )
         AND (
           $2::bigint IS NULL
           OR NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $2 AND ub.blocked_id = p.user_id)
                OR (ub.blocker_id = p.user_id AND ub.blocked_id = $2)
           )
         )`,
        [id, viewerUserId, canViewHidden]
    );
    if (!rows[0]) return sendJsonError(res, 404, CODES.NOT_FOUND, "Not found");
    const r = rows[0];
    const payload = {
        id: r.id,
        title: r.title,
        content: r.content,
        imageUrl: r.imageUrl || null,
        imagePublicId: r.imagePublicId || null,
        city: r.city || null,
        tags: Array.isArray(r.tags) ? r.tags : [],
        groupKey: r.groupKey || null,
        createdAt: r.createdAt,
        isFeatured: r.isFeatured || false,
        isHidden: Boolean(r.isHidden),
        isAnonymous: Boolean(r.isAnonymous),
        userId: r.userId,
        author: r.author,
        authorAvatarUrl: r.authorAvatarUrl || null,
        category: r.category,
        isFavorited: Boolean(r.isFavorited),
        likeCount: Number(r.likeCount) || 0,
        isLiked: Boolean(r.isLiked),
        supportCounts: r.supportCounts || null,
        mySupportReaction: r.mySupportReaction || null,
        appealPending: false,
        appealLastOutcome: null,
        appealAllowed: true,
        appealBlockReason: null,
    };
    if (
        viewerUserId != null &&
        r.userId != null &&
        Number(viewerUserId) === Number(r.userId)
    ) {
        const ap = await db.query(
            `SELECT 1 FROM moderation_appeals
             WHERE target_type = 'post' AND target_id = $1 AND status = 'pending' LIMIT 1`,
            [id]
        );
        payload.appealPending = ap.rowCount > 0;
        if (!payload.appealPending) {
            const last = await db.query(
                `SELECT status FROM moderation_appeals
                 WHERE target_type = 'post' AND target_id = $1
                   AND status IN ('resolved_upheld', 'resolved_reversed')
                 ORDER BY COALESCE(resolved_at, created_at) DESC, id DESC
                 LIMIT 1`,
                [id]
            );
            if (last.rowCount > 0) {
                payload.appealLastOutcome =
                    last.rows[0].status === "resolved_upheld" ? "upheld" : "reversed";
            }
        }
        const elig = await getAppealEligibilityForTarget("post", id);
        payload.appealAllowed = !payload.appealPending && elig.canAppeal;
        payload.appealBlockReason = payload.appealPending ? null : elig.appealBlockReason;
    }
    res.json(payload);
});

router.delete("/:id", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const check = await db.query(
            "SELECT user_id FROM posts WHERE id = $1",
            [id]
        );

        if (check.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
        }

        const userCheck = await db.query(
            "SELECT is_admin FROM users WHERE id = $1",
            [userId]
        );
        const isAdmin = userCheck.rows.length > 0 && userCheck.rows[0].is_admin;

        if (check.rows[0].user_id !== userId && !isAdmin) {
            return sendJsonError(res, 403, CODES.FORBIDDEN, "Nimate dovoljenja za brisanje te objave");
        }

        const client = await db.connect();
        try {
            await client.query("BEGIN");
            await client.query(
                `UPDATE posts
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = $3,
                     deleted_reason = $4
                 WHERE id = $1`,
                [id, userId, isAdmin ? "admin" : "user", isAdmin ? "admin_delete" : "self_delete"]
            );
            await client.query(
                `UPDATE comments
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = $3,
                     deleted_reason = $4
                 WHERE post_id = $1`,
                [id, userId, isAdmin ? "admin" : "user", isAdmin ? "admin_delete" : "self_delete"]
            );
            await client.query(
                `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
                 VALUES ('post', $1, 'deleted', $2, $3, $4, '{}'::jsonb)`,
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

        res.json({ message: "Objava je bila izbrisana" });
    } catch (err) {
        console.error("Napaka /api/posts/:id DELETE:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju objave");
    }
});

router.get("/:id/likes", async (req, res) => {
    try {
        const { id } = req.params;
        const auth = req.headers["authorization"];
        const cookieToken = req.cookies?.token;
        let userId = null;

        const bearer = auth ? auth.split(" ")[1] : null;
        const token = cookieToken || bearer;
        if (token) {
            const payload = tryVerifyAccessToken(token);
            if (payload) userId = payload.id;
        }

        const readable = await loadPostIfReadable(id, userId);
        if (!readable) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
        }

        const countRes = await db.query(
            "SELECT COUNT(*)::int AS count FROM post_likes WHERE post_id = $1",
            [id]
        );
        const likeCount = countRes.rows[0].count;

        let isLiked = false;
        if (userId) {
            const likeRes = await db.query(
                "SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2",
                [id, userId]
            );
            isLiked = likeRes.rowCount > 0;
        }

        res.json({
            count: likeCount,
            isLiked: isLiked
        });
    } catch (err) {
        console.error("Napaka /api/posts/:id/likes:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju lajkov");
    }
});

router.post("/:id/likes", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user.id;

        const postRow = await loadPostIfReadable(id, userId);
        if (!postRow) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
        }

        const postOwnerId = postRow.user_id;

        const existing = await db.query(
            "SELECT id FROM post_likes WHERE post_id = $1 AND user_id = $2",
            [id, userId]
        );

        if (existing.rowCount > 0) {
            await db.query(
                "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
                [id, userId]
            );
            try {
                await db.query(
                    `DELETE FROM notifications
                     WHERE user_id = $1 AND type::text = 'like' AND post_id = $2 AND actor_id = $3`,
                    [postOwnerId, id, userId]
                );
            } catch (notifErr) {
                console.error("Napaka pri brisanju notifikacije (odlajk):", notifErr);
            }
            res.json({ action: "unliked", message: "Lajk odstranjen" });
        } else {
            await db.query(
                "DELETE FROM post_support_reactions WHERE post_id = $1 AND user_id = $2",
                [id, userId]
            );
            await db.query(
                "INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2)",
                [id, userId]
            );
            if (postOwnerId !== userId) {
                try {
                    await createNotification({
                        recipientUserId: postOwnerId,
                        actorUserId: userId,
                        type: "like",
                        postId: Number(id),
                    });
                } catch (notifErr) {
                    console.error("Napaka pri ustvarjanju notifikacije (lajk):", notifErr);
                }
            }
            res.json({ action: "liked", message: "Objava lajkana" });
        }
    } catch (err) {
        console.error("Napaka /api/posts/:id/likes POST:", err);
        if (err.code === '23505') {
            return sendJsonError(res, 409, CODES.CONFLICT, "Objava je že lajkana");
        }
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri lajkanju");
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

async function getPostSupportSummary(postId, userIdOrNull) {
    const countsRes = await db.query(
        `SELECT reaction_type, COUNT(*)::int AS count
         FROM post_support_reactions
         WHERE post_id = $1
         GROUP BY reaction_type`,
        [postId]
    );
    const counts = emptySupportCounts();
    countsRes.rows.forEach(r => {
        if (counts[r.reaction_type] !== undefined) counts[r.reaction_type] = r.count;
    });

    let myReaction = null;
    if (userIdOrNull) {
        const myRes = await db.query(
            `SELECT reaction_type
             FROM post_support_reactions
             WHERE post_id = $1 AND user_id = $2`,
            [postId, userIdOrNull]
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
                  psr.reaction_type AS "reactionType",
                  psr.created_at
           FROM post_support_reactions psr
           JOIN users u ON u.id = psr.user_id
           WHERE psr.post_id = $1
             AND (
               $2::bigint IS NULL
               OR NOT EXISTS (
                 SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $2 AND ub.blocked_id = u.id)
                    OR (ub.blocker_id = u.id AND ub.blocked_id = $2)
               )
             )
           UNION ALL
           SELECT u.id,
                  u.username,
                  u.avatar_url,
                  'like'::text,
                  NULL::text,
                  pl.created_at
           FROM post_likes pl
           JOIN users u ON u.id = pl.user_id
           WHERE pl.post_id = $1
             AND (
               $2::bigint IS NULL
               OR NOT EXISTS (
                 SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $2 AND ub.blocked_id = u.id)
                    OR (ub.blocker_id = u.id AND ub.blocked_id = $2)
               )
             )
         ) combined
         ORDER BY combined.created_at DESC`,
        [postId, userIdOrNull]
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
        const postId = parseInt(id, 10);
        if (!Number.isFinite(postId)) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven id");

        const auth = req.headers["authorization"];
        const cookieToken = req.cookies?.token;
        let userId = null;
        const bearer = auth ? auth.split(" ")[1] : null;
        const token = cookieToken || bearer;
        if (token) {
            const payload = tryVerifyAccessToken(token);
            if (payload) userId = payload.id;
        }

        const readable = await loadPostIfReadable(postId, userId);
        if (!readable) return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");

        const summary = await getPostSupportSummary(postId, userId || null);
        res.json(summary);
    } catch (err) {
        console.error("Napaka /api/posts/:id/support:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju podpore");
    }
});

router.post("/:id/support", requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        const postId = parseInt(id, 10);
        if (!Number.isFinite(postId)) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven id");
        const userId = req.user.id;

        const reactionType = normalizeReactionType(req.body?.reactionType);
        if (!reactionType) return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven reactionType");

        const readable = await loadPostIfReadable(postId, userId);
        if (!readable) return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");

        await db.query(
            "DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2",
            [postId, userId]
        );

        const existing = await db.query(
            `SELECT reaction_type
             FROM post_support_reactions
             WHERE post_id = $1 AND user_id = $2`,
            [postId, userId]
        );

        let action = "added";
        let myReaction = reactionType;

        if (existing.rowCount === 0) {
            await db.query(
                `INSERT INTO post_support_reactions (post_id, user_id, reaction_type)
                 VALUES ($1, $2, $3)`,
                [postId, userId, reactionType]
            );
            action = "added";
        } else if (existing.rows[0].reaction_type === reactionType) {
            await db.query(
                `DELETE FROM post_support_reactions
                 WHERE post_id = $1 AND user_id = $2`,
                [postId, userId]
            );
            action = "removed";
            myReaction = null;
        } else {
            await db.query(
                `UPDATE post_support_reactions
                 SET reaction_type = $3, created_at = NOW()
                 WHERE post_id = $1 AND user_id = $2`,
                [postId, userId, reactionType]
            );
            action = "replaced";
        }

        // Notify post author about support reactions (💗/🤗/🌸/🥰), excluding self.
        // Only when a reaction is present (added/replaced), not when removed.
        if ((action === "added" || action === "replaced") && readable.user_id != null && Number(readable.user_id) !== Number(userId)) {
            try {
                await createNotification({
                    recipientUserId: Number(readable.user_id),
                    actorUserId: Number(userId),
                    type: "support_react",
                    postId: Number(postId),
                    metadata: { reactionType, kind: "post" },
                });
            } catch (notifErr) {
                console.error("Napaka pri ustvarjanju notifikacije (support_react post):", notifErr);
            }
        }

        const summary = await getPostSupportSummary(postId, userId);
        res.json({ action, myReaction: summary.myReaction, counts: summary.counts });
    } catch (err) {
        console.error("Napaka /api/posts/:id/support POST:", err);
        if (err.code === "23505") return sendJsonError(res, 409, CODES.CONFLICT, "Reakcija že obstaja");
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri podpori");
    }
});

router.get("/:id/comments", async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || "50", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);
        const { id } = req.params;

        let userId = null;
        const auth = req.headers["authorization"];
        const cookieToken = req.cookies?.token;
        const bearer = auth ? auth.split(" ")[1] : null;
        const token = cookieToken || bearer;
        if (token) {
            const payload = tryVerifyAccessToken(token);
            if (payload) userId = payload.id;
        }

        const canViewHidden = userId ? await canViewHiddenContent(userId) : false;

        const postCheck = await db.query(
            `SELECT p.id FROM posts p
             WHERE p.id = $1
               AND (
                 p.is_hidden = false
                 OR ($2::bigint IS NOT NULL AND p.user_id = $2)
                 OR $3 = true
               )
               AND (
                 $2::bigint IS NULL
                 OR NOT EXISTS (
                   SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $2 AND ub.blocked_id = p.user_id)
                      OR (ub.blocker_id = p.user_id AND ub.blocked_id = $2)
                 )
               )`,
            [id, userId, canViewHidden]
        );
        if (postCheck.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
        }

        const { rows } = await db.query(
            `SELECT c.id,
                c.content,
                c.created_at AS "createdAt",
                c.is_featured AS "isFeatured",
                c.parent_comment_id AS "parentCommentId",
                CASE 
                  WHEN c.is_anonymous = true THEN NULL
                  ELSE u.id
                END AS "userId",
                CASE
                  WHEN c.is_anonymous = true THEN ${anonParticipantLabelExpr("c.post_id", "u.id")}
                  ELSE u.username
                END AS username,
                CASE WHEN c.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "userAvatarUrl",
                COALESCE(like_counts.like_count, 0) AS "likeCount",
                CASE WHEN user_likes.comment_id IS NOT NULL THEN true ELSE false END AS "isLiked",
                COALESCE(
                  (
                    SELECT jsonb_build_object(
                      'support', COALESCE(SUM(CASE WHEN csr.reaction_type = 'support' THEN 1 ELSE 0 END), 0)::int,
                      'hug', COALESCE(SUM(CASE WHEN csr.reaction_type = 'hug' THEN 1 ELSE 0 END), 0)::int,
                      'understand', COALESCE(SUM(CASE WHEN csr.reaction_type = 'understand' THEN 1 ELSE 0 END), 0)::int,
                      'together', COALESCE(SUM(CASE WHEN csr.reaction_type = 'together' THEN 1 ELSE 0 END), 0)::int
                    )
                    FROM comment_support_reactions csr
                    WHERE csr.comment_id = c.id
                  ),
                  '{"support":0,"hug":0,"understand":0,"together":0}'::jsonb
                ) AS "supportCounts",
                CASE
                  WHEN $5::bigint IS NULL THEN NULL
                  ELSE (
                    SELECT csr_m.reaction_type
                    FROM comment_support_reactions csr_m
                    WHERE csr_m.comment_id = c.id AND csr_m.user_id = $5
                    LIMIT 1
                  )
                END AS "mySupportReaction",
                ($5::bigint IS NOT NULL AND c.user_id = $5) AS "viewerIsAuthor",
                c.is_hidden AS "isHidden",
                CASE
                  WHEN $5::bigint IS NOT NULL AND c.user_id = $5 THEN EXISTS (
                    SELECT 1 FROM moderation_appeals ma
                    WHERE ma.target_type = 'comment' AND ma.target_id = c.id AND ma.status = 'pending'
                  )
                  ELSE false
                END AS "appealPending"
             FROM comments c
             JOIN users u ON u.id = c.user_id
             LEFT JOIN (
               SELECT comment_id, COUNT(*)::int AS like_count
               FROM comment_likes
               GROUP BY comment_id
             ) like_counts ON like_counts.comment_id = c.id
             LEFT JOIN (
               SELECT comment_id
               FROM comment_likes
               WHERE user_id = $4
             ) user_likes ON user_likes.comment_id = c.id
             WHERE c.post_id = $1
               AND (
                 c.is_hidden = false
                 OR ($5::bigint IS NOT NULL AND c.user_id = $5)
                 OR $6 = true
               )
               AND (
                 $5::bigint IS NULL
                 OR NOT EXISTS (
                   SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $5 AND ub.blocked_id = c.user_id)
                      OR (ub.blocker_id = c.user_id AND ub.blocked_id = $5)
                 )
               )
             ORDER BY 
               CASE WHEN c.parent_comment_id IS NULL THEN 0 ELSE 1 END,
               c.created_at ASC
             LIMIT $2 OFFSET $3`,
            [id, limit, offset, userId || 0, userId, canViewHidden]
        );

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS count FROM comments c
             WHERE c.post_id = $1
               AND (
                 c.is_hidden = false
                 OR ($2::bigint IS NOT NULL AND c.user_id = $2)
                 OR $3 = true
               )
               AND (
                 $2::bigint IS NULL
                 OR NOT EXISTS (
                   SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $2 AND ub.blocked_id = c.user_id)
                      OR (ub.blocker_id = c.user_id AND ub.blocked_id = $2)
                 )
               )`,
            [id, userId, canViewHidden]
        );

        res.json({
            items: rows.map(r => ({
                id: r.id,
                content: r.content,
                createdAt: r.createdAt,
                isFeatured: r.isFeatured || false,
                parentCommentId: r.parentCommentId || null,
                likeCount: r.likeCount || 0,
                isLiked: r.isLiked || false,
                supportCounts: r.supportCounts || null,
                mySupportReaction: r.mySupportReaction || null,
                user: {
                    id: r.userId || null,
                    username: r.username,
                    avatarUrl: r.userAvatarUrl || null
                },
                viewerIsAuthor: Boolean(r.viewerIsAuthor),
                isHidden: Boolean(r.isHidden),
                appealPending: Boolean(r.appealPending)
            })),
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count
            }
        });
    } catch (err) {
        console.error("Napaka /api/posts/:id/comments:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju komentarjev");
    }
});

router.post("/:id/comments", requireAuth, postCommentUserLimiter, requireCleanContent("content"), async (req, res) => {
    const { id } = req.params;
    const userId = req.user.id;
    const { content, isAnonymous } = req.body;

    if (!content?.trim()) {
        return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Vsebina je obvezna");
    }
    if (rejectIfStringTooLong(res, content.trim(), L.COMMENT, "Komentar")) return;

    const postRow = await loadPostIfReadable(id, userId);
    if (!postRow) {
        return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
    }

    try {
        await spamGuards.assertCommentSpamOk(db, userId, Number(id), null, content.trim());
    } catch (spamErr) {
        return spamGuards.sendSpamError(res, spamErr);
    }

    const anonRetLabel = anonParticipantLabelExpr("post_id", "user_id");
    const { rows } = await db.query(
        `INSERT INTO comments (post_id, user_id, content, is_anonymous)
       VALUES ($1, $2, $3, $4)
       RETURNING id, content, created_at AS "createdAt", is_anonymous AS "isAnonymous",
         (CASE WHEN is_anonymous THEN ${anonRetLabel} ELSE NULL END) AS "anonDisplayName"`,
        [id, userId, content.trim(), isAnonymous === true]
    );

    const newCommentId = Number(rows?.[0]?.id);
    if (postRow.user_id !== userId) {
        try {
            await createNotification({
                recipientUserId: postRow.user_id,
                actorUserId: userId,
                type: "comment",
                postId: Number(id),
                commentId: Number.isFinite(newCommentId) ? newCommentId : null,
            });
        } catch (notifErr) {
            console.error("Napaka pri ustvarjanju notifikacije:", notifErr);
        }
    }

    let avatarUrl = null;
    if (isAnonymous !== true) {
        const av = await db.query("SELECT avatar_url FROM users WHERE id = $1", [userId]);
        avatarUrl = av.rows[0]?.avatar_url || null;
    }

    res.status(201).json({
        id: rows[0].id,
        content: rows[0].content,
        createdAt: rows[0].createdAt,
        isFeatured: false,
        parentCommentId: null,
        likeCount: 0,
        isLiked: false,
        supportCounts: { support: 0, hug: 0, understand: 0, together: 0 },
        mySupportReaction: null,
        user: {
            id: userId,
            username: isAnonymous === true ? rows[0].anonDisplayName : req.user.username,
            avatarUrl
        },
        viewerIsAuthor: true,
        isHidden: false,
        appealPending: false
    });
});

router.post("/:id/report", requireAuth, userContentReportLimiter, async (req, res) => {
    try {
        const postId = parseInt(req.params.id);
        const { reason, postTitle, postAuthor } = req.body;

        if (!reason || !reason.trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Razlog prijave je obvezen.");
        }
        if (rejectIfStringTooLong(res, reason.trim(), L.REPORT_REASON, "Razlog prijave")) return;
        if (postTitle != null && postTitle !== "" && rejectIfStringTooLong(res, String(postTitle), L.POST_TITLE, "Naslov objave")) return;
        if (postAuthor != null && postAuthor !== "" && rejectIfStringTooLong(res, String(postAuthor), L.USERNAME_MAX * 2, "Avtor")) return;

        const postCheck = await db.query("SELECT id, title, user_id FROM posts WHERE id = $1", [postId]);
        if (postCheck.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja.");
        }
        if (Number(postCheck.rows[0].user_id) === Number(req.user.id)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Svoje objave ne morete prijaviti.");
        }

        try {
            await recordUserReport({
                reporterUserId: req.user.id,
                targetType: "post",
                targetId: postId,
                reason: reason.trim(),
            });
        } catch (dbErr) {
            if (dbErr.code === DUPLICATE_ACTIVE_REPORT_CODE) {
                return sendJsonError(res, 409, CODES.CONFLICT, DUPLICATE_ACTIVE_REPORT_MESSAGE);
            }
            console.error("content_reports (post):", dbErr);
            return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju prijave.");
        }

        let reporterEmail = null;
        try {
            const userResult = await db.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
            reporterEmail = userResult.rows[0]?.email || null;
        } catch (err) {}

        try {
            await emailService.sendReportEmail(
                postTitle || postCheck.rows[0].title,
                postAuthor || "Neznano",
                postId,
                reason.trim(),
                reporterEmail
            );
        } catch (emailError) {
            console.error("Error sending report email:", emailError);
        }

        res.status(200).json({ message: "Prijava uspešno poslana." });
    } catch (err) {
        console.error("Napaka pri prijavi objave:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri pošiljanju prijave.");
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

        const check = await db.query("SELECT id FROM posts WHERE id = $1", [id]);
        if (check.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Objava ne obstaja");
        }

        if (isFeatured === true) {
            await db.query(
                `UPDATE posts 
             SET is_featured = FALSE 
             WHERE is_featured = TRUE AND id != $1`,
                [id]
            );
        }

        const { rows } = await db.query(
            `UPDATE posts 
         SET is_featured = $1 
         WHERE id = $2 
         RETURNING id, is_featured AS "isFeatured"`,
            [isFeatured === true, id]
        );

        res.json({
            id: rows[0].id,
            isFeatured: rows[0].isFeatured,
            message: isFeatured ? "Objava označena kot najboljša tedna" : "Označba odstranjena"
        });
    } catch (err) {
        console.error("Napaka /api/posts/:id/feature:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri označevanju objave");
    }
});


module.exports = router;