const db = require("../../config/database");
const { enqueueForNotification } = require("../push/pushDispatcher");

function normalizeType(t) {
  const v = String(t || "").trim();
  if (!v) return null;
  if (v.length > 40) return null;
  return v;
}

async function createNotification({
  recipientUserId,
  actorUserId,
  type,
  postId = null,
  commentId = null,
  threadId = null,
  messageId = null,
  appealId = null,
  friendRequestId = null,
  metadata = null,
  client = null,
}) {
  const ntype = normalizeType(type);
  if (!ntype) throw new Error("invalid_type");

  const q = client || db;
  let row = null;

  // Make friend-request related notifications idempotent (prevents duplicates on resend/retry).
  if ((ntype === "friend_request" || ntype === "friend_accept") && friendRequestId != null) {
    try {
      const res = await q.query(
        `INSERT INTO notifications (user_id, type, post_id, actor_id, comment_id, thread_id, message_id, appeal_id, friend_request_id, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (user_id, type, actor_id, friend_request_id)
         WHERE (type::text = 'friend_request' OR type::text = 'friend_accept')
           AND friend_request_id IS NOT NULL
         DO NOTHING
         RETURNING id, user_id AS "userId"`,
        [
          recipientUserId,
          ntype,
          postId,
          actorUserId,
          commentId,
          threadId,
          messageId,
          appealId,
          friendRequestId,
          metadata,
        ]
      );
      row = res.rows[0] || null;
    } catch (err) {
      // If the DB doesn't yet have the matching unique index, ON CONFLICT cannot be used.
      // Fall back to a regular insert so notifications still work.
      if (err && err.code === "42P10") {
        const res = await q.query(
          `INSERT INTO notifications (user_id, type, post_id, actor_id, comment_id, thread_id, message_id, appeal_id, friend_request_id, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING id, user_id AS "userId"`,
          [
            recipientUserId,
            ntype,
            postId,
            actorUserId,
            commentId,
            threadId,
            messageId,
            appealId,
            friendRequestId,
            metadata,
          ]
        );
        row = res.rows[0] || null;
      } else {
        throw err;
      }
    }

    if (!row) {
      const existing = await q.query(
        `SELECT id, user_id AS "userId"
         FROM notifications
         WHERE user_id = $1
           AND type::text = $4
           AND actor_id = $2
           AND friend_request_id = $3
         ORDER BY id DESC
         LIMIT 1`,
        [recipientUserId, actorUserId, friendRequestId, ntype]
      );
      return existing.rows[0] || null;
    }
  } else {
    const res = await q.query(
      `INSERT INTO notifications (user_id, type, post_id, actor_id, comment_id, thread_id, message_id, appeal_id, friend_request_id, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, user_id AS "userId"`,
      [
        recipientUserId,
        ntype,
        postId,
        actorUserId,
        commentId,
        threadId,
        messageId,
        appealId,
        friendRequestId,
        metadata,
      ]
    );
    row = res.rows[0];
  }

  // Best-effort enqueue (do not fail request path).
  try {
    await enqueueForNotification(row.id, row.userId, { client });
  } catch (err) {
    console.error("Failed to enqueue push outbox:", err);
  }

  return row;
}

async function createMany({
  recipientUserIds,
  actorUserId,
  type,
  postId = null,
  commentId = null,
  threadId = null,
  messageId = null,
  appealId = null,
  friendRequestId = null,
  metadata = null,
  client = null,
}) {
  const ntype = normalizeType(type);
  if (!ntype) throw new Error("invalid_type");
  const ids = (recipientUserIds || [])
    .map((x) => Number(x))
    .filter((x) => Number.isFinite(x) && Number.isInteger(x) && x > 0);
  if (!ids.length) return [];

  const q = client || db;
  const res = await q.query(
    `INSERT INTO notifications (user_id, type, post_id, actor_id, comment_id, thread_id, message_id, appeal_id, friend_request_id, metadata)
     SELECT x.user_id, $2, $3, $4, $5, $6, $7, $8, $9, $10
     FROM (SELECT UNNEST($1::int[]) AS user_id) x
     RETURNING id, user_id AS "userId"`,
    [
      ids,
      ntype,
      postId,
      actorUserId,
      commentId,
      threadId,
      messageId,
      appealId,
      friendRequestId,
      metadata,
    ]
  );

  // Enqueue best-effort
  for (const row of res.rows) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await enqueueForNotification(row.id, row.userId);
    } catch (err) {
      console.error("Failed to enqueue push outbox:", err);
    }
  }

  return res.rows;
}

module.exports = {
  createNotification,
  createMany,
};

