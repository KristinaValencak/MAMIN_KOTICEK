/**
 * Deterministic display label "Anonim #N" from (postId, userId) for forum UX:
 * same person under the same post always gets the same number; different users
 * usually differ. Not a cryptographic guarantee — server could recompute mappings.
 */

function sqlSaltLiteral() {
    const raw = (process.env.ANON_PARTICIPANT_SALT || "mk-anon-v1").trim() || "mk-anon-v1";
    return raw.replace(/'/g, "''");
}

/**
 * SQL expression (no outer CASE): evaluates to the label string.
 * @param {string} postIdRef - e.g. "p.id", "c.post_id", or "post_id" in RETURNING
 * @param {string} userIdRef - e.g. "u.id" or "user_id"
 */
function anonParticipantLabelExpr(postIdRef, userIdRef) {
    const s = sqlSaltLiteral();
    return `'Anonim #' || (1 + mod(abs(hashtext(concat_ws(':', ${postIdRef}::text, ${userIdRef}::text, '${s}'))), 999998))::text`;
}

module.exports = {
    anonParticipantLabelExpr,
    sqlSaltLiteral,
};
