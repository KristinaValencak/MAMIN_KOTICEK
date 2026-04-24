"use strict";

const crypto = require("crypto");
const { sendJsonError, CODES } = require("../utils/apiError");

function normalizeUserText(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function contentFingerprint(s) {
  return crypto.createHash("sha256").update(normalizeUserText(s), "utf8").digest("hex");
}

function assertReasonableLinkDensity(text, maxLinks = 5) {
  const n = (String(text).match(/https?:\/\//gi) || []).length;
  if (n > maxLinks) {
    const err = new Error("LINK_SPAM");
    err.statusCode = 400;
    err.publicMessage = "Preveč povezav v besedilu.";
    throw err;
  }
}

function assertNoGreedyRepeat(text) {
  if (/(.)\1{40}/.test(String(text))) {
    const err = new Error("REPEAT_SPAM");
    err.statusCode = 400;
    err.publicMessage = "Besedilo vsebuje preveč ponavljanj.";
    throw err;
  }
}

function assertTextHeuristics(text, maxLinks = 5) {
  assertReasonableLinkDensity(text, maxLinks);
  assertNoGreedyRepeat(text);
}

/**
 * @param {import("pg").Pool | import("pg").PoolClient} q
 */
async function assertMessageSpamOk(q, senderId, contentTrim) {
  assertTextHeuristics(contentTrim, 5);
  const dup = await q.query(
    `SELECT 1 FROM messages
     WHERE sender_id = $1 AND content = $2 AND created_at > NOW() - INTERVAL '2 minutes'
     LIMIT 1`,
    [senderId, contentTrim]
  );
  if (dup.rowCount > 0) {
    const err = new Error("DUPLICATE");
    err.statusCode = 409;
    err.publicMessage = "To vsebino si nedavno že poslala. Počakaj malo.";
    throw err;
  }
  const flood = await q.query(
    `SELECT COUNT(*)::int AS c FROM messages
     WHERE sender_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [senderId]
  );
  const c = Number(flood.rows?.[0]?.c || 0);
  if (c >= 15) {
    const err = new Error("FLOOD");
    err.statusCode = 429;
    err.publicMessage = "Pošiljaš sporočila prehitro. Počakaj malo.";
    throw err;
  }
}

/**
 * @param {import("pg").Pool | import("pg").PoolClient} q
 */
async function assertCommentSpamOk(q, userId, postId, parentCommentId, contentTrim) {
  assertTextHeuristics(contentTrim, 5);
  const dupParams =
    parentCommentId == null
      ? [userId, postId, contentTrim]
      : [userId, postId, parentCommentId, contentTrim];
  const dupSql =
    parentCommentId == null
      ? `SELECT 1 FROM comments
         WHERE user_id = $1 AND post_id = $2 AND parent_comment_id IS NULL
           AND content = $3 AND created_at > NOW() - INTERVAL '2 minutes'
         LIMIT 1`
      : `SELECT 1 FROM comments
         WHERE user_id = $1 AND post_id = $2 AND parent_comment_id = $3
           AND content = $4 AND created_at > NOW() - INTERVAL '2 minutes'
         LIMIT 1`;
  const dup = await q.query(dupSql, dupParams);
  if (dup.rowCount > 0) {
    const err = new Error("DUPLICATE");
    err.statusCode = 409;
    err.publicMessage = "Ta komentar si nedavno že objavila. Počakaj malo.";
    throw err;
  }
  const flood = await q.query(
    `SELECT COUNT(*)::int AS c FROM comments
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [userId]
  );
  const fc = Number(flood.rows?.[0]?.c || 0);
  if (fc >= 20) {
    const err = new Error("FLOOD");
    err.statusCode = 429;
    err.publicMessage = "Objavljaš komentarje prehitro. Počakaj malo.";
    throw err;
  }
}

/**
 * @param {import("pg").Pool | import("pg").PoolClient} q
 */
async function assertPostSpamOk(q, userId, titleTrim, contentTrim) {
  assertTextHeuristics(titleTrim + "\n" + contentTrim, 5);
  const dup = await q.query(
    `SELECT 1 FROM posts
     WHERE user_id = $1 AND title = $2 AND content = $3
       AND created_at > NOW() - INTERVAL '5 minutes'
     LIMIT 1`,
    [userId, titleTrim, contentTrim]
  );
  if (dup.rowCount > 0) {
    const err = new Error("DUPLICATE");
    err.statusCode = 409;
    err.publicMessage = "To objavo si nedavno že objavila. Počakaj malo.";
    throw err;
  }
  const flood = await q.query(
    `SELECT COUNT(*)::int AS c FROM posts
     WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 minute'`,
    [userId]
  );
  const pc = Number(flood.rows?.[0]?.c || 0);
  if (pc >= 5) {
    const err = new Error("FLOOD");
    err.statusCode = 429;
    err.publicMessage = "Objavljaš prehitro. Počakaj malo.";
    throw err;
  }
}

function spamErrorCode(err) {
  const name = err && err.message;
  if (name === "LINK_SPAM") return CODES.LINK_SPAM;
  if (name === "REPEAT_SPAM") return CODES.REPEAT_SPAM;
  if (name === "DUPLICATE") return CODES.DUPLICATE_CONTENT;
  if (name === "FLOOD") return CODES.CONTENT_FLOOD;
  return CODES.VALIDATION_ERROR;
}

function sendSpamError(res, err) {
  const status = err.statusCode || 429;
  const msg = err.publicMessage || "Zahteva zavrnjena.";
  return sendJsonError(res, status, spamErrorCode(err), msg);
}

module.exports = {
  normalizeUserText,
  contentFingerprint,
  assertReasonableLinkDensity,
  assertNoGreedyRepeat,
  assertTextHeuristics,
  assertMessageSpamOk,
  assertCommentSpamOk,
  assertPostSpamOk,
  sendSpamError,
};
