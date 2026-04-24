const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const L = require("../constants/inputLimits");
const {
  messageSendBurstUserLimiter,
  messageSendHourUserLimiter,
} = require("../middleware/rateLimiters");
const spamGuards = require("../services/spamGuards");
const { createNotification } = require("../services/notifications/notificationWriter");

const DECLINE_COOLDOWN_HOURS = Number(process.env.MESSAGE_DECLINE_COOLDOWN_HOURS || 168); // 7 days

/** JWT / body lahko vrnejo id kot niz; primerjave in vrstni red v bazi morajo biti številski. */
function authUserId(req) {
  const n = Number(req.user?.id);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

function normalizePair(a, b) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isNaN(na) || Number.isNaN(nb)) return [a, b];
  return na < nb ? [na, nb] : [nb, na];
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

async function areFriends(userId, otherId) {
  const [u1, u2] = normalizePair(userId, otherId);
  const res = await db.query(
    `SELECT 1 FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2`,
    [u1, u2]
  );
  return res.rowCount > 0;
}

async function isBlockedEitherDirection(a, b) {
  const res = await db.query(
    `SELECT 1 FROM user_blocks
     WHERE (blocker_id = $1 AND blocked_id = $2)
        OR (blocker_id = $2 AND blocked_id = $1)
     LIMIT 1`,
    [a, b]
  );
  return res.rowCount > 0;
}

async function getThreadIdForPair(userId, otherId) {
  const [u1, u2] = normalizePair(userId, otherId);
  const res = await db.query(
    `SELECT id
     FROM message_threads
     WHERE user_id_1 = $1 AND user_id_2 = $2
     LIMIT 1`,
    [u1, u2]
  );
  return res.rows?.[0]?.id ? Number(res.rows[0].id) : null;
}

async function getOrCreateThread(client, userId, otherId, { defaultStatus, requestedBy }) {
  const [u1, u2] = normalizePair(userId, otherId);
  const existing = await client.query(
    `SELECT id, user_id_1, user_id_2, status, requested_by, declined_at
     FROM message_threads
     WHERE user_id_1 = $1 AND user_id_2 = $2
     LIMIT 1`,
    [u1, u2]
  );
  if (existing.rowCount > 0) return existing.rows[0];

  const inserted = await client.query(
    `INSERT INTO message_threads (user_id_1, user_id_2, status, requested_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id_1, user_id_2)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, user_id_1, user_id_2, status, requested_by, declined_at`,
    [u1, u2, defaultStatus, requestedBy]
  );
  return inserted.rows[0];
}

async function canSendInThread(client, thread, senderId) {
  if (thread.status === "accepted") return { ok: true };

  if (thread.status === "declined") {
    if (!thread.declined_at) return { ok: false, error: "Pošiljanje ni dovoljeno (zahteva je bila zavrnjena)." };
    const cooldown = await client.query(
      `SELECT (NOW() - $1::timestamptz) < make_interval(hours => $2) AS in_cooldown`,
      [thread.declined_at, DECLINE_COOLDOWN_HOURS]
    );
    const inCooldown = Boolean(cooldown.rows?.[0]?.in_cooldown);
    if (inCooldown) {
      return { ok: false, error: "Uporabniku trenutno ne moreš ponovno poslati zahteve." };
    }
    return { ok: false, error: "Zahteva je bila zavrnjena. Ponovni stik trenutno ni omogočen." };
  }

  // pending: allow only requester to send only the first message
  if (thread.status === "pending") {
    if (Number(thread.requested_by) !== Number(senderId)) {
      return { ok: false, error: "Najprej sprejmi zahtevo za sporočila, da lahko odgovoriš." };
    }
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS c FROM messages WHERE thread_id = $1`,
      [thread.id]
    );
    const c = Number(countRes.rows?.[0]?.c || 0);
    if (c >= 1) {
      return { ok: false, error: "Zahteva za sporočila je že poslana. Počakaj na sprejem." };
    }
    return { ok: true };
  }

  return { ok: false, error: "Neveljaven status pogovora." };
}

// POST /api/messages/send
router.post(
  "/send",
  requireAuth,
  messageSendBurstUserLimiter,
  messageSendHourUserLimiter,
  async (req, res) => {
  const senderId = authUserId(req);
  if (senderId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const { content } = req.body;
  const receiverId = parsePositiveInt(req.body.receiverId);
  if (receiverId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "receiverId je obvezen in mora biti pozitivno celo število");
  }
  if (!content || typeof content !== "string" || content.trim().length === 0) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Vsebina sporočila je obvezna");
  }
  if (content.trim().length > L.CHAT_MESSAGE) {
    return sendJsonError(
      res,
      400,
      CODES.VALIDATION_ERROR,
      `Sporočilo je predolgo (največ ${L.CHAT_MESSAGE} znakov).`
    );
  }
  if (receiverId === senderId) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ne moreš pošiljati sporočil sam sebi");
  }

  try {
    if (await isBlockedEitherDirection(senderId, receiverId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Pošiljanje sporočil ni dovoljeno zaradi blokade");
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const friends = await areFriends(senderId, receiverId);
      const defaultStatus = friends ? "accepted" : "pending";
      const thread = await getOrCreateThread(client, senderId, receiverId, {
        defaultStatus,
        requestedBy: senderId,
      });

      // If friends became friends later, allow upgrading pending -> accepted implicitly
      if (friends && thread.status !== "accepted") {
        await client.query(
          `UPDATE message_threads
           SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [thread.id]
        );
        thread.status = "accepted";
      }

      const countBefore = await client.query(
        `SELECT COUNT(*)::int AS c FROM messages WHERE thread_id = $1`,
        [thread.id]
      );
      const nBefore = Number(countBefore.rows?.[0]?.c || 0);
      if (thread.status === "pending" && nBefore === 0) {
        const u1 = Number(thread.user_id_1);
        const u2 = Number(thread.user_id_2);
        if (senderId !== u1 && senderId !== u2) {
          await client.query("ROLLBACK");
          return sendJsonError(res, 403, CODES.FORBIDDEN, "Pogovor ni dovoljen");
        }
        await client.query(
          `UPDATE message_threads SET requested_by = $1, updated_at = NOW() WHERE id = $2`,
          [senderId, thread.id]
        );
        thread.requested_by = senderId;
      }

      const allowed = await canSendInThread(client, thread, senderId);
      if (!allowed.ok) {
        await client.query("ROLLBACK");
        return sendJsonError(res, 403, CODES.FORBIDDEN, allowed.error);
      }

      try {
        await spamGuards.assertMessageSpamOk(client, senderId, content.trim());
      } catch (spamErr) {
        // UX: if user clicks send twice, treat as idempotent instead of 409 Conflict.
        if (spamErr && spamErr.message === "DUPLICATE") {
          const existing = await client.query(
            `SELECT id, thread_id, sender_id, receiver_id, content, is_read, created_at
             FROM messages
             WHERE sender_id = $1 AND receiver_id = $2 AND thread_id = $3 AND content = $4
               AND created_at > NOW() - INTERVAL '2 minutes'
             ORDER BY created_at DESC, id DESC
             LIMIT 1`,
            [senderId, receiverId, thread.id, content.trim()]
          );
          await client.query("ROLLBACK");
          const msgRow = existing.rows?.[0] || null;
          return res.status(200).json({
            ok: true,
            duplicate: true,
            thread: {
              id: thread.id,
              status: thread.status,
              requested_by: Number(thread.requested_by),
            },
            message: msgRow
              ? {
                  ...msgRow,
                  sender_id: Number(msgRow.sender_id),
                  receiver_id: Number(msgRow.receiver_id),
                }
              : null,
          });
        }
        await client.query("ROLLBACK");
        return spamGuards.sendSpamError(res, spamErr);
      }

      const result = await client.query(
        `INSERT INTO messages (thread_id, sender_id, receiver_id, content)
         VALUES ($1, $2, $3, $4)
         RETURNING id, thread_id, sender_id, receiver_id, content, is_read, created_at`,
        [thread.id, senderId, receiverId, content.trim()]
      );

      await client.query(
        `UPDATE message_threads
         SET last_message_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [thread.id]
      );

      await client.query("COMMIT");
      const msgRow = result.rows[0];

      // Best-effort: store DB notification (source of truth) + enqueue push delivery.
      // Push delivery itself is async via outbox; failures must not affect message delivery.
      try {
        await createNotification({
          recipientUserId: receiverId,
          actorUserId: senderId,
          type: "message",
          threadId: Number(thread.id),
          messageId: Number(msgRow.id),
          metadata: { preview: String(content || "").slice(0, 120) },
        });
      } catch (notifErr) {
        console.error("Napaka pri ustvarjanju notifikacije (message):", notifErr);
      }

      return res.status(201).json({
        thread: {
          id: thread.id,
          status: thread.status,
          requested_by: Number(thread.requested_by),
        },
        message: {
          ...msgRow,
          sender_id: Number(msgRow.sender_id),
          receiver_id: Number(msgRow.receiver_id),
        },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Napaka /api/messages/send:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri pošiljanju sporočila");
  }
});

// GET /api/messages/thread-with/:userId
router.get("/thread-with/:userId", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const otherId = parseInt(req.params.userId, 10);
  if (Number.isNaN(otherId) || otherId < 1) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven userId");
  }
  if (otherId === userId) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Pogovor s samim seboj ni dovoljen");
  }
  try {
    if (await isBlockedEitherDirection(userId, otherId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Pogovor ni dovoljen zaradi blokade");
    }

    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const friends = await areFriends(userId, otherId);
      const defaultStatus = friends ? "accepted" : "pending";
      const thread = await getOrCreateThread(client, userId, otherId, {
        defaultStatus,
        requestedBy: userId,
      });
      if (friends && thread.status !== "accepted") {
        await client.query(
          `UPDATE message_threads
           SET status = 'accepted', updated_at = NOW()
           WHERE id = $1`,
          [thread.id]
        );
        thread.status = "accepted";
      }
      await client.query("COMMIT");

      const otherUser = await db.query(
        `SELECT id, username FROM users WHERE id = $1`,
        [otherId]
      );

      return res.json({
        thread,
        otherUser: otherUser.rows?.[0] || { id: otherId },
      });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Napaka /api/messages/thread-with:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri pripravi pogovora");
  }
});

// GET /api/messages/threads?tab=chats|requests|sent
router.get("/threads", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const tab = String(req.query.tab || "chats");
  if (tab !== "chats" && tab !== "requests" && tab !== "sent") {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven tab (chats|requests|sent)");
  }

  const threadLimit = Math.min(parseInt(req.query.limit || "50", 10), 100);
  const threadOffset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  try {
    let where = `(mt.user_id_1 = $1 OR mt.user_id_2 = $1)`;

    if (tab === "chats") {
      where += ` AND mt.status = 'accepted'`;
    } else if (tab === "requests") {
      where += ` AND mt.status = 'pending' AND mt.requested_by <> $1`;
    } else {
      // sent: ti si začel/a pogovor, druga stran še ni potrdila
      where += ` AND mt.status = 'pending' AND mt.requested_by = $1`;
    }

    const needsLastMessage = tab === "requests" || tab === "sent";

    const { rows } = await db.query(
      `SELECT
         mt.id AS "threadId",
         mt.status AS "status",
         mt.requested_by AS "requestedBy",
         CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END AS "otherUserId",
         u.username AS "otherUsername",
         lm.content AS "lastMessagePreview",
         lm.created_at AS "lastMessageAt",
         COALESCE(uc.unread_count, 0) AS "unreadCount"
       FROM message_threads mt
       JOIN users u
         ON u.id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END)
       LEFT JOIN LATERAL (
         SELECT m.content, m.created_at
         FROM messages m
         WHERE m.thread_id = mt.id
         ORDER BY m.created_at DESC
         LIMIT 1
       ) lm ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS unread_count
         FROM messages m
         WHERE m.thread_id = mt.id AND m.receiver_id = $1 AND m.is_read = FALSE
       ) uc ON TRUE
       WHERE ${where}
         AND NOT EXISTS (
           SELECT 1 FROM user_blocks ub
           WHERE (ub.blocker_id = $1 AND ub.blocked_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END))
              OR (ub.blocker_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END) AND ub.blocked_id = $1)
         )
         ${needsLastMessage ? "AND lm.created_at IS NOT NULL" : ""}
       ORDER BY COALESCE(lm.created_at, mt.updated_at) DESC
       LIMIT $2 OFFSET $3`,
      [userId, threadLimit, threadOffset]
    );

    const countSql =
      tab === "chats"
        ? `SELECT COUNT(*)::int AS c FROM message_threads mt WHERE (mt.user_id_1 = $1 OR mt.user_id_2 = $1) AND mt.status = 'accepted'
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $1 AND ub.blocked_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END))
                OR (ub.blocker_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END) AND ub.blocked_id = $1)
           )`
        : tab === "requests"
        ? `SELECT COUNT(*)::int AS c FROM message_threads mt
           LEFT JOIN LATERAL (
             SELECT m.created_at FROM messages m WHERE m.thread_id = mt.id ORDER BY m.created_at DESC LIMIT 1
           ) lm ON TRUE
           WHERE (mt.user_id_1 = $1 OR mt.user_id_2 = $1) AND mt.status = 'pending' AND mt.requested_by <> $1
           AND lm.created_at IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $1 AND ub.blocked_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END))
                OR (ub.blocker_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END) AND ub.blocked_id = $1)
           )`
        : `SELECT COUNT(*)::int AS c FROM message_threads mt
           LEFT JOIN LATERAL (
             SELECT m.created_at FROM messages m WHERE m.thread_id = mt.id ORDER BY m.created_at DESC LIMIT 1
           ) lm ON TRUE
           WHERE (mt.user_id_1 = $1 OR mt.user_id_2 = $1) AND mt.status = 'pending' AND mt.requested_by = $1
           AND lm.created_at IS NOT NULL
           AND NOT EXISTS (
             SELECT 1 FROM user_blocks ub
             WHERE (ub.blocker_id = $1 AND ub.blocked_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END))
                OR (ub.blocker_id = (CASE WHEN mt.user_id_1 = $1 THEN mt.user_id_2 ELSE mt.user_id_1 END) AND ub.blocked_id = $1)
           )`;

    const countRes = await db.query(countSql, [userId]);
    const total = parseInt(countRes.rows?.[0]?.c, 10) || 0;

    return res.json({
      items: rows,
      pagination: { limit: threadLimit, offset: threadOffset, total },
    });
  } catch (err) {
    console.error("Napaka /api/messages/threads:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju seznamov pogovorov");
  }
});

// POST /api/messages/requests/:threadId/accept
router.post("/requests/:threadId/accept", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const threadId = parsePositiveInt(req.params.threadId);
  if (threadId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven threadId");
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const tRes = await client.query(
      `SELECT id, status, requested_by
       FROM message_threads
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       FOR UPDATE`,
      [threadId, userId]
    );
    if (tRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Pogovor ne obstaja");
    }
    const t = tRes.rows[0];
    if (t.status !== "pending") {
      await client.query("ROLLBACK");
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Zahteva ni več v statusu pending");
    }
    if (Number(t.requested_by) === userId) {
      await client.query("ROLLBACK");
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Zahteve ne moreš sprejeti sam/a");
    }

    await client.query(
      `UPDATE message_threads
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1`,
      [threadId]
    );
    await client.query("COMMIT");
    return res.json({ message: "Zahteva sprejeta" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Napaka /api/messages/requests/:threadId/accept:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri sprejemu zahteve");
  } finally {
    client.release();
  }
});

// POST /api/messages/requests/:threadId/decline
router.post("/requests/:threadId/decline", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const threadId = parsePositiveInt(req.params.threadId);
  if (threadId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven threadId");
  }
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const tRes = await client.query(
      `SELECT id, status, requested_by
       FROM message_threads
       WHERE id = $1 AND (user_id_1 = $2 OR user_id_2 = $2)
       FOR UPDATE`,
      [threadId, userId]
    );
    if (tRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Pogovor ne obstaja");
    }
    const t = tRes.rows[0];
    if (t.status !== "pending") {
      await client.query("ROLLBACK");
      return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Zahteva ni več v statusu pending");
    }
    if (Number(t.requested_by) === userId) {
      await client.query("ROLLBACK");
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Zahteve ne moreš zavrniti sam/a");
    }

    await client.query(
      `UPDATE message_threads
       SET status = 'declined', declined_at = NOW(), updated_at = NOW()
       WHERE id = $1`,
      [threadId]
    );
    await client.query("COMMIT");
    return res.json({ message: "Zahteva zavrnjena" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Napaka /api/messages/requests/:threadId/decline:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri zavrnitvi zahteve");
  } finally {
    client.release();
  }
});

// GET /api/messages/conversation/:userId
// Query: limit (default 120, max 200), beforeId — starejša okna, afterId — samo novejša (polling)
router.get("/conversation/:userId", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const otherId = parseInt(req.params.userId, 10);

  if (Number.isNaN(otherId) || otherId < 1) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven userId");
  }
  if (otherId === userId) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Pogovor s samim seboj ni dovoljen");
  }

  if (await isBlockedEitherDirection(userId, otherId)) {
    return sendJsonError(res, 403, CODES.FORBIDDEN, "Pogovor ni dovoljen zaradi blokade");
  }

  const u1 = Math.min(userId, otherId);
  const u2 = Math.max(userId, otherId);

  const limit = Math.min(parseInt(req.query.limit || "120", 10), 200);
  const beforeId = parsePositiveInt(req.query.beforeId);
  const afterId = parsePositiveInt(req.query.afterId);

  const mapRow = (r) => ({
    ...r,
    sender_id: Number(r.sender_id),
    receiver_id: Number(r.receiver_id),
  });

  try {
    const threadJoin = `
      FROM messages m
      INNER JOIN message_threads t ON m.thread_id = t.id
      WHERE t.user_id_1 = $1 AND t.user_id_2 = $2 AND t.status = 'accepted'`;

    if (afterId) {
      const { rows } = await db.query(
        `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at
         ${threadJoin}
           AND m.id > $3
         ORDER BY m.id ASC
         LIMIT $4`,
        [u1, u2, afterId, limit]
      );
      return res.json({
        messages: rows.map(mapRow),
        hasMore: false,
      });
    }

    const fetchLimit = limit + 1;
    const params = [u1, u2];
    let sql = `SELECT m.id, m.sender_id, m.receiver_id, m.content, m.is_read, m.created_at
       ${threadJoin}`;
    if (beforeId) {
      sql += ` AND m.id < $3`;
      params.push(beforeId);
      sql += ` ORDER BY m.id DESC LIMIT $4`;
      params.push(fetchLimit);
    } else {
      sql += ` ORDER BY m.id DESC LIMIT $3`;
      params.push(fetchLimit);
    }

    const { rows } = await db.query(sql, params);
    const hasMore = rows.length > limit;
    const slice = (hasMore ? rows.slice(0, limit) : rows).reverse();

    return res.json({
      messages: slice.map(mapRow),
      hasMore,
    });
  } catch (err) {
    console.error("Napaka /api/messages/conversation:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju pogovora");
  }
});

// GET /api/messages/unread
router.get("/unread", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }

  try {
    const { rows } = await db.query(
      `SELECT id, sender_id, receiver_id, content, is_read, created_at
       FROM messages
       WHERE receiver_id = $1 AND is_read = FALSE
       ORDER BY created_at ASC
       LIMIT 200`,
      [userId]
    );

    return res.json({ messages: rows });
  } catch (err) {
    console.error("Napaka /api/messages/unread:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju neprebranih sporočil");
  }
});

// POST /api/messages/mark-read
router.post("/mark-read", requireAuth, async (req, res) => {
  const userId = authUserId(req);
  if (userId === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const otherUserId = parsePositiveInt(req.body.otherUserId);
  if (otherUserId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "otherUserId je obvezen in mora biti pozitivno celo število");
  }

  try {
    const client = await db.connect();
    try {
      await client.query("BEGIN");

      const threadId = await (async () => {
        const [u1, u2] = normalizePair(userId, otherUserId);
        const t = await client.query(
          `SELECT id
           FROM message_threads
           WHERE user_id_1 = $1 AND user_id_2 = $2
           LIMIT 1`,
          [u1, u2]
        );
        return t.rows?.[0]?.id ? Number(t.rows[0].id) : null;
      })();

      const updateRes = await client.query(
        `UPDATE messages
         SET is_read = TRUE
         WHERE receiver_id = $1 AND sender_id = $2 AND is_read = FALSE
         RETURNING id`,
        [userId, otherUserId]
      );

      const updated = updateRes.rowCount;
      const maxReadId = updated > 0 ? Math.max(...updateRes.rows.map((r) => Number(r.id))) : null;

      if (threadId !== null) {
        const maxInThread = await client.query(
          `SELECT MAX(id)::int AS max_id
           FROM messages
           WHERE thread_id = $1 AND receiver_id = $2 AND sender_id = $3 AND is_read = TRUE`,
          [threadId, userId, otherUserId]
        );
        const lastReadMessageId = Number(maxInThread.rows?.[0]?.max_id || 0) || (maxReadId ?? null);

        if (lastReadMessageId !== null) {
          await client.query(
            `INSERT INTO message_thread_reads (thread_id, user_id, last_read_message_id, last_read_at)
             VALUES ($1, $2, $3, NOW())
             ON CONFLICT (thread_id, user_id)
             DO UPDATE SET
               last_read_message_id = GREATEST(COALESCE(message_thread_reads.last_read_message_id, 0), EXCLUDED.last_read_message_id),
               last_read_at = NOW()`,
            [threadId, userId, lastReadMessageId]
          );
        }
      }

      await client.query("COMMIT");
      return res.json({ updated });
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("Napaka /api/messages/mark-read:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri označevanju sporočil kot prebrana");
  }
});

// GET /api/messages/seen/:userId
// Per-thread “seen” for the last message you sent (no timestamp UI requirement).
router.get("/seen/:userId", requireAuth, async (req, res) => {
  const me = authUserId(req);
  if (me === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const otherId = parseInt(req.params.userId, 10);
  if (Number.isNaN(otherId) || otherId < 1) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven userId");
  }
  if (otherId === me) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven userId");
  }

  try {
    if (await isBlockedEitherDirection(me, otherId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Pogovor ni dovoljen zaradi blokade");
    }

    const threadId = await getThreadIdForPair(me, otherId);
    if (threadId === null) {
      return res.json({ threadId: null, lastMyMessageId: null, isSeen: false });
    }

    const lastMine = await db.query(
      `SELECT MAX(id)::int AS id
       FROM messages
       WHERE thread_id = $1 AND sender_id = $2 AND receiver_id = $3`,
      [threadId, me, otherId]
    );
    const lastMyMessageId = Number(lastMine.rows?.[0]?.id || 0) || null;
    if (lastMyMessageId === null) {
      return res.json({ threadId, lastMyMessageId: null, isSeen: false });
    }

    const readRes = await db.query(
      `SELECT last_read_message_id
       FROM message_thread_reads
       WHERE thread_id = $1 AND user_id = $2
       LIMIT 1`,
      [threadId, otherId]
    );
    const otherLastRead = Number(readRes.rows?.[0]?.last_read_message_id || 0) || null;
    const isSeen = otherLastRead !== null && otherLastRead >= lastMyMessageId;

    return res.json({ threadId, lastMyMessageId, otherLastReadMessageId: otherLastRead, isSeen });
  } catch (err) {
    console.error("Napaka /api/messages/seen:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju seen statusa");
  }
});

// POST /api/messages/typing
// Body: { otherUserId, isTyping }  → stores TTL (typing_until) without websockets.
router.post("/typing", requireAuth, async (req, res) => {
  const me = authUserId(req);
  if (me === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const otherUserId = parsePositiveInt(req.body.otherUserId);
  if (otherUserId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "otherUserId je obvezen in mora biti pozitivno celo število");
  }
  const isTyping = Boolean(req.body.isTyping);

  try {
    if (await isBlockedEitherDirection(me, otherUserId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Pogovor ni dovoljen zaradi blokade");
    }

    const threadId = await getThreadIdForPair(me, otherUserId);
    if (threadId === null) {
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Pogovor ne obstaja");
    }

    const untilSql = isTyping ? "NOW() + INTERVAL '6 seconds'" : "NOW()";
    await db.query(
      `INSERT INTO message_typing (thread_id, user_id, typing_until)
       VALUES ($1, $2, ${untilSql})
       ON CONFLICT (thread_id, user_id)
       DO UPDATE SET typing_until = EXCLUDED.typing_until`,
      [threadId, me]
    );

    return res.json({ ok: true, threadId, isTyping });
  } catch (err) {
    console.error("Napaka /api/messages/typing:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri typing statusu");
  }
});

// GET /api/messages/typing/:userId
router.get("/typing/:userId", requireAuth, async (req, res) => {
  const me = authUserId(req);
  if (me === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Neveljaven uporabnik");
  }
  const otherId = parseInt(req.params.userId, 10);
  if (Number.isNaN(otherId) || otherId < 1) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven userId");
  }
  if (otherId === me) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven userId");
  }

  try {
    if (await isBlockedEitherDirection(me, otherId)) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Pogovor ni dovoljen zaradi blokade");
    }

    const threadId = await getThreadIdForPair(me, otherId);
    if (threadId === null) {
      return res.json({ threadId: null, otherUserId: otherId, isTyping: false });
    }

    const r = await db.query(
      `SELECT 1
       FROM message_typing
       WHERE thread_id = $1 AND user_id = $2 AND typing_until > NOW()
       LIMIT 1`,
      [threadId, otherId]
    );
    return res.json({ threadId, otherUserId: otherId, isTyping: r.rowCount > 0 });
  } catch (err) {
    console.error("Napaka /api/messages/typing/:userId:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju typing statusa");
  }
});

module.exports = router;

