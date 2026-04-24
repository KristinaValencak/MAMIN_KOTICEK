const express = require("express");
const router = express.Router();
const db = require("../config/database");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const emailService = require("../services/emailService");
const { signAccessToken, accessTokenCookieMaxAgeMs } = require("../utils/jwtAccess");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const {
    loginIpLimiter,
    registerIpLimiter,
    forgotPasswordIpLimiter,
    resendVerificationIpLimiter,
    resetPasswordIpLimiter,
    verifyEmailGetIpLimiter,
} = require("../middleware/rateLimiters");
const L = require("../constants/inputLimits");
const { rejectIfStringTooLong } = require("../utils/rejectIfStringTooLong");

function normalizeSameSite(value) {
    if (!value) return null;
    const v = String(value).trim().toLowerCase();
    if (v === "none") return "none";
    if (v === "lax") return "lax";
    if (v === "strict") return "strict";
    return null;
}

function buildAuthCookieOptions() {
    const isProd = process.env.NODE_ENV === "production";
    const sameSite = normalizeSameSite(process.env.COOKIE_SAMESITE) || (isProd ? "none" : "lax");
    const secure = sameSite === "none" ? true : isProd;
    const domainRaw = String(process.env.COOKIE_DOMAIN || "").trim();

    const opts = {
        httpOnly: true,
        secure,
        sameSite,
        maxAge: accessTokenCookieMaxAgeMs(),
        path: "/",
    };

    if (domainRaw) opts.domain = domainRaw;
    return opts;
}

router.post("/register", registerIpLimiter, async (req, res) => {
    try {
        const { username, email, password, privacyPolicyAccepted } = req.body;
        if (!username || !email || !password) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Manjkajo podatki.");
        }

        const uTrim = String(username).trim();
        if (uTrim.length < L.USERNAME_MIN) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                `Uporabniško ime mora imeti vsaj ${L.USERNAME_MIN} znake.`
            );
        }
        if (rejectIfStringTooLong(res, uTrim, L.USERNAME_MAX, "Uporabniško ime", { useMessageKey: true })) return;
        if (rejectIfStringTooLong(res, String(email).trim(), L.EMAIL, "Email", { useMessageKey: true })) return;
        if (rejectIfStringTooLong(res, password, L.PASSWORD_MAX, "Geslo", { useMessageKey: true })) return;

        if (!privacyPolicyAccepted) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Sprejeti moraš politiko zasebnosti.");
        }

        const eTrim = String(email).trim();

        const check = await db.query(
            "SELECT id FROM users WHERE lower(email) = lower($1) OR lower(username) = lower($2)",
            [eTrim, uTrim]
        );
        if (check.rowCount > 0) {
            return sendJsonError(
                res,
                409,
                CODES.CONFLICT,
                "Uporabnik z emailom ali uporabniškim imenom že obstaja."
            );
        }

        const hash = await bcrypt.hash(password, 12);

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        const result = await db.query(
            `INSERT INTO users (username, email, password_hash, email_verified, verification_token, verification_token_expires, privacy_policy_accepted, privacy_policy_accepted_at) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW()) 
         RETURNING id, username, email, email_verified`,
            [uTrim, eTrim, hash, false, verificationToken, tokenExpires, privacyPolicyAccepted]
        );

        const user = result.rows[0];

        try {
            await emailService.sendVerificationEmail(user.email, user.username, verificationToken);
        } catch (emailError) {
            console.error("Error sending verification email:", emailError);
        }

        return res.status(201).json({
            id: user.id,
            username: user.username,
            email: user.email,
            emailVerified: user.email_verified,
            message: "Registracija uspešna! Preveri svoj email za verifikacijsko povezavo."
        });
    } catch (err) {
        console.error("Napaka pri registraciji:", err);
        return sendInternalError(res);
    }
});


router.post("/login", loginIpLimiter, async (req, res) => {
    try {
        const { identifier, password } = req.body;
        if (!identifier || !password) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Manjkajo podatki.");
        }
        if (rejectIfStringTooLong(res, identifier, L.LOGIN_IDENTIFIER, "Prijavni podatek", { useMessageKey: true })) return;
        if (rejectIfStringTooLong(res, password, L.PASSWORD_MAX, "Geslo", { useMessageKey: true })) return;

        const q = `
        SELECT id, username, email, password_hash, email_verified, is_admin,
               avatar_url AS "avatarUrl"
        FROM users
        WHERE lower(email) = lower($1) OR lower(username) = lower($1)
        LIMIT 1
      `;
        const r = await db.query(q, [identifier]);
        if (r.rowCount === 0) {
            return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Napačni prijavni podatki.");
        }

        const user = r.rows[0];
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Napačni prijavni podatki.");
        }

        if (!user.email_verified) {
            return sendJsonError(
                res,
                403,
                CODES.FORBIDDEN,
                "Email še ni verificiran. Preveri svoj email za verifikacijsko povezavo.",
                { emailVerified: false, email: user.email }
            );
        }

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET ni definiran!");
            return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka v konfiguraciji.");
        }

        const token = signAccessToken({
            id: user.id,
            username: user.username,
            email: user.email,
        });

        res.cookie("token", token, buildAuthCookieOptions());

        return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: user.is_admin,
            avatarUrl: user.avatarUrl || null
        });
    } catch (err) {
        console.error("Napaka pri prijavi:", err);
        return sendInternalError(res);
    }
});

router.get("/verify-email", verifyEmailGetIpLimiter, async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Manjka verifikacijski token.");
        }
        if (String(token).length > L.LONG_TOKEN) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven verifikacijski token.");
        }

        const result = await db.query(
            `SELECT id, username, email, verification_token, verification_token_expires 
         FROM users 
         WHERE verification_token = $1 AND email_verified = false`,
            [token]
        );

        if (result.rowCount === 0) {
            const verifiedCheck = await db.query(
                `SELECT id, username, email, email_verified 
           FROM users 
           WHERE email_verified = true 
           ORDER BY id DESC LIMIT 1`
            );

            if (verifiedCheck.rowCount > 0) {
                return sendJsonError(
                    res,
                    400,
                    CODES.VALIDATION_ERROR,
                    "Ta povezava je že bila uporabljena. Tvoj email je že verificiran. Prijavi se!",
                    { alreadyVerified: true }
                );
            }

            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven ali že uporabljen verifikacijski token.");
        }

        const user = result.rows[0];

        if (new Date() > new Date(user.verification_token_expires)) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                "Verifikacijski token je potekel. Prosim registriraj se ponovno."
            );
        }

        await db.query(
            `UPDATE users 
         SET email_verified = true, verification_token = NULL, verification_token_expires = NULL 
         WHERE id = $1`,
            [user.id]
        );

        if (!process.env.JWT_SECRET) {
            console.error("JWT_SECRET ni definiran!");
            return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka v konfiguraciji.");
        }

        const jwtToken = signAccessToken({
            id: user.id,
            username: user.username,
            email: user.email,
        });

        res.cookie("token", jwtToken, buildAuthCookieOptions());

        const userWithAdmin = await db.query(
            'SELECT is_admin, avatar_url AS "avatarUrl" FROM users WHERE id = $1',
            [user.id]
        );

        const row = userWithAdmin.rows[0] || {};
        return res.json({
            id: user.id,
            username: user.username,
            email: user.email,
            isAdmin: row.is_admin || false,
            avatarUrl: row.avatarUrl || null,
            message: "Email uspešno verificiran!"
        });
    } catch (err) {
        console.error("❌ Napaka pri verifikaciji emaila:", err);
        return sendInternalError(res);
    }
});

router.post("/logout", (req, res) => {
    const { maxAge, ...cookieScope } = buildAuthCookieOptions();
    res.clearCookie("token", cookieScope);
    return res.json({ message: "Uspešna odjava" });
});

router.post("/resend-verification", resendVerificationIpLimiter, async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Email je obvezen.");
        }
        if (rejectIfStringTooLong(res, String(email).trim(), L.EMAIL, "Email", { useMessageKey: true })) return;

        const result = await db.query(
            "SELECT id, username, email, email_verified FROM users WHERE lower(email) = lower($1)",
            [String(email).trim()]
        );

        if (result.rowCount === 0) {
            return sendJsonError(res, 404, CODES.NOT_FOUND, "Uporabnik s tem emailom ne obstaja.");
        }

        const user = result.rows[0];

        if (user.email_verified) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Email je že verificiran.");
        }

        const verificationToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await db.query(
            "UPDATE users SET verification_token = $1, verification_token_expires = $2 WHERE id = $3",
            [verificationToken, tokenExpires, user.id]
        );

        await emailService.sendVerificationEmail(user.email, user.username, verificationToken);

        return res.json({ message: "Verifikacijski email je bil ponovno poslan." });
    } catch (err) {
        console.error("Napaka pri ponovnem pošiljanju emaila:", err);
        return sendInternalError(res);
    }
});

router.post("/forgot-password", forgotPasswordIpLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Email je obvezen.");
        }
        if (rejectIfStringTooLong(res, String(email).trim(), L.EMAIL, "Email", { useMessageKey: true })) return;

        const { rows } = await db.query(
            "SELECT id, username, email FROM users WHERE lower(email) = lower($1)",
            [String(email).trim()]
        );

        if (rows.length === 0) {
            return res.status(200).json({
                message: "Če email obstaja v naši bazi, poslali bomo navodila za ponastavitev gesla."
            });
        }

        const user = rows[0];

        const resetToken = crypto.randomBytes(32).toString('hex');
        const tokenExpires = new Date(Date.now() + 60 * 60 * 1000);

        await db.query(
            "UPDATE users SET reset_token = $1, reset_token_expires = $2 WHERE id = $3",
            [resetToken, tokenExpires, user.id]
        );

        try {
            await emailService.sendPasswordResetEmail(user.email, user.username, resetToken);
        } catch (emailError) {
            console.error("Error sending password reset email:", emailError);
        }

        return res.status(200).json({
            message: "Če email obstaja v naši bazi, poslali bomo navodila za ponastavitev gesla."
        });
    } catch (err) {
        console.error("Napaka pri forgot-password:", err);
        return sendInternalError(res);
    }
});

router.post("/reset-password", resetPasswordIpLimiter, async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Token in geslo sta obvezna.");
        }
        if (rejectIfStringTooLong(res, token, L.LONG_TOKEN, "Token", { useMessageKey: true })) return;
        if (rejectIfStringTooLong(res, password, L.PASSWORD_MAX, "Geslo", { useMessageKey: true })) return;

        if (password.length < 8) {
            return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Geslo mora biti vsaj 8 znakov dolgo.");
        }

        const { rows } = await db.query(
            `SELECT id, reset_token_expires 
         FROM users 
         WHERE reset_token = $1 AND reset_token_expires > NOW()`,
            [token]
        );

        if (rows.length === 0) {
            return sendJsonError(
                res,
                400,
                CODES.VALIDATION_ERROR,
                "Token je neveljaven ali je potekel. Prosim zahtevaj nov link za ponastavitev gesla."
            );
        }

        const userId = rows[0].id;

        const hash = await bcrypt.hash(password, 12);

        await db.query(
            `UPDATE users 
         SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL 
         WHERE id = $2`,
            [hash, userId]
        );

        return res.status(200).json({
            message: "Geslo uspešno ponastavljeno. Sedaj se lahko prijaviš z novim geslom."
        });
    } catch (err) {
        console.error("Napaka pri reset-password:", err);
        return sendInternalError(res);
    }
});

module.exports = router;
