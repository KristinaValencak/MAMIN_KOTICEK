const requireAuth = require("./auth");
const { userHasPermission } = require("../services/permissions");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");

/**
 * @param {string} permissionCode e.g. moderation.reports.read
 * @returns {[typeof requireAuth, import("express").RequestHandler]}
 */
function requirePermission(permissionCode) {
    return [
        requireAuth,
        async (req, res, next) => {
            try {
                const ok = await userHasPermission(req.user.id, permissionCode);
                if (!ok) {
                    return sendJsonError(res, 403, CODES.FORBIDDEN, "Nimate dovoljenja za to dejanje.");
                }
                next();
            } catch (err) {
                console.error("requirePermission:", err);
                return sendInternalError(res);
            }
        },
    ];
}

module.exports = requirePermission;
