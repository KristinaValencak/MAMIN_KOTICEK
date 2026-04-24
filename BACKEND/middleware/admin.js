const requireAuth = require("./auth");
const db = require("../config/database");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");

async function requireAdmin(req, res, next) {
    requireAuth(req, res, async () => {
        try {
            const { rows } = await db.query(
                "SELECT is_admin FROM users WHERE id = $1",
                [req.user.id]
            );

            if (rows.length === 0 || !rows[0].is_admin) {
                return sendJsonError(res, 403, CODES.ADMIN_REQUIRED, "Nimate admin dovoljenj");
            }

            next();
        } catch (err) {
            console.error("Napaka pri preverjanju admin dovoljenj:", err);
            return sendInternalError(res);
        }
    });
}

module.exports = requireAdmin;