"use strict";

const { containsProfanity } = require("../services/profanityFilter");
const { sendJsonError, CODES } = require("../utils/apiError");

const PROFANITY_MESSAGE = "Uporaba neprimernega jezika ni dovoljena.";

/**
 * Blocks request with 400 if any listed body field (string) contains profanity.
 * Skips missing or non-string fields so routes keep their own validation.
 * @param {...string} fieldNames
 * @returns {import("express").RequestHandler}
 */
function requireCleanContent(...fieldNames) {
  return (req, res, next) => {
    for (const field of fieldNames) {
      const v = req.body?.[field];
      if (typeof v !== "string") continue;
      if (containsProfanity(v)) {
        console.warn(
          JSON.stringify({
            event: "profanity_block",
            route: req.originalUrl || req.url,
            userId: req.user?.id ?? null,
          })
        );
        return sendJsonError(res, 400, CODES.PROFANITY_BLOCKED, PROFANITY_MESSAGE);
      }
    }
    next();
  };
}

module.exports = requireCleanContent;
