const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const emailService = require("../services/emailService");
const {
    recordUserReport,
    DUPLICATE_ACTIVE_REPORT_CODE,
    DUPLICATE_ACTIVE_REPORT_MESSAGE,
} = require("../services/contentReports");
const { canViewHiddenContent, getSessionAuthz } = require("../services/permissions");
const { parseViewerUserId } = require("../services/contentVisibility");
const L = require("../constants/inputLimits");
const { userSearchLimiter, userContentReportLimiter } = require("../middleware/rateLimiters");
const { rejectIfStringTooLong } = require("../utils/rejectIfStringTooLong");
const { anonParticipantLabelExpr } = require("../utils/anonymousParticipantLabel");
const requireCleanContent = require("../middleware/requireCleanContent");
const { viewerPassesPrivateProfileWall } = require("../services/profilePrivateAccess");

/** PostgreSQL / pg lahko vrne boolean, število ali niz; za zasebni zid potrebujemo zanesljivo true/false. */
function coerceIsProfilePrivate(value) {
    if (value === true || value === "t" || value === 1 || value === "1") return true;
    if (value === false || value === "f" || value === 0 || value === "0") return false;
    if (value == null) return false;
    const s = String(value).trim().toLowerCase();
    if (s === "true" || s === "yes" || s === "on") return true;
    if (s === "false" || s === "no" || s === "off") return false;
    return false;
}

async function usersBlockedWithEachOther(userIdA, userIdB) {
    if (userIdA == null || userIdB == null) return false;
    const a = Number(userIdA);
    const b = Number(userIdB);
    if (Number.isNaN(a) || Number.isNaN(b) || a === b) return false;
    const { rowCount } = await db.query(
        `SELECT 1 FROM user_blocks
         WHERE (blocker_id = $1 AND blocked_id = $2)
            OR (blocker_id = $2 AND blocked_id = $1)
         LIMIT 1`,
        [a, b]
    );
    return rowCount > 0;
}

/** Javni profil in podpote: prijavljen ogledovalec ne sme dostopati, če je med njima blokada (katera koli smer). */
async function profileBlockedForViewer(viewerUserId, profileUserId) {
    if (viewerUserId == null || profileUserId == null) return false;
    const v = Number(viewerUserId);
    const p = Number(profileUserId);
    if (Number.isNaN(v) || Number.isNaN(p) || v === p) return false;
    return usersBlockedWithEachOther(v, p);
}

/** Per-post JSON counts for post_support_reactions (alias p = posts). */
const SQL_POST_SUPPORT_COUNTS = `COALESCE(
    (SELECT json_build_object(
        'support', COALESCE(SUM(CASE WHEN reaction_type = 'support' THEN 1 ELSE 0 END), 0),
        'hug', COALESCE(SUM(CASE WHEN reaction_type = 'hug' THEN 1 ELSE 0 END), 0),
        'understand', COALESCE(SUM(CASE WHEN reaction_type = 'understand' THEN 1 ELSE 0 END), 0),
        'together', COALESCE(SUM(CASE WHEN reaction_type = 'together' THEN 1 ELSE 0 END), 0)
    )
    FROM post_support_reactions
    WHERE post_id = p.id),
    '{"support":0,"hug":0,"understand":0,"together":0}'::json
) AS "supportCounts"`;

/** Per-comment JSON counts (alias c = comments). */
const SQL_COMMENT_SUPPORT_COUNTS = `COALESCE(
    (SELECT json_build_object(
        'support', COALESCE(SUM(CASE WHEN reaction_type = 'support' THEN 1 ELSE 0 END), 0),
        'hug', COALESCE(SUM(CASE WHEN reaction_type = 'hug' THEN 1 ELSE 0 END), 0),
        'understand', COALESCE(SUM(CASE WHEN reaction_type = 'understand' THEN 1 ELSE 0 END), 0),
        'together', COALESCE(SUM(CASE WHEN reaction_type = 'together' THEN 1 ELSE 0 END), 0)
    )
    FROM comment_support_reactions
    WHERE comment_id = c.id),
    '{"support":0,"hug":0,"understand":0,"together":0}'::json
) AS "supportCounts"`;

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
    if (cloudName && !u.pathname.startsWith(`/${cloudName}/`)) return false;

    if (!u.pathname.includes("/image/upload/")) return false;

    return true;
}

router.get("/me", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows } = await db.query(
            `SELECT
               id,
               username,
               email,
               email_verified,
               bio,
               is_admin,
               is_suspended,
               avatar_url AS "avatarUrl",
               COALESCE(show_listings_on_profile, true) AS "showListingsOnProfile",
               COALESCE(show_support_on_profile, true) AS "showSupportOnProfile",
               COALESCE(show_posts_on_profile, true) AS "showPostsOnProfile",
               COALESCE(is_profile_private, false) AS "isProfilePrivate"
             FROM users
             WHERE id = $1`,
            [userId]
        );
        if (rows.length === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }
        const authz = await getSessionAuthz(userId);
        if (!authz) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }
        res.json({
            ...rows[0],
            isAdmin: authz.isAdmin,
            isSuspended: Boolean(rows[0].is_suspended),
            roles: authz.roles,
            permissions: authz.permissions,
        });
    } catch (err) {
        console.error("Napaka /api/users/me:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju profila");
    }
});

router.put("/me", requireAuth, requireCleanContent("bio"), async (req, res) => {
    try {
        const userId = req.user.id;
        const {
            username,
            email,
            password,
            bio,
            avatarUrl,
            showListingsOnProfile,
            showSupportOnProfile,
            showPostsOnProfile,
            isProfilePrivate,
        } = req.body;

        const existingPriv = await db.query(
            `SELECT COALESCE(is_profile_private, false) AS p FROM users WHERE id = $1`,
            [userId]
        );
        if (existingPriv.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }
        const wasPrivate = coerceIsProfilePrivate(existingPriv.rows[0].p);

        if (username) {
            const ut = String(username).trim();
            if (ut.length < L.USERNAME_MIN) {
                return sendJsonError(
                    res,
                    400,
                    CODES.VALIDATION_ERROR,
                    `Uporabniško ime mora imeti vsaj ${L.USERNAME_MIN} znake.`
                );
            }
            if (rejectIfStringTooLong(res, ut, L.USERNAME_MAX, "Uporabniško ime", { useMessageKey: true })) return;
        }
        if (email && rejectIfStringTooLong(res, String(email).trim(), L.EMAIL, "Email", { useMessageKey: true })) return;
        if (password && rejectIfStringTooLong(res, password, L.PASSWORD_MAX, "Geslo", { useMessageKey: true })) return;
        if (bio !== undefined && bio !== null && bio !== "") {
            if (rejectIfStringTooLong(res, String(bio), L.BIO, "Bio", { useMessageKey: true })) return;
        }

        if (username || email) {
            const check = await db.query(
                "SELECT id FROM users WHERE (lower(email) = lower($1) OR lower(username) = lower($2)) AND id != $3",
                [email || "", username || "", userId]
            );
            if (check.rowCount > 0) {
                return sendJsonError(res, 409, CODES.CONFLICT, "Uporabnik z emailom ali uporabniškim imenom že obstaja.");
            }
        }

        let updateFields = [];
        let values = [];
        let paramIndex = 1;

        if (username) {
            updateFields.push(`username = $${paramIndex}`);
            values.push(username.trim());
            paramIndex++;
        }

        let emailChanged = false;
        let newEmail = null;
        let verificationToken = null;
        let tokenExpires = null;

        if (email) {
            const currentUser = await db.query(
                "SELECT email FROM users WHERE id = $1",
                [userId]
            );

            if (currentUser.rows[0].email.toLowerCase() !== email.toLowerCase()) {
                emailChanged = true;
                newEmail = email.trim();

                verificationToken = crypto.randomBytes(32).toString('hex');
                tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

                console.log("=== SPREMEMBA EMAILA ===");
                console.log("User ID:", userId);
                console.log("Stari email:", currentUser.rows[0].email);
                console.log("Nov email:", newEmail);
                updateFields.push(`email = $${paramIndex}`);
                values.push(newEmail);
                paramIndex++;

                updateFields.push(`email_verified = $${paramIndex}`);
                values.push(false);
                paramIndex++;

                updateFields.push(`verification_token = $${paramIndex}`);
                values.push(verificationToken);
                paramIndex++;

                updateFields.push(`verification_token_expires = $${paramIndex}`);
                values.push(tokenExpires);
                paramIndex++;
            }
        }

        if (password) {
            if (password.length < 8) {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Geslo mora biti vsaj 8 znakov dolgo.");
            }
            const hash = await bcrypt.hash(password, 12);
            updateFields.push(`password_hash = $${paramIndex}`);
            values.push(hash);
            paramIndex++;
        }

        if (bio !== undefined) {
            updateFields.push(`bio = $${paramIndex}`);
            values.push(bio ? bio.trim() : null);
            paramIndex++;
        }

        if (avatarUrl !== undefined) {
            if (avatarUrl === null || avatarUrl === "") {
                updateFields.push(`avatar_url = $${paramIndex}`);
                values.push(null);
                paramIndex++;
            } else {
                const url = String(avatarUrl).trim();
                if (!isValidCloudinaryUrl(url)) {
                    return sendJsonError(
                        res,
                        400,
                        CODES.VALIDATION_ERROR,
                        "Neveljaven URL slike (dovoljene so samo slike na Cloudinary)."
                    );
                }
                updateFields.push(`avatar_url = $${paramIndex}`);
                values.push(url);
                paramIndex++;
            }
        }

        const privatizing = isProfilePrivate === true;
        const privatizeMsg =
            "Zasebni profil je vklopljen. Najprej ga izključi, če želiš javne zavihke na profilu (oglasi, podpora, objave).";

        if (privatizing) {
            if (typeof isProfilePrivate !== "boolean") {
                return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "isProfilePrivate mora biti boolean.");
            }
            updateFields.push(`is_profile_private = $${paramIndex}`);
            values.push(true);
            paramIndex++;
            updateFields.push(`show_listings_on_profile = $${paramIndex}`);
            values.push(false);
            paramIndex++;
            updateFields.push(`show_support_on_profile = $${paramIndex}`);
            values.push(false);
            paramIndex++;
            updateFields.push(`show_posts_on_profile = $${paramIndex}`);
            values.push(false);
            paramIndex++;
        } else {
            if (showListingsOnProfile !== undefined) {
                if (typeof showListingsOnProfile !== "boolean") {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "showListingsOnProfile mora biti boolean.");
                }
                if (wasPrivate && isProfilePrivate === undefined && showListingsOnProfile === true) {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, privatizeMsg);
                }
                updateFields.push(`show_listings_on_profile = $${paramIndex}`);
                values.push(showListingsOnProfile);
                paramIndex++;
            }

            if (showSupportOnProfile !== undefined) {
                if (typeof showSupportOnProfile !== "boolean") {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "showSupportOnProfile mora biti boolean.");
                }
                if (wasPrivate && isProfilePrivate === undefined && showSupportOnProfile === true) {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, privatizeMsg);
                }
                updateFields.push(`show_support_on_profile = $${paramIndex}`);
                values.push(showSupportOnProfile);
                paramIndex++;
            }

            if (showPostsOnProfile !== undefined) {
                if (typeof showPostsOnProfile !== "boolean") {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "showPostsOnProfile mora biti boolean.");
                }
                if (wasPrivate && isProfilePrivate === undefined && showPostsOnProfile === true) {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, privatizeMsg);
                }
                updateFields.push(`show_posts_on_profile = $${paramIndex}`);
                values.push(showPostsOnProfile);
                paramIndex++;
            }

            if (isProfilePrivate !== undefined) {
                if (typeof isProfilePrivate !== "boolean") {
                    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "isProfilePrivate mora biti boolean.");
                }
                updateFields.push(`is_profile_private = $${paramIndex}`);
                values.push(isProfilePrivate);
                paramIndex++;
            }
        }

        if (updateFields.length === 0) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ni podatkov za posodobitev.");
        }

        values.push(userId);
        const query = `UPDATE users
                       SET ${updateFields.join(", ")}
                       WHERE id = $${paramIndex}
                       RETURNING
                         id,
                         username,
                         email,
                         email_verified,
                         bio,
                         is_admin,
                         avatar_url AS "avatarUrl",
                         COALESCE(show_listings_on_profile, true) AS "showListingsOnProfile",
                         COALESCE(show_support_on_profile, true) AS "showSupportOnProfile",
                         COALESCE(show_posts_on_profile, true) AS "showPostsOnProfile",
                         COALESCE(is_profile_private, false) AS "isProfilePrivate"`;
        const { rows } = await db.query(query, values);

        if (emailChanged && verificationToken) {
            try {
                await emailService.sendVerificationEmail(newEmail, username || rows[0].username, verificationToken);
            } catch (emailError) {
                console.error("❌ Napaka pri pošiljanju emaila:", emailError);
            }
        }

        const response = {
            ...rows[0],
            emailChanged: emailChanged,
            message: emailChanged
                ? "Profil posodobljen. Preveri svoj nov email za verifikacijsko povezavo."
                : "Profil uspešno posodobljen."
        };

        res.json(response);
    } catch (err) {
        console.error("Napaka /api/users/me PUT:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri posodabljanju profila");
    }
});

router.delete("/me", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;

        const userCheck = await db.query("SELECT id FROM users WHERE id = $1", [userId]);
        if (userCheck.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }

        const client = await db.connect();
        try {
            await client.query("BEGIN");

            // Mark user as deleted + deactivate.
            // PII gets anonymized to avoid leaving identifying data in the DB.
            const placeholderEmail = `deleted+${userId}@local.invalid`;
            const placeholderUsername = `Izbrisan uporabnik #${userId}`;

            await client.query(
                `UPDATE users
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deactivated_at = COALESCE(deactivated_at, NOW()),
                     anonymized_at = COALESCE(anonymized_at, NOW()),
                     deleted_by_user_id = $1,
                     deleted_source = 'user',
                     deleted_reason = 'self_delete',
                     email = $2,
                     email_verified = false,
                     verification_token = NULL,
                     verification_token_expires = NULL,
                     bio = NULL,
                     avatar_url = NULL,
                     username = $3
                 WHERE id = $1`,
                [userId, placeholderEmail, placeholderUsername]
            );

            // Soft-delete authored content
            await client.query(
                `UPDATE posts
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'user',
                     deleted_reason = 'self_delete'
                 WHERE user_id = $1`,
                [userId, userId]
            );
            await client.query(
                `UPDATE comments
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'user',
                     deleted_reason = 'self_delete'
                 WHERE user_id = $1`,
                [userId, userId]
            );
            await client.query(
                `UPDATE marketplace_listings
                 SET status = 'deleted',
                     deleted_at = COALESCE(deleted_at, NOW()),
                     deleted_by_user_id = $2,
                     deleted_source = 'user',
                     deleted_reason = 'self_delete',
                     updated_at = NOW()
                 WHERE user_id = $1`,
                [userId, userId]
            );

            // Keep notifications/likes for now (reads will be filtered); optionally we can purge PII later.
            await client.query(
                `INSERT INTO deletion_events (target_type, target_id, event_type, actor_user_id, source, reason, metadata)
                 VALUES ('user', $1, 'deleted', $1, 'user', 'self_delete', '{}'::jsonb)`,
                [userId]
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

        res.json({ message: "Račun uspešno izbrisan" });
    } catch (err) {
        console.error("Napaka /api/users/me DELETE:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri brisanju računa");
    }
});

router.get("/me/posts", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const { rows } = await db.query(
            `SELECT p.id,
                p.category_id AS "categoryId",
                p.title,
                p.content,
                p.city AS city,
                p.tags AS tags,
                p.created_at AS "createdAt",
                p.image_url AS "imageUrl",
                p.image_public_id AS "imagePublicId",
                p.is_hidden AS "isHidden",
                c.name        AS "categoryName",
                c.slug        AS "categorySlug",
                CASE WHEN p.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl",
                COALESCE(like_counts.like_count, 0) AS "likeCount",
                COALESCE(comment_counts.comment_count, 0) AS "commentCount",
                ${SQL_POST_SUPPORT_COUNTS.replace(/\s+/g, " ")}
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN (
           SELECT post_id, COUNT(*)::int AS like_count
           FROM post_likes
           GROUP BY post_id
         ) like_counts ON like_counts.post_id = p.id
         LEFT JOIN (
           SELECT post_id, COUNT(*)::int AS comment_count
           FROM comments
           WHERE is_hidden = false
             AND status <> 'deleted'
             AND deleted_at IS NULL
           GROUP BY post_id
         ) comment_counts ON comment_counts.post_id = p.id
         WHERE p.user_id = $1
           AND p.is_anonymous = false
           AND p.status <> 'deleted'
           AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            "SELECT COUNT(*)::int AS count FROM posts WHERE user_id = $1 AND is_anonymous = false AND status <> 'deleted' AND deleted_at IS NULL",
            [userId]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count
            }
        });
    } catch (err) {
        console.error("Napaka /api/users/me/posts:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju objav");
    }
});

/** Zbrane številke za zavihek »Moj profil« brez nalaganja vseh objav. */
router.get("/me/post-stats", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { rows } = await db.query(
            `SELECT
               (SELECT COUNT(*)::int FROM posts WHERE user_id = $1 AND is_anonymous = false AND status <> 'deleted' AND deleted_at IS NULL) AS "totalPosts",
               (SELECT COUNT(*)::int FROM post_likes pl
                 INNER JOIN posts p ON p.id = pl.post_id
                 WHERE p.user_id = $1 AND p.status <> 'deleted' AND p.deleted_at IS NULL) AS "totalThumbUps",
               (SELECT COUNT(*)::int FROM comments c
                 INNER JOIN posts p ON p.id = c.post_id
                 WHERE p.user_id = $1
                   AND c.is_hidden = false
                   AND c.status <> 'deleted'
                   AND c.deleted_at IS NULL
                   AND p.status <> 'deleted'
                   AND p.deleted_at IS NULL) AS "totalComments",
               (SELECT COUNT(*)::int FROM post_support_reactions psr
                 INNER JOIN posts p ON p.id = psr.post_id
                 WHERE p.user_id = $1 AND p.status <> 'deleted' AND p.deleted_at IS NULL) AS "totalSupportReactions"`,
            [userId]
        );
        const r = rows[0] || {};
        res.json({
            totalPosts: parseInt(r.totalPosts, 10) || 0,
            totalThumbUps: parseInt(r.totalThumbUps, 10) || 0,
            totalComments: parseInt(r.totalComments, 10) || 0,
            totalSupportReactions: parseInt(r.totalSupportReactions, 10) || 0,
        });
    } catch (err) {
        console.error("Napaka /api/users/me/post-stats:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju statistike objav");
    }
});

/** Anonimne objave lastnika — za nastavitve, ne za profil. */
router.get("/me/anonymous-posts", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const { rows } = await db.query(
            `SELECT p.id,
                p.category_id AS "categoryId",
                p.title,
                p.content,
                p.city AS city,
                p.tags AS tags,
                p.created_at AS "createdAt",
                p.image_url AS "imageUrl",
                p.image_public_id AS "imagePublicId",
                p.is_hidden AS "isHidden",
                true AS "isAnonymous",
                c.name        AS "categoryName",
                c.slug        AS "categorySlug",
                u.avatar_url AS "authorAvatarUrl",
                COALESCE(like_counts.like_count, 0) AS "likeCount",
                COALESCE(comment_counts.comment_count, 0) AS "commentCount",
                ${SQL_POST_SUPPORT_COUNTS.replace(/\s+/g, " ")}
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN (
           SELECT post_id, COUNT(*)::int AS like_count
           FROM post_likes
           GROUP BY post_id
         ) like_counts ON like_counts.post_id = p.id
         LEFT JOIN (
           SELECT post_id, COUNT(*)::int AS comment_count
           FROM comments
           WHERE is_hidden = false
             AND status <> 'deleted'
             AND deleted_at IS NULL
           GROUP BY post_id
         ) comment_counts ON comment_counts.post_id = p.id
         WHERE p.user_id = $1
           AND p.is_anonymous = true
           AND p.status <> 'deleted'
           AND p.deleted_at IS NULL
         ORDER BY p.created_at DESC
         LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            "SELECT COUNT(*)::int AS count FROM posts WHERE user_id = $1 AND is_anonymous = true AND status <> 'deleted' AND deleted_at IS NULL",
            [userId]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count,
            },
        });
    } catch (err) {
        console.error("Napaka /api/users/me/anonymous-posts:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju anonimnih objav");
    }
});

router.get("/me/favorites", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);
        const canViewHidden = await canViewHiddenContent(userId);

        const { rows } = await db.query(
            `SELECT p.id,
                p.title,
                p.content,
                p.image_url AS "imageUrl",
                p.image_public_id AS "imagePublicId",
                p.city AS city,
                p.tags AS tags,
                p.created_at AS "createdAt",
                p.is_featured AS "isFeatured",
                p.is_hidden AS "isHidden",
                CASE WHEN p.is_anonymous = true THEN NULL ELSE u.id END AS "userId",
                CASE
                  WHEN p.is_anonymous = true THEN ${anonParticipantLabelExpr("p.id", "u.id")}
                  ELSE u.username
                END AS author,
                CASE WHEN p.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl",
                c.name AS "categoryName",
                c.slug AS "categorySlug",
                COALESCE(like_counts.like_count, 0) AS "likeCount",
                CASE WHEN user_likes.post_id IS NOT NULL THEN true ELSE false END AS "isLiked",
                true AS "isFavorited",
                COALESCE(comment_counts.comment_count, 0) AS "commentCount",
                pf.created_at AS "favoritedAt"
            FROM post_favorites pf
            INNER JOIN posts p ON p.id = pf.post_id
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
              WHERE user_id = $1
            ) user_likes ON user_likes.post_id = p.id
            LEFT JOIN (
              SELECT post_id, COUNT(*)::int AS comment_count
              FROM comments
              WHERE is_hidden = false
                AND status <> 'deleted'
                AND deleted_at IS NULL
              GROUP BY post_id
            ) comment_counts ON comment_counts.post_id = p.id
            WHERE pf.user_id = $1
              AND p.status <> 'deleted'
              AND p.deleted_at IS NULL
              AND (p.is_hidden = false OR (p.user_id = $1) OR $2 = true)
              AND (
                NOT EXISTS (
                  SELECT 1 FROM user_blocks ub
                  WHERE (ub.blocker_id = $1 AND ub.blocked_id = p.user_id)
                     OR (ub.blocker_id = p.user_id AND ub.blocked_id = $1)
                )
              )
            ORDER BY pf.created_at DESC
            LIMIT $3 OFFSET $4`,
            [userId, canViewHidden, limit, offset]
        );

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS count
             FROM post_favorites pf
             INNER JOIN posts p ON p.id = pf.post_id
             WHERE pf.user_id = $1
               AND p.status <> 'deleted'
               AND p.deleted_at IS NULL
               AND (p.is_hidden = false OR (p.user_id = $1) OR $2 = true)
               AND (
                 NOT EXISTS (
                   SELECT 1 FROM user_blocks ub
                   WHERE (ub.blocker_id = $1 AND ub.blocked_id = p.user_id)
                      OR (ub.blocker_id = p.user_id AND ub.blocked_id = $1)
                 )
               )`,
            [userId, canViewHidden]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count,
            },
        });
    } catch (err) {
        console.error("Napaka /api/users/me/favorites:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju priljubljenih objav");
    }
});

/** Objave in komentarji avtorja, ki so skriti pred javnostjo (vidni le avtorju in osebjem z ustreznimi pravicami). */
router.get("/me/hidden-content", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limitPosts = Math.min(parseInt(req.query.postLimit || "50", 10), 100);
        const limitComments = Math.min(parseInt(req.query.commentLimit || "50", 10), 100);

        const postsRes = await db.query(
            `SELECT p.id,
                p.title,
                p.created_at AS "createdAt",
                p.hidden_at AS "hiddenAt",
                p.moderation_status AS "moderationStatus",
                c.name AS "categoryName",
                c.slug AS "categorySlug"
             FROM posts p
             LEFT JOIN categories c ON c.id = p.category_id
             WHERE p.user_id = $1 AND p.is_hidden = true
             ORDER BY COALESCE(p.hidden_at, p.updated_at) DESC NULLS LAST, p.id DESC
             LIMIT $2`,
            [userId, limitPosts]
        );

        const commentsRes = await db.query(
            `SELECT c.id,
                c.post_id AS "postId",
                LEFT(TRIM(c.content), 400) AS content,
                c.created_at AS "createdAt",
                c.hidden_at AS "hiddenAt",
                c.moderation_status AS "moderationStatus",
                p.title AS "postTitle",
                cat.slug AS "categorySlug",
                cat.name AS "categoryName"
             FROM comments c
             INNER JOIN posts p ON p.id = c.post_id
             LEFT JOIN categories cat ON cat.id = p.category_id
             WHERE c.user_id = $1 AND c.is_hidden = true
             ORDER BY COALESCE(c.hidden_at, c.updated_at) DESC NULLS LAST, c.id DESC
             LIMIT $2`,
            [userId, limitComments]
        );

        res.json({
            posts: postsRes.rows,
            comments: commentsRes.rows
        });
    } catch (err) {
        console.error("Napaka /api/users/me/hidden-content:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju skrite vsebine");
    }
});

// Support reactions (💗🤗🌸🥰) on your posts — replaces old "likes" activity view in profile UI.
router.get("/me/post-support-reactions", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const { rows } = await db.query(
            `SELECT
                r.id AS "reactionId",
                r.reaction_type AS "reactionType",
                r.created_at AS "createdAt",
                u.username AS "reactorUsername",
                p.id AS "postId",
                p.title AS "postTitle"
            FROM post_support_reactions r
            JOIN posts p ON p.id = r.post_id
            JOIN users u ON u.id = r.user_id
            WHERE p.user_id = $1
            ORDER BY r.created_at DESC
            LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS count
            FROM post_support_reactions r
            JOIN posts p ON p.id = r.post_id
            WHERE p.user_id = $1`,
            [userId]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count
            }
        });
    } catch (err) {
        console.error("Napaka /api/users/me/post-support-reactions:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju reakcij");
    }
});

router.get("/me/likes", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const { rows } = await db.query(
            `SELECT 
          pl.id AS "likeId",
          pl.created_at AS "likedAt",
          u.username,
          p.id AS "postId",
          p.title AS "postTitle"
        FROM post_likes pl
        JOIN posts p ON p.id = pl.post_id
        JOIN users u ON u.id = pl.user_id
        WHERE p.user_id = $1
        ORDER BY pl.created_at DESC
        LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS count
            FROM post_likes pl
            JOIN posts p ON p.id = pl.post_id
            WHERE p.user_id = $1`,
            [userId]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count
            }
        });
    } catch (err) {
        console.error("Napaka /api/users/me/likes:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju lajkov");
    }
});

router.get("/me/comments", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const { rows } = await db.query(
            `SELECT 
          c.id AS "commentId",
          c.content,
          c.created_at AS "commentedAt",
          u.username AS "commenterUsername",
          p.id AS "postId",
          p.title AS "postTitle",
          COALESCE(cl.like_count, 0) AS "likeCount",
          ${SQL_COMMENT_SUPPORT_COUNTS.replace(/\s+/g, " ")}
        FROM comments c
        JOIN posts p ON p.id = c.post_id
        JOIN users u ON u.id = c.user_id
        LEFT JOIN (
          SELECT comment_id, COUNT(*)::int AS like_count
          FROM comment_likes
          GROUP BY comment_id
        ) cl ON cl.comment_id = c.id
        WHERE p.user_id = $1
          AND c.status <> 'deleted'
          AND c.deleted_at IS NULL
          AND p.status <> 'deleted'
          AND p.deleted_at IS NULL
        ORDER BY c.created_at DESC
        LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS count
            FROM comments c
            JOIN posts p ON p.id = c.post_id
            WHERE p.user_id = $1
              AND c.status <> 'deleted'
              AND c.deleted_at IS NULL
              AND p.status <> 'deleted'
              AND p.deleted_at IS NULL`,
            [userId]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count
            }
        });
    } catch (err) {
        console.error("Napaka /api/users/me/comments:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju komentarjev");
    }
});

router.get("/me/blocks", requireAuth, async (req, res) => {
    try {
        const me = req.user.id;
        const { rows } = await db.query(
            `SELECT
               u.id,
               u.username,
               u.avatar_url AS "avatarUrl",
               ub.created_at AS "blockedAt"
             FROM user_blocks ub
             INNER JOIN users u ON u.id = ub.blocked_id
             WHERE ub.blocker_id = $1
             ORDER BY ub.created_at DESC`,
            [me]
        );
        res.json({ users: rows });
    } catch (err) {
        console.error("Napaka /api/users/me/blocks:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju blokiranih uporabnikov");
    }
});

router.get("/me/listings", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const { rows } = await db.query(
            `SELECT
                l.id,
                l.title,
                l.description,
                l.is_gift AS "isGift",
                l.price,
                l.image_url AS "imageUrl",
                l.image_public_id AS "imagePublicId",
                l.has_contact_warning AS "hasContactWarning",
                l.status,
                l.created_at AS "createdAt",
                l.updated_at AS "updatedAt"
             FROM marketplace_listings l
             WHERE l.user_id = $1 AND l.status = 'active' AND l.deleted_at IS NULL
             ORDER BY l.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            "SELECT COUNT(*)::int AS count FROM marketplace_listings WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
            [userId]
        );

        res.json({
            items: rows,
            pagination: { limit, offset, total: countRes.rows[0].count }
        });
    } catch (err) {
        console.error("Napaka /api/users/me/listings:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju oglasov");
    }
});

async function getPublicProfileVisibilityFlags(userId) {
    const { rows } = await db.query(
        `SELECT
           COALESCE(show_listings_on_profile, true) AS "showListingsOnProfile",
           COALESCE(show_support_on_profile, true) AS "showSupportOnProfile"
         FROM users
         WHERE id = $1`,
        [userId]
    );
    return rows?.[0] || {
        showListingsOnProfile: true,
        showSupportOnProfile: true,
    };
}

router.get("/:id/listings", async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (Number.isNaN(userId) || userId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }
        const viewerUserId = await parseViewerUserId(req);
        if (await profileBlockedForViewer(viewerUserId, userId)) {
            return sendJsonError(res, 403, CODES.PROFILE_BLOCKED, "Profil ni na voljo.");
        }
        const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const privRes = await db.query(
            `SELECT COALESCE(is_profile_private, false) AS p FROM users WHERE id = $1`,
            [userId]
        );
        if (privRes.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }
        if (!(await viewerPassesPrivateProfileWall(viewerUserId, userId, coerceIsProfilePrivate(privRes.rows[0].p)))) {
            return res.json({ items: [], pagination: { limit, offset, total: 0 } });
        }

        const visibility = await getPublicProfileVisibilityFlags(userId);
        if (!visibility.showListingsOnProfile) {
            return res.json({ items: [], pagination: { limit, offset, total: 0 } });
        }

        const { rows } = await db.query(
            `SELECT
                l.id,
                l.title,
                l.description,
                l.is_gift AS "isGift",
                l.price,
                l.image_url AS "imageUrl",
                l.image_public_id AS "imagePublicId",
                l.created_at AS "createdAt"
             FROM marketplace_listings l
             WHERE l.user_id = $1 AND l.status = 'active' AND l.deleted_at IS NULL
             ORDER BY l.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countRes = await db.query(
            "SELECT COUNT(*)::int AS count FROM marketplace_listings WHERE user_id = $1 AND status = 'active' AND deleted_at IS NULL",
            [userId]
        );

        res.json({
            items: rows,
            pagination: { limit, offset, total: countRes.rows[0].count }
        });
    } catch (err) {
        console.error("Napaka /api/users/:id/listings:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju oglasov");
    }
});

function supportPeriodToInterval(period) {
    if (period === "week") return "7 days";
    if (period === "month") return "30 days";
    if (period === "all") return null;
    return null;
}

async function getSupportSummaryForUser(userId, period, publicOnly = false) {
    const interval = supportPeriodToInterval(period);
    const timeSql = interval ? `AND r.created_at >= NOW() - INTERVAL '${interval}'` : "";

    const postPart = publicOnly
        ? `
          SELECT r.reaction_type
          FROM post_support_reactions r
          INNER JOIN posts p ON p.id = r.post_id
          WHERE r.user_id = $1 AND p.is_hidden = false ${timeSql}
        `
        : `
          SELECT r.reaction_type
          FROM post_support_reactions r
          WHERE r.user_id = $1 ${timeSql}
        `;

    const commentPart = publicOnly
        ? `
          SELECT r.reaction_type
          FROM comment_support_reactions r
          INNER JOIN comments c ON c.id = r.comment_id
          INNER JOIN posts p ON p.id = c.post_id
          WHERE r.user_id = $1 AND c.is_hidden = false AND p.is_hidden = false ${timeSql}
        `
        : `
          SELECT r.reaction_type
          FROM comment_support_reactions r
          WHERE r.user_id = $1 ${timeSql}
        `;

    const countsRes = await db.query(
        `
        WITH all_reactions AS (
          ${postPart}
          UNION ALL
          ${commentPart}
        )
        SELECT
          SUM(CASE WHEN reaction_type = 'support' THEN 1 ELSE 0 END)::int AS "support",
          SUM(CASE WHEN reaction_type = 'hug' THEN 1 ELSE 0 END)::int AS "hug",
          SUM(CASE WHEN reaction_type = 'understand' THEN 1 ELSE 0 END)::int AS "understand",
          SUM(CASE WHEN reaction_type = 'together' THEN 1 ELSE 0 END)::int AS "together",
          SUM(CASE WHEN reaction_type IN ('support','hug') THEN 2 ELSE 1 END)::int AS "supportScore"
        FROM all_reactions
        `,
        [userId]
    );

    const counts = countsRes.rows?.[0] || {
        support: 0,
        hug: 0,
        understand: 0,
        together: 0,
        supportScore: 0
    };

    return {
        period,
        countsByType: {
            support: Number(counts.support || 0),
            hug: Number(counts.hug || 0),
            understand: Number(counts.understand || 0),
            together: Number(counts.together || 0),
        },
        supportScore: Number(counts.supportScore || 0),
    };
}

async function getRecentSupportReactionsForUser(userId, period, limit, publicOnly = false) {
    const interval = supportPeriodToInterval(period);
    const timeSql = interval ? `AND r.created_at >= NOW() - INTERVAL '${interval}'` : "";

    const postBranch = publicOnly
        ? `
          SELECT
            'post'::text AS "targetType",
            r.post_id AS "targetId",
            r.reaction_type AS "reactionType",
            r.created_at AS "createdAt"
          FROM post_support_reactions r
          INNER JOIN posts p ON p.id = r.post_id
          WHERE r.user_id = $1 AND p.is_hidden = false ${timeSql}
        `
        : `
          SELECT
            'post'::text AS "targetType",
            r.post_id AS "targetId",
            r.reaction_type AS "reactionType",
            r.created_at AS "createdAt"
          FROM post_support_reactions r
          WHERE r.user_id = $1 ${timeSql}
        `;

    const commentBranch = publicOnly
        ? `
          SELECT
            'comment'::text AS "targetType",
            r.comment_id AS "targetId",
            r.reaction_type AS "reactionType",
            r.created_at AS "createdAt"
          FROM comment_support_reactions r
          INNER JOIN comments c ON c.id = r.comment_id
          INNER JOIN posts p ON p.id = c.post_id
          WHERE r.user_id = $1 AND c.is_hidden = false AND p.is_hidden = false ${timeSql}
        `
        : `
          SELECT
            'comment'::text AS "targetType",
            r.comment_id AS "targetId",
            r.reaction_type AS "reactionType",
            r.created_at AS "createdAt"
          FROM comment_support_reactions r
          WHERE r.user_id = $1 ${timeSql}
        `;

    const { rows } = await db.query(
        `
        SELECT *
        FROM (
          ${postBranch}
          UNION ALL
          ${commentBranch}
        ) x
        ORDER BY x."createdAt" DESC
        LIMIT $2
        `,
        [userId, limit]
    );
    return rows;
}

router.get("/me/support-summary", requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const period = (req.query.period || "month").toString();
        if (!["week", "month", "all"].includes(period)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven period (week|month|all)");
        }
        const recentLimitRaw = parseInt(req.query.recentLimit || "10", 10);
        const recentLimit = Math.min(Math.max(Number.isFinite(recentLimitRaw) ? recentLimitRaw : 10, 0), 50);

        const summary = await getSupportSummaryForUser(userId, period);
        const recent = recentLimit > 0 ? await getRecentSupportReactionsForUser(userId, period, recentLimit) : [];
        res.json({ ...summary, recent });
    } catch (err) {
        console.error("Napaka /api/users/me/support-summary:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju podpore");
    }
});

router.get("/:id/support-summary", async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (Number.isNaN(userId) || userId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }
        const viewerUserId = await parseViewerUserId(req);
        if (await profileBlockedForViewer(viewerUserId, userId)) {
            return sendJsonError(res, 403, CODES.PROFILE_BLOCKED, "Profil ni na voljo.");
        }
        const period = (req.query.period || "month").toString();
        if (!["week", "month", "all"].includes(period)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven period (week|month|all)");
        }
        const recentLimitRaw = parseInt(req.query.recentLimit || "10", 10);
        const recentLimit = Math.min(Math.max(Number.isFinite(recentLimitRaw) ? recentLimitRaw : 10, 0), 50);

        const privRes = await db.query(
            `SELECT COALESCE(is_profile_private, false) AS p FROM users WHERE id = $1`,
            [userId]
        );
        if (privRes.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }
        if (!(await viewerPassesPrivateProfileWall(viewerUserId, userId, coerceIsProfilePrivate(privRes.rows[0].p)))) {
            return res.json({
                period,
                countsByType: { support: 0, hug: 0, understand: 0, together: 0 },
                supportScore: 0,
                recent: []
            });
        }

        const visibility = await getPublicProfileVisibilityFlags(userId);
        if (!visibility.showSupportOnProfile) {
            return res.json({
                period,
                countsByType: { support: 0, hug: 0, understand: 0, together: 0 },
                supportScore: 0,
                recent: []
            });
        }

        const summary = await getSupportSummaryForUser(userId, period, true);
        const recent =
            recentLimit > 0 ? await getRecentSupportReactionsForUser(userId, period, recentLimit, true) : [];
        res.json({ ...summary, recent });
    } catch (err) {
        console.error("Napaka /api/users/:id/support-summary:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju podpore");
    }
});

router.post("/:id/report", requireAuth, userContentReportLimiter, async (req, res) => {
    try {
        const profileUserId = parseInt(req.params.id, 10);
        if (Number.isNaN(profileUserId) || profileUserId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }
        if (profileUserId === req.user.id) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ne morete prijaviti lastnega profila.");
        }

        if (await usersBlockedWithEachOther(req.user.id, profileUserId)) {
            return sendJsonError(res, 403, CODES.FORBIDDEN, "Dejanje ni na voljo.");
        }

        const { reason, profileUsername } = req.body;
        if (!reason || !String(reason).trim()) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Razlog prijave je obvezen.");
        }
        if (rejectIfStringTooLong(res, String(reason).trim(), L.REPORT_REASON, "Razlog prijave")) return;
        if (
            profileUsername != null &&
            profileUsername !== "" &&
            rejectIfStringTooLong(res, String(profileUsername), L.USERNAME_MAX, "Uporabniško ime v prijavi")
        ) {
            return;
        }

        const userCheck = await db.query("SELECT id, username FROM users WHERE id = $1", [profileUserId]);
        if (userCheck.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }

        const username = userCheck.rows[0].username;

        try {
            await recordUserReport({
                reporterUserId: req.user.id,
                targetType: "user_profile",
                targetId: profileUserId,
                reason: String(reason).trim(),
            });
        } catch (dbErr) {
            if (dbErr.code === DUPLICATE_ACTIVE_REPORT_CODE) {
                return sendJsonError(res, 409, CODES.CONFLICT, DUPLICATE_ACTIVE_REPORT_MESSAGE);
            }
            console.error("content_reports (user_profile):", dbErr);
            return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri shranjevanju prijave.");
        }

        let reporterEmail = null;
        try {
            const userResult = await db.query("SELECT email FROM users WHERE id = $1", [req.user.id]);
            reporterEmail = userResult.rows[0]?.email || null;
        } catch (err) {
            /* ignore */
        }

        try {
            await emailService.sendProfileReportEmail(
                profileUsername || username,
                profileUserId,
                String(reason).trim(),
                reporterEmail
            );
        } catch (emailError) {
            console.error("Error sending profile report email:", emailError);
        }

        res.status(200).json({ message: "Prijava uspešno poslana." });
    } catch (err) {
        console.error("Napaka pri prijavi profila:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri pošiljanju prijave.");
    }
});

router.get("/search", requireAuth, userSearchLimiter, async (req, res) => {
    try {
        const query = String(req.query.q || "")
            .trim()
            .slice(0, L.USER_SEARCH);
        if (!query.trim()) {
            return res.json([]);
        }

        const searchTerm = `%${query.trim().toLowerCase()}%`;
        const me = req.user.id;
        const bioVisibleSql = `(
            NOT COALESCE(u.is_profile_private, false)
            OR u.id = $2::bigint
            OR EXISTS (
              SELECT 1 FROM friends f
              WHERE f.user_id_1 = LEAST(u.id, $2::bigint)
                AND f.user_id_2 = GREATEST(u.id, $2::bigint)
            )
          )`;
        const { rows } = await db.query(
            `SELECT u.id, u.username, u.created_at,
                    CASE WHEN ${bioVisibleSql} THEN u.bio ELSE NULL END AS bio
             FROM users u
             WHERE (
                 LOWER(u.username) LIKE $1
                 OR (
                   LOWER(COALESCE(u.bio, '')) LIKE $1
                   AND ${bioVisibleSql}
                 )
               )
               AND u.id <> $2
               AND NOT EXISTS (
                 SELECT 1 FROM user_blocks ub
                 WHERE (ub.blocker_id = $2 AND ub.blocked_id = u.id)
                    OR (ub.blocker_id = u.id AND ub.blocked_id = $2)
               )
             ORDER BY u.username ASC
             LIMIT 20`,
            [searchTerm, me]
        );

        res.json(rows.map(u => ({
            id: u.id,
            username: u.username,
            bio: u.bio,
            created_at: u.created_at
        })));
    } catch (err) {
        console.error("Napaka /api/users/search:", err);
        return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri iskanju uporabnikov");
    }
});

router.get("/:id/friends/mutual", async (req, res) => {
    try {
        const profileId = parseInt(req.params.id, 10);
        if (Number.isNaN(profileId) || profileId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }

        const viewerId = await parseViewerUserId(req);
        if (!viewerId) {
            return sendJsonError(
                res,
                401,
                CODES.UNAUTHORIZED,
                "Za ogled skupnih prijateljev se morate prijaviti.",
                { items: [], total: 0 }
            );
        }
        if (Number(viewerId) === profileId) {
            return res.json({ items: [], total: 0 });
        }

        const exists = await db.query("SELECT 1 FROM users WHERE id = $1", [profileId]);
        if (exists.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }

        if (await usersBlockedWithEachOther(viewerId, profileId)) {
            return sendJsonError(res, 403, CODES.PROFILE_BLOCKED, "Profil ni na voljo.", { items: [], total: 0 });
        }

        const limit = Math.min(parseInt(req.query.limit || "50", 10), 150);
        const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

        const privRow = await db.query(
            `SELECT COALESCE(is_profile_private, false) AS p FROM users WHERE id = $1`,
            [profileId]
        );
        const isPrivate = coerceIsProfilePrivate(privRow.rows[0]?.p);
        if (isPrivate && !(await viewerPassesPrivateProfileWall(viewerId, profileId, true))) {
            return res.json({ items: [], total: 0, pagination: { limit, offset, total: 0 } });
        }

        const countRes = await db.query(
            `WITH viewer_friends AS (
                SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS fid
                FROM friends WHERE user_id_1 = $1 OR user_id_2 = $1
            ),
            profile_friends AS (
                SELECT CASE WHEN user_id_1 = $2 THEN user_id_2 ELSE user_id_1 END AS fid
                FROM friends WHERE user_id_1 = $2 OR user_id_2 = $2
            )
            SELECT COUNT(*)::int AS c
            FROM viewer_friends vf
            INNER JOIN profile_friends pf ON vf.fid = pf.fid`,
            [viewerId, profileId]
        );
        const total = parseInt(countRes.rows?.[0]?.c, 10) || 0;

        const { rows } = await db.query(
            `WITH viewer_friends AS (
                SELECT CASE WHEN user_id_1 = $1 THEN user_id_2 ELSE user_id_1 END AS fid
                FROM friends WHERE user_id_1 = $1 OR user_id_2 = $1
            ),
            profile_friends AS (
                SELECT CASE WHEN user_id_1 = $2 THEN user_id_2 ELSE user_id_1 END AS fid
                FROM friends WHERE user_id_1 = $2 OR user_id_2 = $2
            )
            SELECT u.id, u.username, u.avatar_url AS "avatarUrl"
            FROM viewer_friends vf
            INNER JOIN profile_friends pf ON vf.fid = pf.fid
            INNER JOIN users u ON u.id = vf.fid
            ORDER BY u.username ASC
            LIMIT $3 OFFSET $4`,
            [viewerId, profileId, limit, offset]
        );

        return res.json({ items: rows, total, pagination: { limit, offset, total } });
    } catch (err) {
        console.error("Napaka /api/users/:id/friends/mutual:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju skupnih prijateljev");
    }
});

router.get("/:id/friends", async (req, res) => {
    try {
        const profileId = parseInt(req.params.id, 10);
        if (Number.isNaN(profileId) || profileId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }

        const viewerId = await parseViewerUserId(req);

        const userCheck = await db.query(
            `SELECT COALESCE(is_profile_private, false) AS p FROM users WHERE id = $1`,
            [profileId]
        );
        if (userCheck.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }
        const isPrivate = coerceIsProfilePrivate(userCheck.rows[0].p);

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS c FROM friends WHERE user_id_1 = $1 OR user_id_2 = $1`,
            [profileId]
        );
        const friendCountRaw = parseInt(countRes.rows[0]?.c, 10) || 0;

        if (!viewerId) {
            const friendCount = isPrivate ? null : friendCountRaw;
            return res.json({ friends: [], canViewList: false, friendCount });
        }
        if (await usersBlockedWithEachOther(viewerId, profileId)) {
            return res.json({ friends: [], canViewList: false, friendCount: isPrivate ? null : friendCountRaw });
        }

        const fullAccess = await viewerPassesPrivateProfileWall(viewerId, profileId, isPrivate);
        if (!fullAccess) {
            return res.json({
                friends: [],
                canViewList: false,
                friendCount: null,
                pagination: {
                    limit: Math.min(parseInt(req.query.limit || "60", 10), 150),
                    offset: Math.max(parseInt(req.query.offset || "0", 10), 0),
                    total: 0,
                },
            });
        }

        const limit = Math.min(parseInt(req.query.limit || "60", 10), 150);
        const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

        const detailed = await db.query(
            `SELECT u.id, u.username, u.avatar_url AS "avatarUrl"
             FROM friends f
             JOIN users u ON u.id = (CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END)
             WHERE f.user_id_1 = $1 OR f.user_id_2 = $1
             ORDER BY u.username ASC
             LIMIT $2 OFFSET $3`,
            [profileId, limit, offset]
        );

        return res.json({
            friends: detailed.rows,
            canViewList: true,
            friendCount: friendCountRaw,
            pagination: { limit, offset, total: friendCountRaw },
        });
    } catch (err) {
        console.error("Napaka /api/users/:id/friends:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju prijateljev");
    }
});

/** Javne objave uporabnika s straničenjem (enaka vidnost kot pri GET /:id). */
router.get("/:id/posts", async (req, res) => {
    try {
        const userId = parseInt(req.params.id, 10);
        if (Number.isNaN(userId) || userId < 1) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }

        const viewerUserId = await parseViewerUserId(req);
        if (await profileBlockedForViewer(viewerUserId, userId)) {
            return sendJsonError(res, 403, CODES.PROFILE_BLOCKED, "Profil ni na voljo.");
        }

        const { rows: userRows } = await db.query(
            `SELECT COALESCE(show_posts_on_profile, true) AS "showPostsOnProfile",
                    COALESCE(is_profile_private, false) AS "isProfilePrivate"
             FROM users WHERE id = $1`,
            [userId]
        );
        if (userRows.length === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }

        const isPrivateProfile = coerceIsProfilePrivate(userRows[0].isProfilePrivate);
        const wallOk = await viewerPassesPrivateProfileWall(viewerUserId, userId, isPrivateProfile);
        if (!wallOk) {
            const limit = Math.min(parseInt(req.query.limit || "12", 10), 100);
            const offset = parseInt(req.query.offset || "0", 10);
            return res.json({ items: [], pagination: { limit, offset, total: 0 } });
        }

        const selfView = viewerUserId != null && Number(viewerUserId) === Number(userId);
        const showPostsPublic = selfView || Boolean(userRows[0].showPostsOnProfile);
        if (!showPostsPublic) {
            return res.json({ items: [], pagination: { limit: 0, offset: 0, total: 0 } });
        }

        const canViewHidden = viewerUserId ? await canViewHiddenContent(viewerUserId) : false;
        const limit = Math.min(parseInt(req.query.limit || "12", 10), 100);
        const offset = parseInt(req.query.offset || "0", 10);

        const postVis = (alias) =>
            `(${alias}.is_hidden = false OR ($2::bigint IS NOT NULL AND $2 = $1) OR $3 = true)`;

        const { rows } = await db.query(
            `SELECT p.id, p.title, p.content,
                p.city AS city,
                p.tags AS tags,
                p.created_at AS "createdAt",
                p.image_url AS "imageUrl",
                p.image_public_id AS "imagePublicId",
                c.name AS "categoryName", c.slug AS "categorySlug",
                CASE WHEN p.is_anonymous = true THEN NULL ELSE u.avatar_url END AS "authorAvatarUrl",
                COALESCE((SELECT COUNT(*)::int FROM post_likes WHERE post_id = p.id), 0) AS "likeCount",
                COALESCE((
                  SELECT COUNT(*)::int FROM comments
                  WHERE post_id = p.id
                    AND is_hidden = false
                    AND status <> 'deleted'
                    AND deleted_at IS NULL
                ), 0) AS "commentCount",
                ${SQL_POST_SUPPORT_COUNTS.replace(/\s+/g, " ")}
         FROM posts p
         JOIN users u ON u.id = p.user_id
         LEFT JOIN categories c ON c.id = p.category_id
         WHERE p.user_id = $1
           AND p.is_anonymous = false
           AND p.status <> 'deleted'
           AND p.deleted_at IS NULL
           AND ${postVis("p")}
         ORDER BY p.created_at DESC
         LIMIT $4 OFFSET $5`,
            [userId, viewerUserId, canViewHidden, limit, offset]
        );

        const countRes = await db.query(
            `SELECT COUNT(*)::int AS count
             FROM posts p
             WHERE p.user_id = $1
               AND p.is_anonymous = false
               AND p.status <> 'deleted'
               AND p.deleted_at IS NULL
               AND ${postVis("p")}`,
            [userId, viewerUserId, canViewHidden]
        );

        res.json({
            items: rows,
            pagination: {
                limit,
                offset,
                total: countRes.rows[0].count,
            },
        });
    } catch (err) {
        console.error("Napaka /api/users/:id/posts:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju objav");
    }
});

router.get("/:id", async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (isNaN(userId)) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ID uporabnika");
        }

        const viewerUserId = await parseViewerUserId(req);
        const canViewHidden = viewerUserId ? await canViewHiddenContent(viewerUserId) : false;

        const { rows: userRows } = await db.query(
            `SELECT
               id,
               username,
               email_verified,
               bio,
               created_at,
               is_suspended,
               avatar_url AS "avatarUrl",
               COALESCE(show_listings_on_profile, true) AS "showListingsOnProfile",
               COALESCE(show_support_on_profile, true) AS "showSupportOnProfile",
               COALESCE(show_posts_on_profile, true) AS "showPostsOnProfile",
               COALESCE(is_profile_private, false) AS "isProfilePrivate"
             FROM users
             WHERE id = $1
               AND status <> 'deleted'
               AND deleted_at IS NULL`,
            [userId]
        );

        if (userRows.length === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik ne obstaja");
        }

        const user = userRows[0];

        if (
            Boolean(user.is_suspended) &&
            !(viewerUserId != null && Number(viewerUserId) === Number(userId)) &&
            !canViewHidden
        ) {
            // Suspended profiles are not publicly accessible; show a dedicated message in UI.
            return sendJsonError(
                res,
                403,
                CODES.USER_SUSPENDED,
                "Ta uporabniški profil je bil odstranjen zaradi kršitve pravil skupnosti."
            );
        }

        if (await profileBlockedForViewer(viewerUserId, userId)) {
            return sendJsonError(res, 403, CODES.PROFILE_BLOCKED, "Profil ni na voljo.");
        }

        const isProfilePrivate = coerceIsProfilePrivate(user.isProfilePrivate);
        const viewerHasFullAccess = await viewerPassesPrivateProfileWall(
            viewerUserId,
            userId,
            isProfilePrivate
        );

        const postVis = (alias) =>
            `(${alias}.is_hidden = false OR ($2::bigint IS NOT NULL AND $2 = $1) OR $3 = true)`;

        const { rows: statsRows } = await db.query(
            `SELECT
            (SELECT COUNT(*)::int FROM posts p WHERE p.user_id = $1 AND ${postVis("p")}) AS "totalPosts",
            (SELECT COUNT(*)::int FROM post_likes pl
              INNER JOIN posts p ON p.id = pl.post_id WHERE p.user_id = $1 AND ${postVis("p")}) AS "totalLikes",
            (SELECT COUNT(*)::int FROM comments c
              INNER JOIN posts p ON p.id = c.post_id
              WHERE c.user_id = $1 AND ${postVis("c")} AND ${postVis("p")}) AS "totalComments",
            (SELECT COUNT(*)::int FROM post_support_reactions psr
              INNER JOIN posts p ON p.id = psr.post_id WHERE p.user_id = $1 AND ${postVis("p")}) AS "totalPostSupportReactions",
            (SELECT COUNT(*)::int FROM comment_support_reactions csr
              INNER JOIN comments cc ON cc.id = csr.comment_id
              INNER JOIN posts p ON p.id = cc.post_id WHERE p.user_id = $1 AND ${postVis("p")} AND ${postVis("cc")}) AS "totalCommentSupportReactions",
            (SELECT COALESCE(SUM(
                CASE WHEN psr.reaction_type IN ('support','hug') THEN 2 ELSE 1 END
              ), 0)::int FROM post_support_reactions psr
              INNER JOIN posts p ON p.id = psr.post_id WHERE p.user_id = $1 AND ${postVis("p")}) AS "receivedPostSupportScore",
            (SELECT COALESCE(SUM(
                CASE WHEN csr.reaction_type IN ('support','hug') THEN 2 ELSE 1 END
              ), 0)::int FROM comment_support_reactions csr
              INNER JOIN comments cc ON cc.id = csr.comment_id
              INNER JOIN posts p ON p.id = cc.post_id WHERE p.user_id = $1 AND ${postVis("p")} AND ${postVis("cc")}) AS "receivedCommentSupportScore",
            (SELECT COUNT(*)::int FROM friends f WHERE f.user_id_1 = $1 OR f.user_id_2 = $1) AS "friendCount"`,
            [userId, viewerUserId, canViewHidden]
        );

        const sr = statsRows[0];
        const totalPostSupportReactions = parseInt(sr.totalPostSupportReactions, 10) || 0;
        const totalCommentSupportReactions = parseInt(sr.totalCommentSupportReactions, 10) || 0;
        const receivedPostSupportScore = parseInt(sr.receivedPostSupportScore, 10) || 0;
        const receivedCommentSupportScore = parseInt(sr.receivedCommentSupportScore, 10) || 0;
        const receivedSupportScore = receivedPostSupportScore + receivedCommentSupportScore;

        /* Števec objav na kartici: vedno skupno število (zavihka / show_posts urejajo le desno, ne številko). */
        const totalPostsStat = parseInt(sr.totalPosts, 10) || 0;
        const friendCountStat = parseInt(sr.friendCount, 10) || 0;

        /* Levi stolpec (bio + številke) ostane javen; zasebni zid velja le za desno (zavihki / pod-API). */
        if (!viewerHasFullAccess) {
            return res.json({
                id: user.id,
                username: user.username,
                email_verified: user.email_verified,
                bio: user.bio,
                avatarUrl: user.avatarUrl || null,
                createdAt: user.created_at,
                ...(viewerUserId != null && (Number(viewerUserId) === Number(userId) || canViewHidden)
                    ? { isSuspended: Boolean(user.is_suspended) }
                    : {}),
                isProfilePrivate,
                viewerHasFullAccess: false,
                visibility: {
                    showListingsOnProfile: Boolean(user.showListingsOnProfile),
                    showSupportOnProfile: Boolean(user.showSupportOnProfile),
                    showPostsOnProfile: Boolean(user.showPostsOnProfile),
                },
                stats: {
                    totalPosts: totalPostsStat,
                    totalLikes: parseInt(sr.totalLikes, 10) || 0,
                    totalComments: parseInt(sr.totalComments, 10) || 0,
                    friendCount: friendCountStat,
                    totalPostSupportReactions,
                    totalCommentSupportReactions,
                    totalSupportReactions: totalPostSupportReactions + totalCommentSupportReactions,
                    receivedSupportScore,
                },
                recentPosts: [],
            });
        }

        /* Objave: uporabi GET /api/users/:id/posts (straničenje). */
        const postsRows = [];

        res.json({
            id: user.id,
            username: user.username,
            email_verified: user.email_verified,
            bio: user.bio,
            avatarUrl: user.avatarUrl || null,
            createdAt: user.created_at,
            ...(viewerUserId != null && (Number(viewerUserId) === Number(userId) || canViewHidden)
                ? { isSuspended: Boolean(user.is_suspended) }
                : {}),
            isProfilePrivate,
            viewerHasFullAccess: true,
            visibility: {
                showListingsOnProfile: Boolean(user.showListingsOnProfile),
                showSupportOnProfile: Boolean(user.showSupportOnProfile),
                showPostsOnProfile: Boolean(user.showPostsOnProfile),
            },
            stats: {
                totalPosts: totalPostsStat,
                totalLikes: parseInt(sr.totalLikes, 10) || 0,
                totalComments: parseInt(sr.totalComments, 10) || 0,
                friendCount: friendCountStat,
                totalPostSupportReactions,
                totalCommentSupportReactions,
                totalSupportReactions: totalPostSupportReactions + totalCommentSupportReactions,
                receivedSupportScore
            },
            recentPosts: postsRows
        });
    } catch (err) {
        console.error("Napaka /api/users/:id:", err);
 sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka pri branju profila");
    }
});

module.exports = router;