import { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../../api/config";

export function useCategoryTags(categorySlug) {
  const slug = useMemo(() => (categorySlug ? String(categorySlug).trim() : ""), [categorySlug]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let abort = false;
    if (!slug) {
      setTags([]);
      setLoading(false);
      setError("");
      return () => { abort = true; };
    }

    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/categories/${encodeURIComponent(slug)}/tags`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items = Array.isArray(data?.items) ? data.items : [];
        if (!abort) setTags(items);
      } catch (e) {
        console.error(e);
        if (!abort) setError("Ne morem prebrati tagov za kategorijo.");
        if (!abort) setTags([]);
      } finally {
        if (!abort) setLoading(false);
      }
    })();

    return () => {
      abort = true;
    };
  }, [slug]);

  return { tags, loading, error };
}

