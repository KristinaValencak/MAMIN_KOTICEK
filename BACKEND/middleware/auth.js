const { verifyAccessToken } = require("../utils/jwtAccess");
const { sendJsonError, CODES } = require("../utils/apiError");
const db = require("../config/database");

function requireAuth(req, res, next) {
    const token = req.cookies.token || (req.headers["authorization"]?.split(" ")[1]);

    if (!token) {
        return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Manjka token");
    }

    try {
        const payload = verifyAccessToken(token);
        req.user = payload;
        (async () => {
            try {
                const userId = req.user?.id;
                if (!userId) return next();
                const { rows } = await db.query(`SELECT is_suspended FROM users WHERE id = $1`, [userId]);
                const isSuspended = Boolean(rows[0]?.is_suspended);
                req.user.isSuspended = isSuspended;
                if (!isSuspended) return next();
                // Suspend: allow safe reads (GET), block writes (non-GET) by default.
                if (req.method && req.method.toUpperCase() === "GET") return next();
                // Allow appeals submission while suspended (so user can request review).
                const m = req.method ? req.method.toUpperCase() : "";
                const p = (req.path || "").toString();
                const full = (req.originalUrl || "").toString();

                // Note: depending on router mounting, `req.path` may be e.g. "/appeals" (without "/api/moderation").
                // Use `originalUrl` to match full paths safely.
                if (m === "POST" && (p === "/api/moderation/appeals" || p === "/appeals" || full.endsWith("/api/moderation/appeals"))) return next();

                // Allow marking notifications as read while suspended (UX: user can consume moderation notices).
                if (m === "PUT" && (p === "/read-all" || full.endsWith("/api/notifications/read-all"))) return next();
                if (m === "PUT" && (p === "/read-likes" || full.endsWith("/api/notifications/read-likes"))) return next();
                if (m === "PUT" && (/^\/[^/]+\/read$/.test(p) || /\/api\/notifications\/[^/]+\/read$/.test(full))) return next();
                return sendJsonError(res, 403, CODES.USER_SUSPENDED, "Račun je začasno onemogočen.");
            } catch (err) {
                console.error("auth suspended check failed:", err);
                // Production stance: if we can't verify suspension status (DB outage),
                // allow safe reads (GET) but fail-closed for writes to avoid abuse.
                req.user.isSuspended = false;
                req.user.suspendedCheckFailed = true;
                if ((req.method || "").toUpperCase() === "GET") return next();
                return sendJsonError(res, 503, CODES.INTERNAL_ERROR, "Storitev trenutno ni na voljo. Poskusite znova.");
            }
        })();
    } catch (err) {
        return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven ali potekel token");
    }
}

module.exports = requireAuth;
