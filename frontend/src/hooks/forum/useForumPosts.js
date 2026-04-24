import { useState, useRef, useCallback, useEffect } from "react";
import { API_BASE } from "../../api/config";

export const useForumPosts = (selectedCategory, view, tag, city, group, pageSize = 6) => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState("");
  const pageRef = useRef(1);
  const itemsRef = useRef([]);
  const fetchGenRef = useRef(0);
  const loadingMoreRef = useRef(false);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    loadingMoreRef.current = loadingMore;
  }, [loadingMore]);

  const loadItems = useCallback(
    async (append = false) => {
      let gen;
      if (append) {
        if (loadingMoreRef.current) return;
        gen = fetchGenRef.current;
        setLoadingMore(true);
      } else {
        fetchGenRef.current += 1;
        gen = fetchGenRef.current;
        const hadItems = itemsRef.current.length > 0;
        setLoading(!hadItems);
        setRefreshing(hadItems);
        setHasMore(true);
        pageRef.current = 1;
      }

      setError("");

      try {
        const currentPage = append ? pageRef.current + 1 : 1;
        const params = new URLSearchParams();
        params.set("limit", String(pageSize));
        params.set("offset", String((currentPage - 1) * pageSize));
        if (view === "top") params.set("sort", "top");
        if (view === "friends") params.set("feed", "friends");
        if (selectedCategory?.slug) params.set("category", String(selectedCategory.slug));
        if (String(tag || "").trim()) params.set("tag", String(tag).trim().toLowerCase());
        if (String(city || "").trim()) params.set("city", String(city).trim());
        if (String(group || "").trim()) params.set("group", String(group).trim().toLowerCase());
        const url = `${API_BASE}/api/posts?${params.toString()}`;
        const r = await fetch(url, { credentials: "include" });
        if (view === "friends" && r.status === 401) {
          if (gen !== fetchGenRef.current) return;
          setItems([]);
          setHasMore(false);
          setError("Za objave prijateljic se moraš prijaviti.");
          return;
        }
        const ct = r.headers.get("content-type") || "";
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (!ct.includes("application/json")) {
          const t = await r.text();
          throw new Error(`Pričakovan JSON, dobil: ${ct}. ${t.slice(0, 120)}`);
        }
        const data = await r.json();
        const list = data.items || [];

        if (gen !== fetchGenRef.current) return;

        if (append) {
          setItems((prev) => [...prev, ...list]);
          pageRef.current = currentPage;
          setHasMore(list.length === pageSize);
        } else {
          setItems(list);
          pageRef.current = 1;
          setHasMore(list.length === pageSize);
        }
      } catch (e) {
        if (gen !== fetchGenRef.current) return;
        setError("Ne morem prebrati objav. Poskusi znova.");
        console.error(e);
      } finally {
        if (append) {
          setLoadingMore(false);
        } else if (gen === fetchGenRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedCategory?.slug, view, tag, city, group, pageSize]
  );

  const reset = useCallback(() => {
    pageRef.current = 1;
    loadItems(false);
  }, [loadItems]);

  const updatePostFavorite = useCallback((postId, isFavorited) => {
    setItems((prev) =>
      prev.map((p) => (Number(p.id) === Number(postId) ? { ...p, isFavorited } : p))
    );
  }, []);

  return { items, loading, refreshing, loadingMore, hasMore, error, loadItems, reset, updatePostFavorite };
};
