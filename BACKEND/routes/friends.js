const express = require("express");
const { sendJsonError, sendInternalError, CODES } = require("../utils/apiError");
const router = express.Router();
const db = require("../config/database");
const requireAuth = require("../middleware/auth");
const { friendRequestUserLimiter } = require("../middleware/rateLimiters");
const { createNotification } = require("../services/notifications/notificationWriter");

function normalizePair(a, b) {
  const na = Number(a);
  const nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return [a, b];
  return na < nb ? [na, nb] : [nb, na];
}

function parsePositiveInt(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = Number(value);
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

/** JWT / pg lahko vrnejo id kot niz; za primerjave mora biti število. */
function numericUserId(id) {
  const n = Number(id);
  if (Number.isNaN(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

// POST /api/friends/request
router.post("/request", requireAuth, friendRequestUserLimiter, async (req, res) => {
  const requesterId = req.user.id;
  const receiverId = parsePositiveInt(req.body.receiverId);
  if (receiverId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "receiverId je obvezen in mora biti pozitivno celo število");
  }
  if (receiverId === requesterId) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ne moreš poslati prošnje sam sebi");
  }

  try {

    const blockCheck = await db.query(
      `SELECT 1 FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [requesterId, receiverId]
    );
    if (blockCheck.rowCount > 0) {
      return sendJsonError(res, 403, CODES.FORBIDDEN, "Prošnja za prijateljstvo ni mogoča zaradi blokade");
    }

    const [u1, u2] = normalizePair(requesterId, receiverId);
    const existingFriend = await db.query(
      `SELECT 1 FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2`,
      [u1, u2]
    );
    if (existingFriend.rowCount > 0) {
      return sendJsonError(res, 409, CODES.CONFLICT, "Uporabnika sta že prijatelja");
    }

    const existingReq = await db.query(
      `SELECT id, status, requester_id, receiver_id
       FROM friend_requests
       WHERE (requester_id = $1 AND receiver_id = $2)
          OR (requester_id = $2 AND receiver_id = $1)
       LIMIT 1`,
      [requesterId, receiverId]
    );

    if (existingReq.rowCount > 0) {
      const reqRow = existingReq.rows[0];
      if (reqRow.status === "pending") {
        return sendJsonError(res, 409, CODES.CONFLICT, "Prošnja za prijateljstvo že čaka");
      }
      if (reqRow.status === "accepted") {
        // Self-heal: in zgodovinskih bugih se je lahko zgodilo, da je friends vrstica izbrisana,
        // friend_requests pa je ostal "accepted". Ker smo že zgoraj preverili, da nista prijatelja,
        // tukaj popravimo stanje in dovolimo ponovno pošiljanje prošnje.
        await db.query(
          `UPDATE friend_requests
           SET requester_id = $1,
               receiver_id = $2,
               status = 'pending',
               updated_at = NOW()
           WHERE id = $3`,
          [requesterId, receiverId, reqRow.id]
        );

        try {
          await createNotification({
            recipientUserId: receiverId,
            actorUserId: requesterId,
            type: "friend_request",
            friendRequestId: Number(reqRow.id),
          });
        } catch (notifErr) {
          console.error("Napaka pri ustvarjanju notifikacije (friend_request heal):", notifErr);
        }

        return res.json({ message: "Prošnja za prijateljstvo poslana", requestId: Number(reqRow.id) });
      }
      await db.query(
        `UPDATE friend_requests
         SET requester_id = $1,
             receiver_id = $2,
             status = 'pending',
             updated_at = NOW()
         WHERE id = $3`,
        [requesterId, receiverId, reqRow.id]
      );

      try {
        await createNotification({
          recipientUserId: receiverId,
          actorUserId: requesterId,
          type: "friend_request",
          friendRequestId: Number(reqRow.id),
        });
      } catch (notifErr) {
        console.error("Napaka pri ustvarjanju notifikacije (friend_request resend):", notifErr);
      }

      return res.json({ message: "Prošnja za prijateljstvo ponovno poslana", requestId: Number(reqRow.id) });
    }

    const ins = await db.query(
      `INSERT INTO friend_requests (requester_id, receiver_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING id`,
      [requesterId, receiverId]
    );

    try {
      await createNotification({
        recipientUserId: receiverId,
        actorUserId: requesterId,
        type: "friend_request",
        friendRequestId: Number(ins.rows?.[0]?.id),
      });
    } catch (notifErr) {
      console.error("Napaka pri ustvarjanju notifikacije (friend_request):", notifErr);
    }

    return res.status(201).json({ message: "Prošnja za prijateljstvo poslana", requestId: Number(ins.rows?.[0]?.id) });
  } catch (err) {
    console.error("Napaka /api/friends/request:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri pošiljanju prošnje");
  }
});

// POST /api/friends/accept
router.post("/accept", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const requestId = parsePositiveInt(req.body.requestId);
  if (requestId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "requestId je obvezen in mora biti pozitivno celo število");
  }

  const client = await db.connect();
  let requesterId = null;
  try {
    await client.query("BEGIN");

    const reqRes = await client.query(
      `SELECT * FROM friend_requests
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'
       FOR UPDATE`,
      [requestId, userId]
    );

    if (reqRes.rowCount === 0) {
      await client.query("ROLLBACK");
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Prošnja ne obstaja ali ni več v statusu pending");
    }

    const request = reqRes.rows[0];
    requesterId = request.requester_id;
    const [u1, u2] = normalizePair(requesterId, userId);

    await client.query(
      `UPDATE friend_requests
       SET status = 'accepted', updated_at = NOW()
       WHERE id = $1`,
      [requestId]
    );

    await client.query(
      `INSERT INTO friends (user_id_1, user_id_2)
       VALUES ($1, $2)
       ON CONFLICT (user_id_1, user_id_2) DO NOTHING`,
      [u1, u2]
    );

    await client.query("COMMIT");

    // Notify the requester that their friend request was accepted.
    // Best-effort; do not fail the accept flow if notification insert fails.
    try {
      await createNotification({
        recipientUserId: Number(requesterId),
        actorUserId: Number(userId),
        // notifications.type is varchar(20) in DB; keep it short.
        type: "friend_accept",
        friendRequestId: Number(requestId),
      });
    } catch (notifErr) {
      console.error("Napaka pri ustvarjanju notifikacije (friend_accept):", notifErr);
    }

    return res.json({ message: "Prošnja za prijateljstvo sprejeta" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Napaka /api/friends/accept:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri sprejemu prošnje");
  } finally {
    client.release();
  }
});

// POST /api/friends/reject
router.post("/reject", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const requestId = parsePositiveInt(req.body.requestId);

  if (requestId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "requestId je obvezen in mora biti pozitivno celo število");
  }

  try {
    const result = await db.query(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE id = $1 AND receiver_id = $2 AND status = 'pending'`,
      [requestId, userId]
    );

    if (result.rowCount === 0) {
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Prošnja ne obstaja ali ni več v statusu pending");
    }

    return res.json({ message: "Prošnja za prijateljstvo zavrnjena" });
  } catch (err) {
    console.error("Napaka /api/friends/reject:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri zavrnitvi prošnje");
  }
});

// POST /api/friends/cancel — prekliči poslano prošnjo (pending_sent)
router.post("/cancel", requireAuth, async (req, res) => {
  const me = req.user.id;
  const otherId = parsePositiveInt(req.body.userId ?? req.body.receiverId ?? req.body.otherId);
  if (otherId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "userId je obvezen in mora biti pozitivno celo število");
  }
  if (otherId === me) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna zahteva");
  }

  try {
    const result = await db.query(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE requester_id = $1
         AND receiver_id = $2
         AND status = 'pending'`,
      [me, otherId]
    );

    if (result.rowCount === 0) {
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Prošnja ni najdena ali ni več v statusu pending");
    }

    return res.json({ message: "Prošnja za prijateljstvo preklicana" });
  } catch (err) {
    console.error("Napaka /api/friends/cancel:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri preklicu prošnje");
  }
});

// GET /api/friends/status/:otherId — razmerje s prijavljenim uporabnikom
router.get("/status/:otherId", requireAuth, async (req, res) => {
  const me = numericUserId(req.user.id);
  if (me === null) {
    return sendJsonError(res, 401, CODES.UNAUTHORIZED, "Napačen uporabnik");
  }
  const otherId = parsePositiveInt(req.params.otherId);
  if (otherId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "otherId mora biti pozitivno celo število");
  }
  if (otherId === me) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljaven uporabnik");
  }

  try {
    const blockRes = await db.query(
      `SELECT blocker_id FROM user_blocks
       WHERE (blocker_id = $1 AND blocked_id = $2)
          OR (blocker_id = $2 AND blocked_id = $1)
       LIMIT 1`,
      [me, otherId]
    );
    if (blockRes.rowCount > 0) {
      const blockerId = Number(blockRes.rows[0].blocker_id);
      return res.json({
        status: "blocked",
        blockedByMe: blockerId === me,
        blockedMe: blockerId !== me,
      });
    }

    const [u1, u2] = normalizePair(me, otherId);
    const friendRes = await db.query(
      `SELECT 1 FROM friends WHERE user_id_1 = $1 AND user_id_2 = $2`,
      [u1, u2]
    );
    if (friendRes.rowCount > 0) {
      return res.json({ status: "friends" });
    }

    const pendingRes = await db.query(
      `SELECT id, requester_id
       FROM friend_requests
       WHERE status = 'pending'
         AND (
           (requester_id = $1 AND receiver_id = $2)
           OR (requester_id = $2 AND receiver_id = $1)
         )
       LIMIT 1`,
      [me, otherId]
    );
    if (pendingRes.rowCount > 0) {
      const row = pendingRes.rows[0];
      const requesterId = Number(row.requester_id);
      if (requesterId === me) {
        return res.json({ status: "pending_sent" });
      }
      return res.json({
        status: "pending_received",
        requestId: Number(row.id),
      });
    }

    return res.json({ status: "none" });
  } catch (err) {
    console.error("Napaka /api/friends/status:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju stanja prijateljstva");
  }
});

// POST /api/friends/remove — odstrani prijateljstvo (brez blokade)
router.post("/remove", requireAuth, async (req, res) => {
  const me = req.user.id;
  const otherId = parsePositiveInt(req.body.userId ?? req.body.friendId);
  if (otherId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "userId je obvezen in mora biti pozitivno celo število");
  }
  if (otherId === me) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Neveljavna zahteva");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const [u1, u2] = normalizePair(me, otherId);
    const del = await client.query(
      `DELETE FROM friends
       WHERE user_id_1 = $1 AND user_id_2 = $2`,
      [u1, u2]
    );
    if (del.rowCount === 0) {
      await client.query("ROLLBACK");
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Nista prijatelja");
    }
    await client.query(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE status = 'accepted'
         AND (
           (requester_id = $1 AND receiver_id = $2)
           OR (requester_id = $2 AND receiver_id = $1)
         )`,
      [me, otherId]
    );
    await client.query("COMMIT");
    return res.json({ message: "Prijateljstvo odstranjeno" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Napaka /api/friends/remove:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri odstranitvi prijateljstva");
  } finally {
    client.release();
  }
});

// GET /api/friends/list
router.get("/list", requireAuth, async (req, res) => {
  const userId = req.user.id;
  const limit = Math.min(parseInt(req.query.limit || "60", 10), 150);
  const offset = Math.max(parseInt(req.query.offset || "0", 10), 0);

  try {
    const countRes = await db.query(
      `SELECT COUNT(*)::int AS c FROM friends WHERE user_id_1 = $1 OR user_id_2 = $1`,
      [userId]
    );
    const total = parseInt(countRes.rows?.[0]?.c, 10) || 0;

    const detailed = await db.query(
      `SELECT u.id, u.username
       FROM friends f
       JOIN users u ON u.id = (CASE WHEN f.user_id_1 = $1 THEN f.user_id_2 ELSE f.user_id_1 END)
       WHERE f.user_id_1 = $1 OR f.user_id_2 = $1
       ORDER BY u.username ASC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    return res.json({
      friends: detailed.rows,
      pagination: { limit, offset, total },
    });
  } catch (err) {
    console.error("Napaka /api/friends/list:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju prijateljev");
  }
});

// GET /api/friends/requests (pending requests received)
router.get("/requests", requireAuth, async (req, res) => {
  const userId = req.user.id;
  try {
    const { rows } = await db.query(
      `SELECT fr.id,
              fr.requester_id AS "requesterId",
              u.username AS "requesterUsername",
              fr.created_at AS "createdAt"
       FROM friend_requests fr
       JOIN users u ON u.id = fr.requester_id
       WHERE fr.receiver_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC
       LIMIT 50`,
      [userId]
    );

    return res.json({ items: rows });
  } catch (err) {
    console.error("Napaka /api/friends/requests:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri branju prošenj");
  }
});

// POST /api/friends/block
router.post("/block", requireAuth, async (req, res) => {
  const blockerId = req.user.id;
  const blockedId = parsePositiveInt(req.body.blockedId);
  if (blockedId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "blockedId je obvezen in mora biti pozitivno celo število");
  }
  if (blockedId === blockerId) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "Ne moreš blokirati samega sebe");
  }

  const client = await db.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO user_blocks (blocker_id, blocked_id)
       VALUES ($1, $2)
       ON CONFLICT (blocker_id, blocked_id) DO NOTHING`,
      [blockerId, blockedId]
    );

    const [u1, u2] = normalizePair(blockerId, blockedId);
    await client.query(
      `DELETE FROM friends
       WHERE user_id_1 = $1 AND user_id_2 = $2`,
      [u1, u2]
    );

    await client.query(
      `UPDATE friend_requests
       SET status = 'rejected', updated_at = NOW()
       WHERE status IN ('pending','accepted')
         AND (
           (requester_id = $1 AND receiver_id = $2)
           OR (requester_id = $2 AND receiver_id = $1)
         )`,
      [blockerId, blockedId]
    );

    await client.query("COMMIT");
    return res.json({ message: "Uporabnik blokiran" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Napaka /api/friends/block:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri blokiranju uporabnika");
  } finally {
    client.release();
  }
});

// POST /api/friends/unblock
router.post("/unblock", requireAuth, async (req, res) => {
  const blockerId = req.user.id;
  const blockedId = parsePositiveInt(req.body.blockedId);

  if (blockedId === null) {
    return sendJsonError(res, 400, CODES.VALIDATION_ERROR, "blockedId je obvezen in mora biti pozitivno celo število");
  }

  try {
    const result = await db.query(
      `DELETE FROM user_blocks
       WHERE blocker_id = $1 AND blocked_id = $2`,
      [blockerId, blockedId]
    );

    if (result.rowCount === 0) {
      return sendJsonError(res, 404, CODES.NOT_FOUND, "Blokiranje ni najdeno");
    }

    return res.json({ message: "Uporabnik odblokiran" });
  } catch (err) {
    console.error("Napaka /api/friends/unblock:", err);
    return sendJsonError(res, 500, CODES.INTERNAL_ERROR, "Napaka strežnika pri odblokiranju uporabnika");
  }
});

module.exports = router;

