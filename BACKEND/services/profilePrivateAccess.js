const db = require("../config/database");

/**
 * Potrjeno prijateljstvo (tabela friends: user_id_1 < user_id_2).
 * @param {unknown} userIdA
 * @param {unknown} userIdB
 * @returns {Promise<boolean>}
 */
async function areFriends(userIdA, userIdB) {
    const a = Number(userIdA);
    const b = Number(userIdB);
    if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return false;
    const lo = Math.min(a, b);
    const hi = Math.max(a, b);
    const { rowCount } = await db.query(
        "SELECT 1 FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2 LIMIT 1",
        [lo, hi]
    );
    return rowCount > 0;
}

/**
 * Ali lahko ogledovalec vidi vsebino javnega profila čez zastavec zasebnosti (bio, objave, prijatelji, …).
 * @param {unknown} viewerUserId
 * @param {unknown} profileUserId
 * @param {boolean} isProfilePrivate
 * @returns {Promise<boolean>}
 */
async function viewerPassesPrivateProfileWall(viewerUserId, profileUserId, isProfilePrivate) {
    if (!isProfilePrivate) return true;
    const pid = Number(profileUserId);
    if (!Number.isFinite(pid)) return false;
    if (viewerUserId == null) return false;
    const v = Number(viewerUserId);
    if (!Number.isFinite(v)) return false;
    if (v === pid) return true;
    return areFriends(v, pid);
}

module.exports = { areFriends, viewerPassesPrivateProfileWall };
