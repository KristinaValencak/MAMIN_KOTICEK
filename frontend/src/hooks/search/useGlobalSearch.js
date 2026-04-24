import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE } from "../../api/config";
import { SEARCH_DEBOUNCE_MS } from "../../constants/timing";
import { useDebouncedValue } from "../useDebouncedValue";

function normalizeType(v) {
  const t = String(v || "all").trim().toLowerCase();
  if (t === "events") return "all";
  if (t === "all" || t === "users" || t === "posts" || t === "marketplace") return t;
  return "all";
}

export function useGlobalSearch({ query, type, limit = 8, debounceMs = SEARCH_DEBOUNCE_MS }) {
  const normalizedType = useMemo(() => normalizeType(type), [type]);
  const q = String(query || "");
  const trimmed = q.trim();
  const debouncedQuery = useDebouncedValue(trimmed, debounceMs);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({ limit, offset: 0, total: 0 });

  const abortRef = useRef(null);

  const canSearch = debouncedQuery.length >= 2;

  const fetchSearch = useCallback(
    async ({ offset = 0, append = false } = {}) => {
      const q2 = debouncedQuery;
      const t2 = normalizedType;
      if (q2.length < 2) {
        setError("");
        setLoading(false);
        setData(null);
        setItems([]);
        setPagination({ limit, offset: 0, total: 0 });
        return;
      }

      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setLoading(true);
      setError("");
      try {
        const url = new URL(`${API_BASE}/api/search`);
        url.searchParams.set("q", q2);
        url.searchParams.set("type", t2);
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("offset", String(offset));

        const res = await fetch(url.toString(), { credentials: "include", signal: controller.signal });
        const json = await res.json().catch(() => null);
        if (!res.ok) throw new Error(json?.error || json?.message || `HTTP ${res.status}`);

        if (t2 === "all") {
          setData(json);
          setItems([]);
          setPagination({ limit, offset: 0, total: 0 });
        } else {
          const newItems = Array.isArray(json?.items) ? json.items : [];
          const pag = json?.pagination || {};
          setData(null);
          setItems((prev) => (append ? [...prev, ...newItems] : newItems));
          setPagination({
            limit: Number(pag?.limit) || limit,
            offset: Number(pag?.offset) || offset,
            total: Number(pag?.total) || 0,
          });
        }
      } catch (e) {
        if (e?.name === "AbortError") return;
        setError("Prišlo je do napake pri iskanju.");
        setData(null);
        setItems([]);
        setPagination({ limit, offset: 0, total: 0 });
      } finally {
        setLoading(false);
      }
    },
    [debouncedQuery, normalizedType, limit]
  );

  useEffect(() => {
    fetchSearch({ offset: 0, append: false });
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, [fetchSearch]);

  const hasMore = useMemo(() => {
    if (normalizedType === "all") return false;
    const nextOffset = (pagination.offset || 0) + (pagination.limit || limit);
    return nextOffset < (pagination.total || 0);
  }, [normalizedType, pagination, limit]);

  const loadMore = useCallback(async () => {
    if (normalizedType === "all") return;
    if (!hasMore) return;
    const nextOffset = (pagination.offset || 0) + (pagination.limit || limit);
    await fetchSearch({ offset: nextOffset, append: true });
  }, [normalizedType, hasMore, pagination, limit, fetchSearch]);

  const reset = useCallback(() => {
    fetchSearch({ offset: 0, append: false });
  }, [fetchSearch]);

  return {
    query: trimmed,
    type: normalizedType,
    canSearch,
    loading,
    error,
    data,
    items,
    pagination,
    hasMore,
    loadMore,
    reset,
  };
}

