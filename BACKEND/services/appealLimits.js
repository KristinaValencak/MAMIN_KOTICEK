const db = require("../config/database");

/** Skupno število zahtev na isto tarčo (vse zaporedne pritožbe). */
const MAX_APPEALS_PER_TARGET = 3;

/** Dni počitka po zadnji odločitvi „vsebina ostane skrita“, preden je dovoljena nova zahteva. */
const UPHELD_COOLDOWN_DAYS = 30;

/**
 * @param {import("pg").Pool | import("pg").PoolClient} q — db ali transakcijski client
 * @param {string} targetType
 * @param {number} targetId
 * @returns {Promise<{ ok: true } | { ok: false, status: number, error: string }>}
 */
async function assertCanCreateAppeal(q, targetType, targetId) {
    const cnt = await q.query(
        `SELECT COUNT(*)::int AS c FROM moderation_appeals WHERE target_type = $1 AND target_id = $2`,
        [targetType, targetId]
    );
    const n = cnt.rows[0]?.c ?? 0;
    if (n >= MAX_APPEALS_PER_TARGET) {
        return {
            ok: false,
            status: 429,
            error: `Na to vsebino lahko skupaj oddate največ ${MAX_APPEALS_PER_TARGET} zahteve za pregled.`,
        };
    }

    const cool = await q.query(
        `WITH last AS (
            SELECT status, resolved_at
            FROM moderation_appeals
            WHERE target_type = $1 AND target_id = $2
              AND status IN ('resolved_upheld', 'resolved_reversed')
            ORDER BY COALESCE(resolved_at, created_at) DESC, id DESC
            LIMIT 1
        )
        SELECT resolved_at FROM last
        WHERE status = 'resolved_upheld'
          AND resolved_at IS NOT NULL
          AND resolved_at + (INTERVAL '1 day' * $3::int) > CURRENT_TIMESTAMP`,
        [targetType, targetId, UPHELD_COOLDOWN_DAYS]
    );

    if (cool.rowCount > 0) {
        const until = new Date(cool.rows[0].resolved_at);
        until.setUTCDate(until.getUTCDate() + UPHELD_COOLDOWN_DAYS);
        const human = until.toLocaleDateString("sl-SI", { day: "numeric", month: "long", year: "numeric" });
        return {
            ok: false,
            status: 429,
            error: `Po odločitvi, da vsebina ostane skrita, lahko znova zaprosite za pregled najprej po ${human}.`,
        };
    }

    return { ok: true };
}

/**
 * Za prikaz lastniku (GET objave): ali sme še oddati zahtevo.
 * @returns {Promise<{ canAppeal: boolean, appealBlockReason: string | null }>}
 */
async function getAppealEligibilityForTarget(targetType, targetId) {
    const r = await assertCanCreateAppeal(db, targetType, targetId);
    if (r.ok) {
        return { canAppeal: true, appealBlockReason: null };
    }
    return { canAppeal: false, appealBlockReason: r.error };
}

module.exports = {
    assertCanCreateAppeal,
    getAppealEligibilityForTarget,
    MAX_APPEALS_PER_TARGET,
    UPHELD_COOLDOWN_DAYS,
};
