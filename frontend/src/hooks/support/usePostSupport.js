import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppToast } from "../../context/ApiAlertModalContext.jsx";
import { API_BASE } from "../../api/config";
import { getStoredUser } from "../../utils/helpers";
import { useAuthGate } from "../../context/AuthGateContext";

const EMPTY = { support: 0, hug: 0, understand: 0, together: 0 };

function normalizeSummary(data) {
  const counts = { ...EMPTY, ...(data?.counts || {}) };
  const myReaction = data?.myReaction || null;
  const reactors = Array.isArray(data?.reactors) ? data.reactors : [];
  return { counts, myReaction, reactors };
}

function feedBootstrapKey(initialFromFeed) {
  if (!initialFromFeed?.counts || typeof initialFromFeed.counts.support !== "number") return null;
  return JSON.stringify({
    c: initialFromFeed.counts,
    m: initialFromFeed.myReaction ?? null,
  });
}

/**
 * @param {number|string|null} postId
 * @param {{ counts: object, myReaction: string|null }|null} [initialFromFeed] — iz GET /api/posts (brez reactors); preskoči začetni fetch
 */
export function usePostSupport(postId, initialFromFeed = null) {
  const { toast } = useAppToast();
  const { requestAuth } = useAuthGate();
  const bootKey = useMemo(() => feedBootstrapKey(initialFromFeed), [initialFromFeed]);
  const bootPayloadRef = useRef(initialFromFeed);
  bootPayloadRef.current = initialFromFeed;

  const [summary, setSummary] = useState(() =>
    bootKey
      ? normalizeSummary({ ...initialFromFeed, reactors: [] })
      : { counts: EMPTY, myReaction: null, reactors: [] }
  );
  const [loading, setLoading] = useState(!bootKey);
  const [pending, setPending] = useState(false);

  const load = useCallback(
    async (opts = {}) => {
      const silent = Boolean(opts.silent);
      if (!postId) return;
      try {
        if (!silent) setLoading(true);
        const res = await fetch(`${API_BASE}/api/posts/${postId}/support`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Napaka pri branju podpore");
        setSummary(normalizeSummary(data));
      } catch (e) {
        console.error(e);
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [postId]
  );

  useEffect(() => {
    if (!postId) return;
    if (bootKey) {
      setSummary(normalizeSummary({ ...bootPayloadRef.current, reactors: [] }));
      setLoading(false);
      return;
    }
    load();
  }, [postId, bootKey, load]);

  const react = useCallback(
    async (reactionType) => {
      const user = getStoredUser();
      if (!user) {
        requestAuth({ tab: "login", reason: "Za podporne reakcije na objavi se morate prijaviti." });
        return;
      }

      const prev = summary;
      const prevType = prev.myReaction;
      const nextType = prevType === reactionType ? null : reactionType;

      const optimisticCounts = { ...prev.counts };
      if (prevType) optimisticCounts[prevType] = Math.max((optimisticCounts[prevType] || 0) - 1, 0);
      if (nextType) optimisticCounts[nextType] = (optimisticCounts[nextType] || 0) + 1;

      setPending(true);
      setSummary((prevS) => ({ counts: optimisticCounts, myReaction: nextType, reactors: prevS.reactors }));

      try {
        const res = await fetch(`${API_BASE}/api/posts/${postId}/support`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ reactionType }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Napaka pri reakciji");
        await load({ silent: true });
      } catch (e) {
        console.error(e);
        setSummary(prev);
        toast({ status: "error", title: "Reakcija ni uspela." });
      } finally {
        setPending(false);
      }
    },
    [postId, summary, toast, load, requestAuth]
  );

  const reloadSupport = useCallback(() => load({ silent: true }), [load]);

  return { support: summary, loadingSupport: loading, reactingSupport: pending, react, reloadSupport };
}
