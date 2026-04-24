"use strict";

const CODES = require("../constants/errorCodes");

/**
 * @param {import("express").Response} res
 * @param {number} status
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [extras] — dodatna polja ob odgovoru (npr. `emailVerified` ob 403 prijavi).
 */
function sendJsonError(res, status, code, message, extras) {
  const body = {
    success: false,
    error: {
      code,
      message: String(message || ""),
    },
  };
  if (extras && typeof extras === "object") {
    Object.assign(body, extras);
  }
  return res.status(status).json(body);
}

/** Telo za express-rate-limit `message` (429). */
function rateLimitBody(message) {
  return {
    success: false,
    error: {
      code: CODES.RATE_LIMIT,
      message: String(message || "Preveč zahtev. Poskusi znova kasneje."),
    },
  };
}

/**
 * @param {import("express").Response} res
 * @param {number} [status=500]
 */
function sendInternalError(res, status = 500) {
  return sendJsonError(
    res,
    status,
    CODES.INTERNAL_ERROR,
    "Prišlo je do napake na strežniku. Poskusi znova kasneje."
  );
}

module.exports = {
  sendJsonError,
  rateLimitBody,
  sendInternalError,
  CODES,
};
