import { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../../api/config";

const DEFAULT_PAGE = 30;

export function useTopMoms({ pageSize = DEFAULT_PAGE } = {}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const offsetRef = useRef(0);
  const loadingMoreRef = useRef(false);
  const hasMoreRef = useRef(true);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  const load = useCallback(
    async (append = false) => {
      try {
        if (append) {
          if (loadingMoreRef.current || !hasMoreRef.current) return;
          loadingMoreRef.current = true;
          setLoadingMore(true);
        } else {
          setLoading(true);
          setItems([]);
          setHasMore(true);
          hasMoreRef.current = true;
          offsetRef.current = 0;
        }
        setError("");
        const offset = append ? offsetRef.current : 0;
        const url = new URL(`${API_BASE}/api/support/top-moms`);
        url.searchParams.set("period", "week");
        url.searchParams.set("limit", String(pageSize));
        url.searchParams.set("offset", String(offset));
        const res = await fetch(url.toString(), { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || "Napaka pri branju lestvice");
        const batch = data.items || [];
        const more = data.pagination?.hasMore === true;
        hasMoreRef.current = more;
        setHasMore(more);
        setItems((prev) => {
          const next = append ? [...prev, ...batch] : batch;
          offsetRef.current = next.length;
          return next;
        });
      } catch (e) {
        console.error(e);
        setError(e.message || "Napaka pri branju lestvice");
        if (!append) setItems([]);
      } finally {
        loadingMoreRef.current = false;
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [pageSize]
  );

  useEffect(() => {
    load(false);
  }, [load]);

  const loadMore = useCallback(() => load(true), [load]);

  return { items, loading, loadingMore, hasMore, error, loadMore, reload: () => load(false) };
}
