const { tryVerifyAccessToken } = require("../utils/jwtAccess");
const db = require("../config/database");
const { canViewHiddenContent } = require("./permissions");

async function parseViewerUserId(req) {
    const auth = req.headers["authorization"];
    const cookieToken = req.cookies?.token;
    const bearer = auth ? auth.split(" ")[1] : null;
    const token = cookieToken || bearer;
    if (!token) return null;
    const payload = tryVerifyAccessToken(token);
    return payload?.id ?? null;
}

/** Post row { id, user_id, is_hidden } or null if missing or not visible to viewer. */
async function loadPostIfReadable(postId, viewerUserId) {
    const canViewHidden = viewerUserId ? await canViewHiddenContent(viewerUserId) : false;
    const { rows } = await db.query(
        `SELECT p.id, p.user_id, p.is_hidden
         FROM posts p
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
        [postId, viewerUserId, canViewHidden]
    );
    return rows[0] || null;
}

/**
 * Comment visible to viewer only if comment rules pass AND parent post is readable.
 * Returns { id, user_id, post_id, is_hidden } or null.
 */
async function loadCommentIfReadable(commentId, viewerUserId) {
    const canViewHidden = viewerUserId ? await canViewHiddenContent(viewerUserId) : false;
    const { rows } = await db.query(
        `SELECT c.id, c.user_id, c.post_id, c.is_hidden
         FROM comments c
         WHERE c.id = $1
           AND c.status <> 'deleted'
           AND c.deleted_at IS NULL
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
        [commentId, viewerUserId, canViewHidden]
    );
    const c = rows[0];
    if (!c) return null;
    const post = await loadPostIfReadable(c.post_id, viewerUserId);
    if (!post) return null;
    return c;
}

module.exports = {
    parseViewerUserId,
    loadPostIfReadable,
    loadCommentIfReadable,
};
