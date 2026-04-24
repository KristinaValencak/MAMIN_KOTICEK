const db = require("../config/database");

async function userHasPermission(userId, permissionCode) {
    if (!userId) return false;
    const admin = await db.query("SELECT is_admin FROM users WHERE id = $1", [userId]);
    if (admin.rows[0]?.is_admin) return true;
    const { rows } = await db.query(
        `SELECT 1
         FROM user_roles ur
         JOIN role_permissions rp ON rp.role_id = ur.role_id
         JOIN permissions perm ON perm.id = rp.permission_id
         WHERE ur.user_id = $1 AND perm.code = $2
         LIMIT 1`,
        [userId, permissionCode]
    );
    return rows.length > 0;
}

/** True if user may see moderated (hidden) posts/comments in public API responses (same as moderation.reports.read). */
async function canViewHiddenContent(userId) {
    return userHasPermission(userId, "moderation.reports.read");
}

/**
 * For /api/users/me: roles, effective permission codes (admin ⇒ all rows in permissions).
 * Returns null if user id missing in DB.
 */
async function getSessionAuthz(userId) {
    const userRow = await db.query("SELECT is_admin FROM users WHERE id = $1", [userId]);
    if (userRow.rowCount === 0) return null;
    const isAdmin = Boolean(userRow.rows[0].is_admin);

    const rolesRes = await db.query(
        `SELECT r.id, r.name, r.description
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1
         ORDER BY r.name ASC`,
        [userId]
    );

    let permissions;
    if (isAdmin) {
        const p = await db.query(`SELECT code FROM permissions ORDER BY code ASC`);
        permissions = p.rows.map((x) => x.code);
    } else {
        const p = await db.query(
            `SELECT DISTINCT perm.code
             FROM user_roles ur
             JOIN role_permissions rp ON rp.role_id = ur.role_id
             JOIN permissions perm ON perm.id = rp.permission_id
             WHERE ur.user_id = $1
             ORDER BY perm.code ASC`,
            [userId]
        );
        permissions = p.rows.map((x) => x.code);
    }

    return {
        isAdmin,
        roles: rolesRes.rows.map((r) => ({
            id: Number(r.id),
            name: r.name,
            description: r.description ?? null,
        })),
        permissions,
    };
}

module.exports = { userHasPermission, canViewHiddenContent, getSessionAuthz };
