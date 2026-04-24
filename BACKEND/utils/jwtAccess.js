"use strict";

const jwt = require("jsonwebtoken");

const ACCESS_OPTIONS = { algorithms: ["HS256"] };

function getJwtSecret() {
  return process.env.JWT_SECRET;
}

function signAccessToken(payload) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET ni definiran");
  }
  const expiresIn = process.env.JWT_EXPIRES_IN || "2h";
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn });
}

function verifyAccessToken(token) {
  const secret = getJwtSecret();
  if (!secret) {
    throw new Error("JWT_SECRET ni definiran");
  }
  return jwt.verify(token, secret, ACCESS_OPTIONS);
}

function tryVerifyAccessToken(token) {
  if (!token) return null;
  try {
    return verifyAccessToken(token);
  } catch {
    return null;
  }
}

/** Align httpOnly cookie maxAge with `JWT_EXPIRES_IN` (supports h, d, m, s suffix). */
function accessTokenCookieMaxAgeMs() {
  const s = String(process.env.JWT_EXPIRES_IN || "2h").trim();
  const n = parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return 2 * 60 * 60 * 1000;
  if (/^\d+h$/i.test(s)) return n * 60 * 60 * 1000;
  if (/^\d+d$/i.test(s)) return n * 24 * 60 * 60 * 1000;
  if (/^\d+m$/i.test(s)) return n * 60 * 1000;
  if (/^\d+s$/i.test(s)) return n * 1000;
  return 2 * 60 * 60 * 1000;
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  tryVerifyAccessToken,
  accessTokenCookieMaxAgeMs,
  ACCESS_OPTIONS,
};
