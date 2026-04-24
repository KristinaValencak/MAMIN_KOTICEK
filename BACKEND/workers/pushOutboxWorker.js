const db = require("../config/database");
const { deliverOneOutboxJob } = require("../services/push/pushDispatcher");

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchNextJobId() {
  const res = await db.query(
    `SELECT id
     FROM push_outbox
     WHERE status IN ('pending','failed')
       AND next_attempt_at <= NOW()
     ORDER BY next_attempt_at ASC, id ASC
     LIMIT 1`
  );
  return res.rows?.[0]?.id ? Number(res.rows[0].id) : null;
}

async function runLoop({ intervalMs }) {
  while (true) {
    try {
      const id = await fetchNextJobId();
      if (!id) {
        await sleep(intervalMs);
        continue;
      }
      await deliverOneOutboxJob(id);
    } catch (err) {
      console.error("pushOutboxWorker loop error:", err);
      await sleep(intervalMs);
    }
  }
}

function startPushOutboxWorker() {
  const enabled = String(process.env.ENABLE_PUSH_WORKER || "").toLowerCase();
  if (!(enabled === "1" || enabled === "true" || enabled === "yes" || enabled === "on")) {
    return { started: false };
  }

  const intervalMs = Math.max(250, Number(process.env.PUSH_WORKER_POLL_MS || 1000));
  runLoop({ intervalMs });
  return { started: true, intervalMs };
}

module.exports = {
  startPushOutboxWorker,
};

