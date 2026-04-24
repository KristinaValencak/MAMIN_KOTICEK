import { normalizeSupportCounts, SUPPORT_DISPLAY_ORDER, totalSupportCountsSum } from "./helpers";

export function weightedSupportScore(counts) {
  const n = normalizeSupportCounts(counts);
  return (
    (Number(n.support) || 0) * 2 +
    (Number(n.hug) || 0) * 2 +
    (Number(n.understand) || 0) * 1 +
    (Number(n.together) || 0) * 1
  );
}

export function totalReactionInstances(counts, likeCount = 0) {
  return totalSupportCountsSum(counts) + (Number(likeCount) || 0);
}

export function topReactionClusterEmojis(counts, likeCount = 0, { max = 5 } = {}) {
  const n = normalizeSupportCounts(counts);
  const entries = [];
  const likes = Number(likeCount) || 0;
  if (likes > 0) entries.push({ count: likes, emoji: "👍" });
  for (const { key, emoji } of SUPPORT_DISPLAY_ORDER) {
    const c = Number(n[key]) || 0;
    if (c > 0) entries.push({ count: c, emoji });
  }
  entries.sort((a, b) => b.count - a.count);
  return entries.slice(0, max).map((e) => e.emoji);
}
