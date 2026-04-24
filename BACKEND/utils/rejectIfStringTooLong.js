"use strict";

const { sendJsonError, CODES } = require("./apiError");

/**
 * @returns {boolean} true če je odgovor že poslan (prekini obravnavo).
 */
function rejectIfStringTooLong(res, value, maxLen, labelSl, { useMessageKey: _useMessageKey } = {}) {
  if (value === undefined || value === null) return false;
  const s = typeof value === "string" ? value : String(value);
  if (s.length > maxLen) {
    const msg = `${labelSl} je predolgo (največ ${maxLen} znakov).`;
    sendJsonError(res, 400, CODES.VALIDATION_ERROR, msg);
    return true;
  }
  return false;
}

module.exports = { rejectIfStringTooLong };
