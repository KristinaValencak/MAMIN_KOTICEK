const db = require("../config/database");

const TARGET_TYPES = new Set(["post", "comment", "marketplace_listing", "user_profile"]);

/** Uporabnik ne sme ponovno prijaviti iste tarče, dokler ima lastna prijava status pending ali reviewed. */
const DUPLICATE_ACTIVE_REPORT_CODE = "DUPLICATE_ACTIVE_REPORT";

const DUPLICATE_ACTIVE_REPORT_MESSAGE =
    "To vsebino ste že prijavili. Novo prijavo lahko pošljete, ko moderator zaključi prejšnjo (po pregledu, prezrtju ali drugi odločitvi).";

async function hasActiveReportFromReporter({ reporterUserId, targetType, targetId }) {
    const { rows } = await db.query(
        `SELECT id FROM content_reports
         WHERE reporter_user_id = $1 AND target_type = $2 AND target_id = $3
           AND status IN ('pending', 'reviewed')
         LIMIT 1`,
        [reporterUserId, targetType, targetId]
    );
    return rows.length > 0;
}

async function insertContentReport({ reporterUserId, targetType, targetId, reason }) {
    if (!TARGET_TYPES.has(targetType)) {
        throw new Error(`Invalid targetType: ${targetType}`);
    }
    const { rows } = await db.query(
        `INSERT INTO content_reports (reporter_user_id, target_type, target_id, reason)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [reporterUserId, targetType, targetId, reason.trim()]
    );
    return rows[0]?.id ?? null;
}

async function logModeration({
    actorUserId,
    action,
    reportId = null,
    targetType = null,
    targetId = null,
    metadata = {},
    client = null,
}) {
    const params = [
        actorUserId,
        action,
        reportId,
        targetType,
        targetId != null ? targetId : null,
        JSON.stringify(metadata && typeof metadata === "object" ? metadata : {}),
    ];
    const sql = `INSERT INTO moderation_logs (actor_user_id, action, report_id, target_type, target_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`;
    if (client) {
        await client.query(sql, params);
    } else {
        await db.query(sql, params);
    }
}

async function recordUserReport({ reporterUserId, targetType, targetId, reason }) {
    const duplicate = await hasActiveReportFromReporter({ reporterUserId, targetType, targetId });
    if (duplicate) {
        const err = new Error(DUPLICATE_ACTIVE_REPORT_CODE);
        err.code = DUPLICATE_ACTIVE_REPORT_CODE;
        throw err;
    }
    const id = await insertContentReport({ reporterUserId, targetType, targetId, reason });
    if (id != null) {
        await logModeration({
            actorUserId: reporterUserId,
            action: "report_created",
            reportId: id,
            targetType,
            targetId,
            metadata: {},
        });
    }
    return id;
}

module.exports = {
    insertContentReport,
    logModeration,
    recordUserReport,
    hasActiveReportFromReporter,
    TARGET_TYPES,
    DUPLICATE_ACTIVE_REPORT_CODE,
    DUPLICATE_ACTIVE_REPORT_MESSAGE,
};
