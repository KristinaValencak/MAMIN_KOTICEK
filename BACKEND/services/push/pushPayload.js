function safeStr(val, maxLen) {
  if (val == null) return "";
  const s = String(val);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

function buildDeepLink({ type, postId, threadId, appealId, friendRequestId }) {
  // Single canonical deep-link for all platforms:
  // - web can map this to react-router routes
  // - native apps can map scheme routes
  // Keep it stable and versionable.
  const base = "maminkoticek://";

  if (type === "message" && threadId) return `${base}messages/thread/${threadId}`;
  if (type === "appeal_resolved" && appealId) return `${base}moderation/appeals/${appealId}`;
  if (type === "friend_request" && friendRequestId) return `${base}friends/requests/${friendRequestId}`;
  if (type === "friend_accept" && friendRequestId) return `${base}friends/requests/${friendRequestId}`;
  if ((type === "like" || type === "comment" || type === "reply" || type === "post_hidden" || type === "comment_hidden") && postId) {
    return `${base}forum/post/${postId}`;
  }
  return `${base}notifications`;
}

function buildPushPayloadFromNotificationRow(row) {
  const type = String(row.type || "").trim();

  const notificationId = row.id != null ? String(row.id) : "";
  const postId = row.post_id ?? row.postId ?? null;
  const threadId = row.thread_id ?? row.threadId ?? null;
  const appealId = row.appeal_id ?? row.appealId ?? null;
  const friendRequestId = row.friend_request_id ?? row.friendRequestId ?? null;

  const deeplink = buildDeepLink({ type, postId, threadId, appealId, friendRequestId });

  // Keep lockscreen-safe by default. If you later add preferences, you can include previews conditionally.
  let body = "Imaš novo obvestilo.";

  const actorNameRaw =
    row.actor_username ??
    row.actorUsername ??
    row.actor_username?.username ??
    null;
  const actorName = safeStr(actorNameRaw || "Nekdo", 60) || "Nekdo";

  const reactionTypeRaw =
    (row.metadata && typeof row.metadata === "object" ? row.metadata.reactionType : null) ??
    row.reactionType ??
    null;
  const reactionType = String(reactionTypeRaw || "").trim();
  const reactionLabel =
    reactionType === "support" ? "💗" :
    reactionType === "hug" ? "🤗" :
    reactionType === "understand" ? "🌸" :
    reactionType === "together" ? "🥰" :
    "";

  if (type === "message") {
    body = "Imaš novo sporočilo.";
  } else if (type === "friend_request") {
    body = `${actorName} želi biti tvoj prijatelj.`;
  } else if (type === "friend_accept") {
    body = `${actorName} je sprejela tvojo prošnjo za prijateljstvo.`;
  } else if (type === "appeal_resolved") {
    body = "Tvoja zahteva je bila obravnavana.";
  } else if (type === "comment") {
    body = `${actorName} je komentirala tvojo objavo.`;
  } else if (type === "reply") {
    body = `${actorName} je odgovorila na tvoj komentar.`;
  } else if (type === "like") {
    body = `${actorName} je všečkala tvojo objavo.`;
  } else if (type === "support_react") {
    const suffix = reactionLabel ? ` ${reactionLabel}` : "";
    body = `${actorName} je reagirala na tvojo vsebino.${suffix}`;
  } else if (type === "post_hidden" || type === "comment_hidden") {
    body = "Vsebina je bila skrita zaradi pravil.";
  }

  const data = {
    type: safeStr(type, 40),
    notificationId: safeStr(notificationId, 40),
    deeplink: safeStr(deeplink, 512),
  };

  if (postId != null) data.postId = String(postId);
  if (threadId != null) data.threadId = String(threadId);
  if (appealId != null) data.appealId = String(appealId);
  if (friendRequestId != null) data.friendRequestId = String(friendRequestId);

  return {
    // Don't send a fixed title equal to the app name; the OS already shows the app name ("from ...").
    // Omitting title prevents duplicate "Mamin kotiček" lines in notifications.
    notification: { body },
    data,
  };
}

module.exports = {
  buildDeepLink,
  buildPushPayloadFromNotificationRow,
};

